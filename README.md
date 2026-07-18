# Violetron - Professional RAG Chatbot

Violetron is a lightweight, beginner-friendly Retrieval-Augmented Generation (RAG) chatbot application. It combines a professional, three-column light-mode web interface with a local FAISS vector database and the Gemini API to query custom PDF and TXT documents.

## Features

- **Enterprise Light Mode UI**: A clean, information-dense, and highly polished three-column workspace layout using an Inter-based typographic scale and a modern purple color system.
- **Left Sidebar Navigation**: Seamlessly navigate between panels including Chat Interface, Knowledge Base manager, Document Index, and API Key settings.
- **RAG Context Inspector**: A collapsible right sidebar panel that automatically extracts, formats, and displays retrieved context chunks, match percentages, metadata, and distance scores when querying.
- **Local FAISS Vector Index**: Fast and secure local search of document embeddings using Meta's FAISS library.
- **Dynamic Model Selection**: Auto-detects and uses the best available embedding and generative models from your configured Gemini API key (e.g., `text-embedding-004` and `gemini-3.5-flash`).
- **Semantic Sentence Chunking**: Groups document text into overlapping semantic blocks to preserve context boundaries.
- **Client-Managed API Keys**: Supports secure, local storage of API keys without hardcoding credentials.

## Project Structure

```text
├── app.py             # Flask backend & RAG pipeline logic
├── requirements.txt   # Python dependencies
├── sample.txt         # System reference guide (used for testing RAG)
├── templates/
│   └── index.html     # Redesigned three-column HTML template
└── static/
    ├── css/
    │   └── style.css  # Enterprise Light Mode UI styling
    └── js/
        └── main.js    # Tab-navigation, storage, & right-sidebar handlers
```

## Prerequisites

- **Python**: version 3.9 or higher is recommended.
- **Gemini API Key**: A valid API key from Google AI Studio.

## Installation

1. **Clone or download** the project directory to your local machine.
2. **Navigate** to the project directory:
   ```bash
   cd RAGBot
   ```
3. **Create a virtual environment**:
   ```bash
   python -m venv .venv
   ```
4. **Activate the virtual environment**:
   - On Windows (PowerShell):
     ```powershell
     .venv\Scripts\Activate.ps1
     ```
   - On macOS/Linux:
     ```bash
     source .venv/bin/activate
     ```
5. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

1. Start the Flask server:
   ```bash
   python app.py
   ```
2. Open your web browser and navigate to:
   ```text
   http://127.0.0.1:5000
   ```

## How to Use

1. **API Key Setup**: Go to the **Settings** tab in the Left Sidebar and enter your Gemini API key. Check "Save locally in .api_key" to save it to your local file (git-ignored).
2. **Upload Documents**: Navigate to the **Uploaded Documents** tab to drag and drop or browse to upload `.txt` or `.pdf` files. The server will chunk text, generate vector embeddings, and add them to the local FAISS index.
3. **Ask Questions**: Open the **Chat Interface** tab and type your question in the message input at the bottom.
4. **Inspect Sources**: The **RAG Context Inspector** sidebar on the right side will automatically expand and display the matched document chunks, similarity scores, and metadata retrieved for the answer. You can toggle the inspector panel at any time using the sidebar button located next to the Send button.
