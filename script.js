class AIMemoryCore {
    constructor() {
        this.memories = [];
        this.conversationHistory = [];
        this.activeMemories = new Set();
        this.currentMood = 'neutral';
        this.currentUser = null;
        
        this.initializeElements();
        this.bindEvents();
        this.initializeUser();
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

    async initializeUser() {
        try {
            this.currentUser = await window.websim.getUser();
            if (this.currentUser) {
                this.updateUIForUser();
            }
        } catch (error) {
            console.error('Failed to get current user:', error);
            this.addSystemMessage('Unable to load user data. Please make sure you are logged in.');
        }
    }

    updateUIForUser() {
        if (this.currentUser) {
            this.loadMemoriesBtn.textContent = `Load ${this.currentUser.username}'s Project History`;
        }
    }

    loadSampleMemories() {
        // Remove sample memories - we'll load real data instead
        this.memories = [];
        this.renderMemories();
        this.updateMemoryCount();
        this.updateAIMood();
    }

    async loadProjectHistory() {
        if (!this.currentUser) {
            this.addSystemMessage('Please log in to load your project history.');
            return;
        }

        this.loadMemoriesBtn.textContent = 'Loading...';
        this.loadMemoriesBtn.disabled = true;

        try {
            // Get user's projects (up to 100 most recent)
            const response = await fetch(`/api/v1/users/${this.currentUser.username}/projects?first=100&sort_by=updated_at`);
            const projectsData = await response.json();
            
            if (!projectsData.projects || !projectsData.projects.data) {
                throw new Error('No projects found');
            }

            const memories = [];
            
            // Process each project
            for (const projectItem of projectsData.projects.data) {
                const project = projectItem.project;
                
                try {
                    // Get all revisions for this project
                    const revisionsResponse = await fetch(`/api/v1/projects/${project.id}/revisions`);
                    const revisionsData = await revisionsResponse.json();
                    
                    if (revisionsData.revisions && revisionsData.revisions.data) {
                        // Process each revision to extract prompt history
                        for (const revisionItem of revisionsData.revisions.data) {
                            const revision = revisionItem.project_revision;
                            
                            // Get the site data to access the prompt
                            if (revision.site_id) {
                                try {
                                    const siteResponse = await fetch(`/api/v1/sites/${revision.site_id}/html`);
                                    // The site data is typically in the response headers or we need to get site info differently
                                    
                                    // Alternative: Get site info from projects endpoint which might include site data
                                    const siteInfoResponse = await fetch(`/api/v1/projects/${project.id}/revisions/${revision.version}`);
                                    const siteInfo = await siteInfoResponse.json();
                                    
                                    if (siteInfo.site && siteInfo.site.prompt) {
                                        const prompt = siteInfo.site.prompt;
                                        let promptText = '';
                                        let emotion = 'neutral';
                                        
                                        // Extract prompt text based on prompt structure
                                        if (typeof prompt === 'object' && prompt.text) {
                                            promptText = prompt.text;
                                            emotion = this.detectEmotion(promptText);
                                        } else if (typeof prompt === 'string') {
                                            promptText = prompt;
                                            emotion = this.detectEmotion(promptText);
                                        }
                                        
                                        if (promptText && promptText.trim()) {
                                            memories.push({
                                                id: project.id,
                                                version: `v${revision.version}`,
                                                prompt: promptText,
                                                emotion: emotion,
                                                timestamp: new Date(revision.created_at).getTime(),
                                                title: project.title || 'Untitled Project'
                                            });
                                        }
                                    }
                                } catch (siteError) {
                                    console.warn(`Failed to load site data for ${revision.site_id}:`, siteError);
                                }
                            }
                        }
                    }
                } catch (revisionError) {
                    console.warn(`Failed to load revisions for project ${project.id}:`, revisionError);
                }
            }
            
            // Sort memories by timestamp (most recent first)
            memories.sort((a, b) => b.timestamp - a.timestamp);
            
            this.memories = memories;
            this.renderMemories();
            this.updateMemoryCount();
            this.updateAIMood();
            
            if (memories.length > 0) {
                this.addSystemMessage(`Loaded ${memories.length} memories from your project history! I can now respond based on your creative journey.`);
            } else {
                this.addSystemMessage('No prompt history found in your projects. Create some projects with prompts to build my memory!');
            }
            
        } catch (error) {
            console.error('Failed to load project history:', error);
            this.addSystemMessage('Failed to load project history. Please try again later.');
        } finally {
            this.loadMemoriesBtn.textContent = this.currentUser ? `Load ${this.currentUser.username}'s Project History` : 'Load Project History';
            this.loadMemoriesBtn.disabled = false;
        }
    }

    detectEmotion(promptText) {
        const text = promptText.toLowerCase();
        
        // Emotional keywords mapping
        const emotionKeywords = {
            excited: ['amazing', 'awesome', 'incredible', 'fantastic', 'brilliant', 'stunning', 'spectacular', 'vibrant', 'dynamic', 'energetic'],
            frustrated: ['fix', 'bug', 'broken', 'error', 'problem', 'issue', 'help', 'debug', 'difficult', 'struggling'],
            calm: ['peaceful', 'serene', 'meditation', 'calm', 'relaxing', 'tranquil', 'soothing', 'gentle', 'mindful', 'zen'],
            thrilled: ['exciting', 'adventure', 'thrill', 'intense', 'bold', 'daring', 'extreme', 'wild', 'epic', 'adrenaline'],
            concerned: ['important', 'serious', 'critical', 'urgent', 'climate', 'environment', 'social', 'impact', 'awareness', 'responsibility'],
            joyful: ['fun', 'happy', 'cheerful', 'delightful', 'playful', 'bright', 'colorful', 'smile', 'joy', 'celebration'],
            creative: ['artistic', 'creative', 'innovative', 'unique', 'original', 'imaginative', 'inspiring', 'beautiful', 'design', 'aesthetic'],
            analytical: ['data', 'analysis', 'chart', 'graph', 'statistics', 'research', 'study', 'scientific', 'logical', 'systematic']
        };
        
        let maxScore = 0;
        let dominantEmotion = 'neutral';
        
        for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
            const score = keywords.reduce((acc, keyword) => {
                return acc + (text.includes(keyword) ? 1 : 0);
            }, 0);
            
            if (score > maxScore) {
                maxScore = score;
                dominantEmotion = emotion;
            }
        }
        
        return dominantEmotion;
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
        const recentMemories = this.memories.slice(0, 5); // Look at more recent memories
        const emotions = recentMemories.map(m => m.emotion);
        
        let dominantEmotion = this.calculateDominantEmotion(emotions);
        this.currentMood = dominantEmotion;
        
        const moodDescriptions = {
            excited: 'Energized and creative from recent exciting projects',
            frustrated: 'Contemplative, having worked through challenges',
            calm: 'Peaceful and centered from mindful projects',
            thrilled: 'Adventurous and bold from intense experiences',
            concerned: 'Thoughtful and analytical about important issues',
            joyful: 'Optimistic and playful from delightful creations',
            creative: 'Inspired and imaginative from artistic endeavors',
            analytical: 'Focused and systematic from data-driven projects',
            neutral: 'Balanced and ready to explore new possibilities'
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