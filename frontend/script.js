const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const modeToggle = document.getElementById('mode-toggle');

const API_BASE = 'http://localhost:8000';
let useStreaming = true; // Bonus 1: stream by default

// Bonus 2: Conversation History Memory
let conversationHistory = [];

// Auto-resize textarea
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if(this.value.trim() === '') {
        this.style.height = 'auto'; // reset
    }
});

// Send on Enter (Shift+Enter for new line)
userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);

clearBtn.addEventListener('click', () => {
    conversationHistory = [];
    chatBox.innerHTML = `
        <div class="message ai-message welcome-message">
            <div class="avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content">Chat cleared! How can I help you?</div>
        </div>
    `;
});

modeToggle.addEventListener('click', () => {
    useStreaming = !useStreaming;
    if (useStreaming) {
        modeToggle.classList.add('active');
        modeToggle.innerHTML = '<i class="fa-solid fa-bolt"></i> Stream';
    } else {
        modeToggle.classList.remove('active');
        modeToggle.innerHTML = '<i class="fa-solid fa-spinner"></i> Standard';
    }
});

function appendMessage(role, content) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    msgDiv.classList.add(role === 'user' ? 'user-message' : 'ai-message');
    
    const avatar = document.createElement('div');
    avatar.classList.add('avatar');
    avatar.innerHTML = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    
    // Use marked library to render markdown (if included)
    if(role === 'user') {
        contentDiv.textContent = content; // User text as is
    } else {
        contentDiv.innerHTML = marked.parse(content);
    }
    
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(contentDiv);
    
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    return contentDiv;
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    
    // Disable input while generating
    userInput.value = '';
    userInput.style.height = 'auto';
    userInput.disabled = true;
    sendBtn.disabled = true;
    
    // Add User message to UI and history
    appendMessage('user', text);
    conversationHistory.push({ role: 'user', content: text });
    
    // Create loading AI message
    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.classList.add('message', 'ai-message');
    aiMsgDiv.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="message-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>
    `;
    chatBox.appendChild(aiMsgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    let aiContentDiv = aiMsgDiv.querySelector('.message-content');
    
    try {
        if (useStreaming) {
            await handleStreamingResponse(aiContentDiv);
        } else {
            await handleStandardResponse(aiContentDiv);
        }
    } catch (error) {
        console.error('Error:', error);
        aiContentDiv.innerHTML = `<span style="color: #ff6b6b;"><i class="fa-solid fa-circle-exclamation"></i> Error connecting to backend. Please make sure FastAPI is running.</span>`;
        // Remove the user message from history if failed so they can retry
        conversationHistory.pop();
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

async function handleStandardResponse(aiContentDiv) {
    const response = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationHistory })
    });
    
    if(!response.ok) throw new Error("Network response was not ok");
    
    const data = await response.json();
    const finalResponse = data.response || "No response generated.";
    
    aiContentDiv.innerHTML = marked.parse(finalResponse);
    conversationHistory.push({ role: 'assistant', content: finalResponse });
}

async function handleStreamingResponse(aiContentDiv) {
    const response = await fetch(`${API_BASE}/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
        },
        body: JSON.stringify({ messages: conversationHistory })
    });

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    let completeText = '';
    aiContentDiv.innerHTML = ''; // Remove typing indicator
    
    // Parse SSE manually
    // SSE format: "data: ....\n\n"
    let buffer = '';
    
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process messages split by double newline
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
            const message = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            
            if (message.startsWith('data: ')) {
                const data = message.slice(6); // remove "data: "
                
                if (data === '[DONE]') {
                    // Stream finished
                    break;
                }
                
                // Append the incoming token
                completeText += data;
                // Dynamically render markdown
                aiContentDiv.innerHTML = marked.parse(completeText);
                chatBox.scrollTop = chatBox.scrollHeight;
            }
            boundary = buffer.indexOf('\n\n');
        }
    }
    
    // Save Assistant response to history
    conversationHistory.push({ role: 'assistant', content: completeText });
}
