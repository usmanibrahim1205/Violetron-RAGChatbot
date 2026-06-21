// Violetron Chatbot Frontend Logic

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const apiKeyInput = document.getElementById('api-key-input');
    const toggleKeyVisibilityBtn = document.getElementById('toggle-key-visibility');
    const saveLocallyCheckbox = document.getElementById('save-locally-checkbox');
    const saveKeyBtn = document.getElementById('save-key-btn');
    const clearKeyBtn = document.getElementById('clear-key-btn');
    const keyStatus = document.getElementById('key-status');

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadStatus = document.getElementById('upload-status');
    const filesCount = document.getElementById('files-count');
    const chunksCount = document.getElementById('chunks-count');
    const clearDbBtn = document.getElementById('clear-db-btn');

    const headerStatusDot = document.getElementById('header-status-dot');
    const headerStatusText = document.getElementById('header-status-text');
    const messagesList = document.getElementById('messages-list');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const resetChatBtn = document.getElementById('reset-chat-btn');

    const sourcesModal = document.getElementById('sources-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const sourcesContainer = document.getElementById('sources-container');

    // State Variables
    let isKeyConfigured = false;
    let lastRetrievedSources = [];

    // Initialize application state
    checkBackendStatus();

    // Textarea Auto-Resize
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = (chatInput.scrollHeight - 8) + 'px';
    });

    // 1. API Key Handlers
    toggleKeyVisibilityBtn.addEventListener('click', () => {
        const type = apiKeyInput.type === 'password' ? 'text' : 'password';
        apiKeyInput.type = type;
        
        const eyeOpen = toggleKeyVisibilityBtn.querySelector('.eye-open');
        const eyeClosed = toggleKeyVisibilityBtn.querySelector('.eye-closed');
        
        if (type === 'password') {
            eyeOpen.classList.remove('hidden');
            eyeClosed.classList.add('hidden');
        } else {
            eyeOpen.classList.add('hidden');
            eyeClosed.classList.remove('hidden');
        }
    });

    saveKeyBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showKeyStatus('Please enter an API key.', 'error');
            return;
        }

        setKeyLoadingState(true);
        try {
            const response = await fetch('/api/set-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_key: apiKey,
                    save_locally: saveLocallyCheckbox.checked
                })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                showKeyStatus('API Key verified & connected!', 'success');
                isKeyConfigured = true;
                updateUIPermissions();
                checkBackendStatus(); // Fetch refreshed document stats
            } else {
                showKeyStatus(data.error || 'Failed to validate API Key.', 'error');
            }
        } catch (error) {
            showKeyStatus('Network error occurred.', 'error');
            console.error(error);
        } finally {
            setKeyLoadingState(false);
        }
    });

    clearKeyBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to clear the API Key and reset the database?')) return;
        
        try {
            const response = await fetch('/api/clear-key', { method: 'POST' });
            if (response.ok) {
                apiKeyInput.value = '';
                showKeyStatus('API Key cleared.', 'info');
                isKeyConfigured = false;
                updateUIPermissions();
                checkBackendStatus();
                // Clear UI chat logs
                resetChatLogs();
            }
        } catch (error) {
            console.error('Error clearing key:', error);
        }
    });

    // 2. Document Upload Handlers
    dropZone.addEventListener('click', () => {
        if (!isKeyConfigured) {
            showUploadStatus('Please set your Gemini API key first.', 'error');
            return;
        }
        fileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (isKeyConfigured) dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (!isKeyConfigured) {
            showUploadStatus('Please set your Gemini API key first.', 'error');
            return;
        }
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFileUpload(fileInput.files[0]);
        }
    });

    async function handleFileUpload(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'txt' && ext !== 'pdf') {
            showUploadStatus('Unsupported file format. Please upload .txt or .pdf.', 'error');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            showUploadStatus('File size exceeds 10MB limit.', 'error');
            return;
        }

        setUploadLoadingState(true, `Processing ${file.name}...`);
        
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (response.ok && data.success) {
                showUploadStatus(`Successfully loaded ${file.name}!`, 'success');
                checkBackendStatus();
            } else {
                showUploadStatus(data.error || 'Failed to process file.', 'error');
            }
        } catch (error) {
            showUploadStatus('Network error while uploading.', 'error');
            console.error(error);
        } finally {
            setUploadLoadingState(false);
            fileInput.value = ''; // Reset input element
        }
    }

    clearDbBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to clear all documents from the vector database?')) return;
        
        try {
            const response = await fetch('/api/clear', { method: 'POST' });
            if (response.ok) {
                showUploadStatus('Vector database successfully cleared.', 'success');
                checkBackendStatus();
            }
        } catch (error) {
            console.error('Error clearing database:', error);
        }
    });

    // 3. Chat Pipeline Handlers
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    if (resetChatBtn) {
        resetChatBtn.addEventListener('click', () => {
            if (confirm('Reset conversation window? (Document index will remain intact)')) {
                resetChatLogs();
            }
        });
    }

    async function sendMessage() {
        const question = chatInput.value.trim();
        if (!question || !isKeyConfigured) return;

        // Add user message to UI
        appendMessage('user', question);
        chatInput.value = '';
        chatInput.style.height = 'auto';
        
        // Disable input during request
        chatInput.disabled = true;
        sendBtn.disabled = true;

        // Show typing indicator
        const typingIndicator = appendTypingIndicator();

        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });

            const data = await response.json();
            typingIndicator.remove();

            if (response.ok && !data.error) {
                appendMessage('assistant', data.answer, data.sources);
            } else {
                appendMessage('assistant', `⚠️ Error: ${data.error || 'Failed to retrieve response.'}`);
            }
        } catch (error) {
            typingIndicator.remove();
            appendMessage('assistant', '⚠️ Network error. Could not reach server.');
            console.error(error);
        } finally {
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.focus();
        }
    }

    // Modal Events
    closeModalBtn.addEventListener('click', toggleModal);
    sourcesModal.addEventListener('click', (e) => {
        if (e.target === sourcesModal) toggleModal();
    });

    // Helper Functions
    async function checkBackendStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            isKeyConfigured = data.configured;
            
            // Update Stats Display
            filesCount.textContent = data.document_count;
            chunksCount.textContent = data.chunk_count;
            
            // Enable/disable Clear Database button
            clearDbBtn.disabled = data.chunk_count === 0;

            if (isKeyConfigured) {
                showKeyStatus('API Key configured & verified.', 'success');
                apiKeyInput.placeholder = '••••••••••••••••••••••••••••••••••••';
                apiKeyInput.value = '';
                clearKeyBtn.classList.remove('hidden');
                saveKeyBtn.textContent = 'Update Key';
            } else {
                if (data.api_key_saved_locally) {
                    showKeyStatus('API key file detected, checking validity...', 'info');
                } else {
                    showKeyStatus('No API Key configured. Input key to begin.', 'info');
                }
                clearKeyBtn.classList.add('hidden');
                saveKeyBtn.textContent = 'Validate & Save';
            }
            
            updateUIPermissions();
        } catch (error) {
            console.error('Error fetching status:', error);
            showKeyStatus('Failed to connect to backend server.', 'error');
        }
    }

    function updateUIPermissions() {
        if (isKeyConfigured) {
            if (headerStatusDot) headerStatusDot.className = 'connection-status active';
            if (headerStatusText) headerStatusText.textContent = 'Violetron is active and connected to Gemini';
            chatInput.disabled = false;
            sendBtn.disabled = false;
            dropZone.style.opacity = '1';
            dropZone.style.pointerEvents = 'auto';
        } else {
            if (headerStatusDot) headerStatusDot.className = 'connection-status';
            if (headerStatusText) headerStatusText.textContent = 'API Key Required';
            chatInput.disabled = true;
            sendBtn.disabled = true;
            dropZone.style.opacity = '0.5';
            dropZone.style.pointerEvents = 'none';
        }
    }

    function showKeyStatus(message, type) {
        keyStatus.className = `status-indicator ${type}`;
        keyStatus.textContent = message;
    }

    function showUploadStatus(message, type) {
        uploadStatus.className = `status-indicator ${type}`;
        uploadStatus.textContent = message;
        setTimeout(() => {
            uploadStatus.className = 'status-indicator';
            uploadStatus.textContent = '';
        }, 5000);
    }

    function setKeyLoadingState(isLoading) {
        saveKeyBtn.disabled = isLoading;
        apiKeyInput.disabled = isLoading;
        if (isLoading) {
            saveKeyBtn.textContent = 'Validating...';
        } else {
            saveKeyBtn.textContent = isKeyConfigured ? 'Update Key' : 'Validate & Save';
        }
    }

    function setUploadLoadingState(isLoading, message = '') {
        if (isLoading) {
            dropZone.style.pointerEvents = 'none';
            uploadStatus.className = 'status-indicator info';
            uploadStatus.textContent = message;
        } else {
            dropZone.style.pointerEvents = 'auto';
        }
    }

    function appendMessage(sender, text, sources = []) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        // Format text basic paragraphs
        const paragraphs = text.split('\n').filter(p => p.trim());
        let formattedHTML = '';
        
        paragraphs.forEach(p => {
            // Very basic markdown bolding & formatting
            let cleanText = p
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code>$1</code>');
                
            if (p.trim().startsWith('- ') || p.trim().startsWith('* ')) {
                formattedHTML += `<li>${cleanText.substring(2)}</li>`;
            } else if (/^\d+\.\s/.test(p.trim())) {
                const index = p.indexOf(' ');
                formattedHTML += `<li>${cleanText.substring(index + 1)}</li>`;
            } else {
                formattedHTML += `<p>${cleanText}</p>`;
            }
        });

        // Wrap list items if present
        if (formattedHTML.includes('<li>')) {
            // Simple replace of contiguous blocks - here we just check if it has li
            // A more perfect MD parser can be used, but this keeps code lightweight and zero dependency
        }

        content.innerHTML = formattedHTML;
        bubble.appendChild(content);

        // Append RAG source badge if sources exist
        if (sources && sources.length > 0) {
            const badge = document.createElement('div');
            badge.className = 'source-badge';
            badge.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                View ${sources.length} Context Sources
            `;
            
            // Save sources state and hook modal click
            badge.addEventListener('click', () => {
                lastRetrievedSources = sources;
                renderSourcesModal();
                toggleModal();
            });
            bubble.appendChild(badge);
        }

        messageDiv.appendChild(bubble);
        messagesList.appendChild(messageDiv);
        
        // Scroll to bottom
        messagesList.scrollTop = messagesList.scrollHeight;
    }

    function appendTypingIndicator() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        
        bubble.appendChild(indicator);
        messageDiv.appendChild(bubble);
        messagesList.appendChild(messageDiv);
        messagesList.scrollTop = messagesList.scrollHeight;
        
        return messageDiv;
    }

    function resetChatLogs() {
        messagesList.innerHTML = '';
    }

    // Modal Control
    function toggleModal() {
        sourcesModal.classList.toggle('hidden');
    }

    function renderSourcesModal() {
        sourcesContainer.innerHTML = '';
        if (lastRetrievedSources.length === 0) {
            sourcesContainer.innerHTML = '<p class="text-muted">No sources associated with this answer.</p>';
            return;
        }

        lastRetrievedSources.forEach(source => {
            const card = document.createElement('div');
            card.className = 'source-card';
            
            // Format score to 2 decimal places and similarity %
            const similarityPercent = Math.max(0, Math.min(100, (1 - source.score) * 100)).toFixed(1);
            
            card.innerHTML = `
                <div class="source-meta">
                    <span class="source-file">${source.filename} (Chunk ${source.chunk_index})</span>
                    <span class="source-score">Distance: ${source.score.toFixed(3)}</span>
                </div>
                <div class="source-text">${escapeHtml(source.content)}</div>
            `;
            sourcesContainer.appendChild(card);
        });
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
