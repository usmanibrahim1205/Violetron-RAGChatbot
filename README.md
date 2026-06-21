# Violetron - Glassmorphic Gemini RAG Chatbot

Violetron is a lightweight, beginner-friendly Retrieval-Augmented Generation (RAG) chatbot application. It combines a modern, glassmorphic web-based user interface with a local FAISS vector database and the Gemini API to query custom PDF and TXT documents.

## Features

- **Glassmorphism Purple Web UI**: A beautiful, responsive interface featuring ambient floating orbs, backdrop blurs, and premium typography.
- **Local FAISS Vector Index**: Fast and secure local search of document embeddings using Meta's FAISS library.
- **Dynamic Model Selection**: Auto-detects and uses the best available embedding and generative models from your configured Gemini API key (e.g., `text-embedding-004` and `gemini-1.5-flash`).
- **Semantic Sentence Chunking**: Groups document text into overlapping semantic blocks to preserve context boundaries.
- **Client-Managed API Keys**: Supports secure, local storage of API keys without hardcoding credentials.
- **Source Inspection**: Allows users to inspect the exact retrieved text chunks and their mathematical distance scores for transparency.

## Project Structure

```text
├── app.py             # Flask backend & RAG pipeline logic
├── requirements.txt   # Python dependencies
├── sample.txt         # System reference guide (used for testing RAG)
├── templates/
│   └── index.html     # Frontend UI structure
└── static/
    ├── css/
    │   └── style.css  # Glassmorphic UI styling
    └── js/
        └── main.js    # Frontend application state & API handlers
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

1. **API Key Setup**: Enter your Gemini API key in the configuration panel on the left. You can check the "Save locally for convenience" checkbox to save the key to a local `.api_key` file (automatically ignored by git).
2. **Upload Documents**: Drag and drop or browse to upload a `.txt` or `.pdf` file. The server will automatically chunk the text, generate vector embeddings, and add them to the local FAISS index.
3. **Ask Questions**: Type your question in the message input at the bottom and press enter. The system will retrieve the most relevant document chunks and generate a precise answer.
4. **Inspect Sources**: Click the "View Context Sources" badge on any assistant response to inspect the exact retrieved context chunks and distance scores.
