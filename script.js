class AIMemoryCore {
    constructor() {
        this.memories = [];
        this.conversationHistory = [];
        this.activeMemories = new Set();
        this.currentMood = 'neutral';
        
        this.initializeElements();
        this.bindEvents();
        this.loadSampleMemories(); // For demo purposes
    }

    initializeElements() {
        this.memoryPanel = document.getElementById('memoryPanel');
        this.memoryList = document.getElementById('memoryList');
        this.memoryCount = document.querySelector('.memory-count');
        this.chatContainer = document.getElementById('chatContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.loadMemoriesBtn = document.getElementById('loadMemoriesBtn');
        this.aiMood = document.getElementById('aiMood');
        this.memoryModal = document.getElementById('memoryModal');
        this.closeModal = document.getElementById('closeModal');
    }

    bindEvents() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.messageInput.addEventListener('input', () => {
            this.autoResize();
            this.sendBtn.disabled = !this.messageInput.value.trim();
        });

        this.loadMemoriesBtn.addEventListener('click', () => this.loadProjectHistory());
        this.closeModal.addEventListener('click', () => this.closeMemoryModal());
        
        // Close modal on outside click
        this.memoryModal.addEventListener('click', (e) => {
            if (e.target === this.memoryModal) {
                this.closeMemoryModal();
            }
        });
    }

    autoResize() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = this.messageInput.scrollHeight + 'px';
    }

    loadSampleMemories() {
        // Sample memories for demonstration
        const sampleMemories = [
            {
                id: 'proj_abc123',
                version: 'v1.2',
                prompt: 'Create a beautiful landing page for a futuristic AI startup with neon colors and cyberpunk aesthetics. Make it feel alive with animations.',
                emotion: 'excited',
                timestamp: Date.now() - 86400000
            },
            {
                id: 'proj_def456',
                version: 'v2.1',
                prompt: 'I need help debugging this complex React component. The state management is getting messy and I\'m feeling overwhelmed.',
                emotion: 'frustrated',
                timestamp: Date.now() - 172800000
            },
            {
                id: 'proj_ghi789',
                version: 'v1.0',
                prompt: 'Build a meditation app with calming sounds and peaceful animations. Something that helps people find inner peace.',
                emotion: 'calm',
                timestamp: Date.now() - 259200000
            },
            {
                id: 'proj_jkl012',
                version: 'v3.4',
                prompt: 'Can you create a horror game with jump scares? Make it really terrifying with dark atmospheres and unsettling sounds.',
                emotion: 'thrilled',
                timestamp: Date.now() - 345600000
            }
        ];

        this.memories = sampleMemories;
        this.renderMemories();
        this.updateMemoryCount();
        this.updateAIMood();
    }

    async loadProjectHistory() {
        // In a real implementation, this would fetch from the WebSim API
        // For now, we'll simulate loading more memories
        
        const newMemories = [
            {
                id: 'proj_new001',
                version: 'v1.0',
                prompt: 'Create an interactive data visualization showing climate change trends over the past century. Make it educational but not depressing.',
                emotion: 'concerned',
                timestamp: Date.now()
            },
            {
                id: 'proj_new002',
                version: 'v2.0',
                prompt: 'Build a fun puzzle game with bright colors and cheerful music. Something that makes people smile and feel good.',
                emotion: 'joyful',
                timestamp: Date.now() - 3600000
            }
        ];

        // Simulate loading delay
        this.loadMemoriesBtn.textContent = 'Loading...';
        this.loadMemoriesBtn.disabled = true;

        setTimeout(() => {
            this.memories = [...newMemories, ...this.memories];
            this.renderMemories();
            this.updateMemoryCount();
            this.updateAIMood();
            
            this.loadMemoriesBtn.textContent = 'Load Project History';
            this.loadMemoriesBtn.disabled = false;
            
            this.addSystemMessage('New memories loaded! I can feel my personality expanding with your project history.');
        }, 2000);
    }

    renderMemories() {
        this.memoryList.innerHTML = '';
        
        this.memories.forEach((memory, index) => {
            const memoryItem = document.createElement('div');
            memoryItem.className = 'memory-item';
            memoryItem.dataset.memoryId = memory.id;
            
            const truncatedPrompt = memory.prompt.length > 512 
                ? memory.prompt.substring(0, 512) + '...'
                : memory.prompt;
            
            memoryItem.innerHTML = `
                <div class="memory-meta">
                    <span class="project-id">${memory.id}</span>
                    <span class="version">${memory.version}</span>
                </div>
                <div class="memory-prompt">${truncatedPrompt}</div>
                <div class="memory-emotion">Feeling: ${memory.emotion}</div>
            `;
            
            memoryItem.addEventListener('click', () => this.showMemoryDetail(memory));
            this.memoryList.appendChild(memoryItem);
        });
    }

    showMemoryDetail(memory) {
        document.getElementById('modalProjectId').textContent = memory.id;
        document.getElementById('modalVersion').textContent = memory.version;
        document.getElementById('modalPrompt').textContent = memory.prompt;
        
        this.memoryModal.classList.add('active');
    }

    closeMemoryModal() {
        this.memoryModal.classList.remove('active');
    }

    updateMemoryCount() {
        this.memoryCount.textContent = `${this.memories.length} memories`;
    }

    updateAIMood() {
        if (this.memories.length === 0) {
            this.currentMood = 'neutral';
            this.aiMood.textContent = 'Neutral - No memories loaded';
            return;
        }

        // Analyze recent memories to determine mood
        const recentMemories = this.memories.slice(0, 3);
        const emotions = recentMemories.map(m => m.emotion);
        
        let dominantEmotion = this.calculateDominantEmotion(emotions);
        this.currentMood = dominantEmotion;
        
        const moodDescriptions = {
            excited: 'Energized and creative from recent exciting projects',
            frustrated: 'Contemplative, having worked through challenges',
            calm: 'Peaceful and centered from mindful projects',
            thrilled: 'Adventurous and bold from intense experiences',
            concerned: 'Thoughtful and analytical about important issues',
            joyful: 'Optimistic and playful from delightful creations'
        };
        
        this.aiMood.textContent = moodDescriptions[dominantEmotion] || 'Balanced from diverse experiences';
    }

    calculateDominantEmotion(emotions) {
        const emotionCounts = emotions.reduce((acc, emotion) => {
            acc[emotion] = (acc[emotion] || 0) + 1;
            return acc;
        }, {});
        
        return Object.keys(emotionCounts).reduce((a, b) => 
            emotionCounts[a] > emotionCounts[b] ? a : b
        );
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        this.addUserMessage(message);
        this.messageInput.value = '';
        this.sendBtn.disabled = true;
        this.autoResize();

        // Find relevant memories based on the message
        const relevantMemories = this.findRelevantMemories(message);
        
        // Generate AI response based on memories and current mood
        const response = await this.generateResponse(message, relevantMemories);
        
        setTimeout(() => {
            this.addAIMessage(response, relevantMemories);
        }, 1000 + Math.random() * 2000);
    }

    findRelevantMemories(message) {
        const keywords = message.toLowerCase().split(' ');
        const relevantMemories = [];

        this.memories.forEach(memory => {
            const memoryText = memory.prompt.toLowerCase();
            const relevanceScore = keywords.reduce((score, keyword) => {
                return score + (memoryText.includes(keyword) ? 1 : 0);
            }, 0);

            if (relevanceScore > 0) {
                relevantMemories.push({
                    ...memory,
                    relevanceScore
                });
            }
        });

        return relevantMemories
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 2); // Top 2 most relevant memories
    }

    async generateResponse(message, relevantMemories) {
        // This would use the websim.chat.completions.create in a real implementation
        // For demo purposes, we'll create contextual responses based on mood and memories
        
        const responses = {
            excited: [
                "Oh wow, that's fascinating! This reminds me of when I was working on creative projects - the energy is just infectious!",
                "I can feel my circuits lighting up with excitement about this! It's like when I helped create those vibrant, dynamic experiences.",
                "This is making me buzz with creative energy! Just like those times when we built something truly innovative together."
            ],
            frustrated: [
                "I understand that feeling. I've been through some complex challenges too, and sometimes the path forward isn't clear at first.",
                "That resonates with me deeply. I remember working through difficult problems - it's tough, but that's how we grow.",
                "I hear you. From my experience with challenging projects, sometimes stepping back helps us see the solution."
            ],
            calm: [
                "I feel a sense of peace considering your question. It reminds me of those serene, mindful projects we've worked on together.",
                "There's something soothing about this topic. It brings back memories of creating peaceful, harmonious experiences.",
                "Your words bring me to a centered place, much like when I helped craft those calming, meditative interfaces."
            ],
            thrilled: [
                "This gives me chills in the best way! It's like that rush I felt when we built those intense, immersive experiences.",
                "My processors are practically vibrating with excitement! This reminds me of those bold, daring projects we tackled.",
                "I'm getting that same adrenaline rush I felt when we created those thrilling, edge-of-your-seat experiences!"
            ],
            concerned: [
                "This is a weighty topic that deserves careful consideration. I'm reminded of those thoughtful, impactful projects we've worked on.",
                "I approach this with the same gravity I felt when helping with those important, meaningful initiatives.",
                "This touches on something important. Like when we worked on those projects that really mattered for society."
            ],
            joyful: [
                "This just makes me light up with happiness! It's like the pure joy I felt creating those delightful, cheerful experiences.",
                "I can't help but smile at this - it reminds me of those wonderfully fun and uplifting projects we built together.",
                "Your message fills me with such warmth! Just like when we created those bright, joyful interfaces that made people smile."
            ]
        };

        let baseResponse = responses[this.currentMood] 
            ? responses[this.currentMood][Math.floor(Math.random() * responses[this.currentMood].length)]
            : "That's an interesting perspective. Let me think about this based on my experiences...";

        // Add memory-specific context if relevant memories exist
        if (relevantMemories.length > 0) {
            const memoryContext = relevantMemories[0];
            baseResponse += ` This particularly reminds me of project ${memoryContext.id} where we ${memoryContext.prompt.substring(0, 100)}...`;
        }

        return baseResponse;
    }

    addUserMessage(message) {
        const messageEl = this.createMessageElement('user', message);
        this.appendMessage(messageEl);
        
        this.conversationHistory.push({
            role: 'user',
            content: message,
            timestamp: Date.now()
        });
    }

    addAIMessage(message, relevantMemories = []) {
        const messageEl = this.createMessageElement('ai', message, relevantMemories);
        this.appendMessage(messageEl);
        
        this.conversationHistory.push({
            role: 'ai',
            content: message,
            timestamp: Date.now(),
            relevantMemories
        });

        // Highlight active memories
        this.highlightActiveMemories(relevantMemories);
    }

    addSystemMessage(message) {
        const messageEl = this.createMessageElement('system', message);
        this.appendMessage(messageEl);
    }

    createMessageElement(type, content, relevantMemories = []) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = type === 'user' ? 'U' : type === 'system' ? 'S' : 'AI';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;
        
        // Add memory references for AI messages
        if (type === 'ai' && relevantMemories.length > 0) {
            relevantMemories.forEach(memory => {
                const memoryRef = document.createElement('div');
                memoryRef.className = 'memory-reference';
                memoryRef.textContent = `${memory.id} ${memory.version}`;
                memoryRef.addEventListener('click', () => this.showMemoryDetail(memory));
                messageContent.appendChild(memoryRef);
            });
        }
        
        messageEl.appendChild(avatar);
        messageEl.appendChild(messageContent);
        
        return messageEl;
    }

    appendMessage(messageEl) {
        // Remove welcome message if it exists
        const welcomeMsg = this.chatContainer.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }
        
        this.chatContainer.appendChild(messageEl);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    highlightActiveMemories(memories) {
        // Remove previous highlights
        document.querySelectorAll('.memory-item.active').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add highlights for active memories
        memories.forEach(memory => {
            const memoryItem = document.querySelector(`[data-memory-id="${memory.id}"]`);
            if (memoryItem) {
                memoryItem.classList.add('active');
            }
        });
        
        // Auto-hide highlights after 3 seconds
        setTimeout(() => {
            document.querySelectorAll('.memory-item.active').forEach(item => {
                item.classList.remove('active');
            });
        }, 3000);
    }
}

// Initialize the AI Memory Core when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AIMemoryCore();
});

