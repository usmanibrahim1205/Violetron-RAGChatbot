import os
import re
import io
import numpy as np
from flask import Flask, request, jsonify, render_template
import google.generativeai as genai
import faiss
from pypdf import PdfReader

app = Flask(__name__, template_folder='templates', static_folder='static')

# Configuration
API_KEY_FILE = '.api_key'

class VioletronRAG:
    def __init__(self):
        self.api_key = None
        # Each document: {"id": int, "filename": str, "content": str, "chunk_index": int}
        self.documents = []
        self.index = None
        self.dimension = 768  # Default output dimension (aligns dynamically on ingestion)
        self.model_name = "gemini-1.5-flash"
        self.embedding_model = "models/embedding-001"
        
        # Load API key from local file if it exists
        self.load_stored_key()

    def load_stored_key(self):
        if os.path.exists(API_KEY_FILE):
            try:
                with open(API_KEY_FILE, 'r', encoding='utf-8') as f:
                    stored_key = f.read().strip()
                    if stored_key:
                        success, _ = self.set_api_key(stored_key)
                        if success:
                            print("Successfully auto-loaded Gemini API Key from local file.")
            except Exception as e:
                print(f"Error loading stored API key: {e}")

    def is_configured(self):
        return self.api_key is not None

    def set_api_key(self, api_key, save_locally=False):
        try:
            # Configure Google Generative AI
            genai.configure(api_key=api_key)
            
            # Test key validity by listing models and discover available embedding & generation models
            try:
                models = list(genai.list_models())
                embed_models = [m.name for m in models if 'embedContent' in m.supported_generation_methods]
                gen_models = [m.name for m in models if 'generateContent' in m.supported_generation_methods]
                
                print(f"Verified API Key. Available embedding models: {embed_models}")
                print(f"Available generation models: {gen_models}")
                
                # Dynamically choose the best embedding model available
                if 'models/text-embedding-004' in embed_models:
                    self.embedding_model = 'models/text-embedding-004'
                elif 'models/embedding-001' in embed_models:
                    self.embedding_model = 'models/embedding-001'
                elif embed_models:
                    self.embedding_model = embed_models[0]
                else:
                    self.embedding_model = 'models/embedding-001'
                    
                # Dynamically choose the best generation model available
                preferred_gen_models = [
                    'models/gemini-3.5-flash',
                    'models/gemini-2.5-flash',
                    'models/gemini-2.0-flash',
                    'models/gemini-1.5-flash',
                    'models/gemini-flash-latest'
                ]
                
                selected_gen = None
                for pref in preferred_gen_models:
                    if pref in gen_models:
                        selected_gen = pref
                        break
                        
                if not selected_gen:
                    # Look for any model containing 'flash'
                    flash_models = [m for m in gen_models if 'flash' in m.lower()]
                    if flash_models:
                        selected_gen = flash_models[0]
                    elif gen_models:
                        selected_gen = gen_models[0]
                    else:
                        selected_gen = 'models/gemini-1.5-flash'
                        
                # Extract clean model name (strip 'models/' prefix)
                if selected_gen.startswith('models/'):
                    self.model_name = selected_gen[7:]
                else:
                    self.model_name = selected_gen
                    
            except Exception as le:
                print(f"Warning: Failed to list models, using fallback defaults: {le}")
                self.embedding_model = 'models/embedding-001'
                self.model_name = 'gemini-1.5-flash'
                
            print(f"Selected embedding model: {self.embedding_model}")
            print(f"Selected generative model: {self.model_name}")
            self.api_key = api_key
            
            # Save locally if requested
            if save_locally:
                with open(API_KEY_FILE, 'w', encoding='utf-8') as f:
                    f.write(api_key)
            
            # Initialize the FAISS index with current dimension
            if self.index is None:
                self.index = faiss.IndexFlatL2(self.dimension)
                
            return True, "API Key successfully validated."
        except Exception as e:
            # If configuration failed, keep old key or reset
            return False, f"Invalid API Key: {str(e)}"

    def clear_api_key(self):
        self.api_key = None
        if os.path.exists(API_KEY_FILE):
            try:
                os.remove(API_KEY_FILE)
            except Exception:
                pass
        self.clear_database()

    def clear_database(self):
        self.documents = []
        if self.api_key:
            self.index = faiss.IndexFlatL2(self.dimension)
        else:
            self.index = None

    def chunk_text(self, text, target_words=350, overlap_sentences=1):
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        # Simple sentence splitter: splits after . ! or ? followed by whitespace
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        chunks = []
        current_chunk = []
        current_word_count = 0
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            words = sentence.split()
            current_chunk.append(sentence)
            current_word_count += len(words)
            
            if current_word_count >= target_words:
                chunks.append(" ".join(current_chunk))
                # Create overlap of sentences
                if len(current_chunk) > overlap_sentences:
                    current_chunk = current_chunk[-overlap_sentences:]
                current_word_count = sum(len(s.split()) for s in current_chunk)
                
        # Append remaining text if any
        if current_chunk and current_word_count > 0:
            chunks.append(" ".join(current_chunk))
            
        return chunks

    def add_document(self, filename, text):
        if not self.is_configured():
            return False, "API key is not configured."
        
        chunks = self.chunk_text(text)
        if not chunks:
            return False, "Document contains no extractable text."

        embeddings = []
        try:
            # Batch embedding retrieval is faster and cleaner
            # Gemini support batch embedding up to 2048 contents
            response = genai.embed_content(
                model=self.embedding_model,
                content=chunks,
                task_type="retrieval_document"
            )
            embeddings = response['embedding']
        except Exception as e:
            return False, f"Failed to generate embeddings: {str(e)}"

        # Convert to numpy array
        embeddings_np = np.array(embeddings, dtype='float32')
        
        # Check and align dimension dynamically to support different embedding models
        actual_dimension = embeddings_np.shape[1]
        if self.index is None or self.dimension != actual_dimension:
            print(f"Aligning FAISS dimension dynamically to {actual_dimension} (was {self.dimension})")
            self.dimension = actual_dimension
            self.index = faiss.IndexFlatL2(self.dimension)
            
        self.index.add(embeddings_np)

        # Store text and metadata
        start_idx = len(self.documents)
        for i, chunk in enumerate(chunks):
            self.documents.append({
                "id": start_idx + i,
                "filename": filename,
                "content": chunk,
                "chunk_index": i + 1
            })

        return True, f"Successfully processed {filename} into {len(chunks)} chunks."

    def query(self, user_question, top_k=4):
        if not self.is_configured():
            return {"error": "API Key is not configured."}
        if len(self.documents) == 0:
            return {"error": "No documents uploaded. Please upload a PDF or TXT document first."}

        try:
            # 1. Embed query
            response = genai.embed_content(
                model=self.embedding_model,
                content=user_question,
                task_type="retrieval_query"
            )
            query_embedding = np.array([response['embedding']], dtype='float32')
            
            # 2. Search FAISS
            k = min(top_k, len(self.documents))
            distances, indices = self.index.search(query_embedding, k)
            
            # 3. Retrieve relevant chunks
            retrieved_chunks = []
            for i, idx in enumerate(indices[0]):
                if idx != -1 and idx < len(self.documents):
                    doc = self.documents[idx]
                    retrieved_chunks.append({
                        "filename": doc["filename"],
                        "content": doc["content"],
                        "chunk_index": doc["chunk_index"],
                        "score": float(distances[0][i])
                    })
            
            # 4. Construct context and prompt
            context_parts = []
            for item in retrieved_chunks:
                context_parts.append(f"Source: {item['filename']} (Chunk {item['chunk_index']})\nContent: {item['content']}")
            
            context_text = "\n\n".join(context_parts)
            
            prompt = f"""You are Violetron, a helpful, precise, and friendly RAG Chatbot.
Your task is to answer the user's question using ONLY the provided context text. 

CRITICAL INSTRUCTIONS:
- Directly output the answer to the question without any introductory phrases, greetings, or self-references (e.g. do NOT say "Based on the provided context...", "Hello, I am Violetron...", "Sure, here is the answer...", etc.).
- If the context does not contain the answer, or if you cannot find the answer in the context, state clearly: "I cannot find the answer to this question in the uploaded documents." Do not try to make up answers or use external knowledge.

---
CONTEXT:
{context_text}
---

USER QUESTION:
{user_question}

ANSWER:"""

            # 5. Generate response using LLM
            model = genai.GenerativeModel(self.model_name)
            response = model.generate_content(prompt)
            
            return {
                "answer": response.text,
                "sources": retrieved_chunks
            }
            
        except Exception as e:
            return {"error": f"Error running RAG Query: {str(e)}"}

# Global application manager
rag_manager = VioletronRAG()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        "configured": rag_manager.is_configured(),
        "document_count": len(set(doc['filename'] for doc in rag_manager.documents)),
        "chunk_count": len(rag_manager.documents),
        "api_key_saved_locally": os.path.exists(API_KEY_FILE)
    })

@app.route('/api/set-key', methods=['POST'])
def set_key():
    data = request.json or {}
    api_key = data.get('api_key', '').strip()
    save_locally = data.get('save_locally', False)
    
    if not api_key:
        return jsonify({"success": False, "error": "API Key is required."}), 400
        
    success, message = rag_manager.set_api_key(api_key, save_locally)
    if success:
        return jsonify({"success": True, "message": message})
    else:
        return jsonify({"success": False, "error": message}), 400

@app.route('/api/clear-key', methods=['POST'])
def clear_key():
    rag_manager.clear_api_key()
    return jsonify({"success": True, "message": "API Key cleared and database reset."})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if not rag_manager.is_configured():
        return jsonify({"error": "Gemini API key is not configured. Please set your API key first."}), 400
        
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request."}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected."}), 400

    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()

    try:
        file_bytes = file.read()
        
        # Extract text in memory
        if ext == '.pdf':
            pdf_stream = io.BytesIO(file_bytes)
            reader = PdfReader(pdf_stream)
            text = ""
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        elif ext == '.txt':
            text = file_bytes.decode('utf-8', errors='ignore')
        else:
            return jsonify({"error": "Unsupported file format. Please upload a .txt or .pdf file."}), 400

        if not text.strip():
            return jsonify({"error": "The uploaded file contains no readable text."}), 400

        # Add to FAISS and documents cache
        success, msg = rag_manager.add_document(filename, text)
        if success:
            return jsonify({
                "success": True,
                "message": msg,
                "chunks": len(rag_manager.documents)
            })
        else:
            return jsonify({"error": msg}), 500

    except Exception as e:
        return jsonify({"error": f"Failed to process file: {str(e)}"}), 500

@app.route('/api/query', methods=['POST'])
def query_rag():
    if not rag_manager.is_configured():
        return jsonify({"error": "Gemini API key is not configured. Please set your API key first."}), 400
        
    data = request.json or {}
    question = data.get('question', '').strip()
    
    if not question:
        return jsonify({"error": "Question cannot be empty."}), 400
        
    result = rag_manager.query(question)
    if "error" in result:
        return jsonify({"error": result["error"]}), 500
        
    return jsonify(result)

@app.route('/api/clear', methods=['POST'])
def clear_db():
    rag_manager.clear_database()
    return jsonify({"success": True, "message": "Database successfully cleared."})

if __name__ == '__main__':
    # Running locally on http://localhost:5000
    app.run(host='127.0.0.1', port=5000, debug=True)
