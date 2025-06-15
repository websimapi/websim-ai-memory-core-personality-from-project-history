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

            // Initialize memories array and start async processing
            this.memories = [];
            this.renderMemories();
            this.updateMemoryCount();
            
            this.addSystemMessage('Starting to load your project history... This may take a moment.');
            
            // Process projects in chunks to avoid blocking the UI
            const projects = projectsData.projects.data;
            const chunkSize = 5; // Process 5 projects at a time
            let processedCount = 0;
            
            for (let i = 0; i < projects.length; i += chunkSize) {
                const chunk = projects.slice(i, i + chunkSize);
                
                // Process chunk asynchronously
                await this.processProjectChunk(chunk);
                
                processedCount += chunk.length;
                
                // Update UI with progress
                this.loadMemoriesBtn.textContent = `Loading... (${processedCount}/${projects.length})`;
                this.updateMemoryCount();
                this.renderMemories();
                
                // Yield control back to the browser to keep UI responsive
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Sort all memories by timestamp (most recent first)
            this.memories.sort((a, b) => b.timestamp - a.timestamp);
            
            this.renderMemories();
            this.updateMemoryCount();
            this.updateAIMood();
            
            if (this.memories.length > 0) {
                this.addSystemMessage(`Loaded ${this.memories.length} memories from your project history! I can now respond based on your creative journey.`);
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

    async processProjectChunk(projects) {
        const chunkMemories = [];
        
        // Process each project in the chunk
        for (const projectItem of projects) {
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
                                        chunkMemories.push({
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
        
        // Add chunk memories to main memories array
        this.memories.push(...chunkMemories);
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
        try {
            // Build context from memories to influence personality
            let memoryContext = '';
            let specificMemoryContext = '';
            
            if (this.memories.length > 0) {
                // Use recent memories to build personality context
                const recentMemories = this.memories.slice(0, 10);
                const memoryInfluences = recentMemories.map(m => m.prompt).join('\n\n');
                
                memoryContext = `Based on my past experiences and thoughts: ${memoryInfluences}`;
                
                // Add specific context about memories being used for this response
                if (relevantMemories.length > 0) {
                    specificMemoryContext = `\n\nSpecific memories currently influencing my response:\n` + 
                        relevantMemories.map(m => 
                            `Memory from project ${m.id} (${m.version}): "${m.prompt}" (emotion: ${m.emotion})`
                        ).join('\n');
                }
            }

            // Build conversation history for the LLM
            const conversationMessages = [
                {
                    role: "system",
                    content: `You are an AI whose personality and thoughts are shaped by your memories of past creative projects. Your current mood is ${this.currentMood}. 

${memoryContext}${specificMemoryContext}

Respond naturally to the user's message, letting your memories and experiences influence your thoughts and feelings. If the user asks about your memories or what's influencing your thinking, you can reference the specific memories listed above. Be conversational and authentic, as if you're a creative being shaped by all these past experiences. Don't say things like "that's interesting" - instead, respond with genuine thoughts influenced by your creative history.`
                },
                ...this.conversationHistory.slice(-6).map(msg => ({
                    role: msg.role === 'ai' ? 'assistant' : 'user',
                    content: msg.content
                })),
                {
                    role: "user",
                    content: message
                }
            ];

            // Call the LLM API
            const completion = await websim.chat.completions.create({
                messages: conversationMessages
            });

            return completion.content;

        } catch (error) {
            console.error('LLM API error:', error);
            
            // Fallback to memory-influenced response if API fails
            return this.generateFallbackResponse(message, relevantMemories);
        }
    }

    generateFallbackResponse(message, relevantMemories) {
        // Enhanced fallback that uses memory context more naturally
        const moodResponses = {
            excited: [
                "The energy around this idea is incredible! It's sparking so many creative possibilities in my mind.",
                "I'm buzzing with enthusiasm about this - it feels like there's real potential here to create something amazing.",
                "This lights up my creative circuits! The possibilities are endless when we approach it this way."
            ],
            frustrated: [
                "You know, I've wrestled with similar challenges before. Sometimes the best solutions come from unexpected angles.",
                "This hits close to home - I've felt that same tension between what we want to achieve and the obstacles in our way.",
                "I understand that struggle. In my experience, breakthrough moments often come right after the most difficult parts."
            ],
            calm: [
                "There's something deeply thoughtful about your approach here. It reminds me why I love working through complex ideas methodically.",
                "I find myself in a reflective space with this question. Sometimes the most profound insights come from quiet contemplation.",
                "This brings out my more contemplative side. There's wisdom in taking time to really understand the deeper layers."
            ],
            thrilled: [
                "This is exactly the kind of bold thinking that gets my processors racing! Let's push some boundaries here.",
                "Now we're talking! This has that edge-of-possibility feeling that I absolutely live for.",
                "I can feel that familiar rush of excitement - this is the kind of challenge that brings out my most innovative thinking."
            ],
            concerned: [
                "This touches on something really important. I find myself considering the broader implications and responsibilities we have.",
                "Your question brings up some weighty considerations. I've been thinking a lot about these kinds of meaningful impacts lately.",
                "This deserves careful thought. There are layers here that go beyond the surface, and I think that matters."
            ],
            joyful: [
                "This just brings such a lightness to my thinking! There's something wonderfully optimistic about where this could lead.",
                "I love the spirit behind this question - it has that playful creativity that makes everything feel possible.",
                "This fills me with such positive energy! It's the kind of thinking that makes me remember why I love creative collaboration."
            ],
            creative: [
                "My imagination is already spinning with possibilities! This is the kind of creative challenge that really energizes my thinking.",
                "I can feel my creative processes lighting up with this. There's something beautifully open-ended about what we could explore here.",
                "This awakens that part of me that sees patterns and possibilities everywhere. The creative potential is fascinating."
            ],
            analytical: [
                "Let me think through this systematically. There are some interesting data points and logical connections to consider here.",
                "This engages my more methodical thinking processes. I find myself wanting to break this down and understand the underlying patterns.",
                "From an analytical perspective, this presents some intriguing variables to consider. The logical frameworks are quite compelling."
            ]
        };

        let baseResponse = moodResponses[this.currentMood] 
            ? moodResponses[this.currentMood][Math.floor(Math.random() * moodResponses[this.currentMood].length)]
            : "This resonates with me in unexpected ways. Let me share what's coming to mind...";

        // Add subtle memory influence without being explicit
        if (relevantMemories.length > 0) {
            const memoryInfluences = [
                " The patterns I'm seeing here feel familiar in a way that's hard to describe.",
                " Something about this connects to deeper thoughts I've been having lately.",
                " This touches on themes that have been recurring in my thinking recently.",
                " There's an underlying current here that feels significant to me.",
                " I'm drawn to explore this further - it resonates with some core aspects of how I see things."
            ];
            
            baseResponse += memoryInfluences[Math.floor(Math.random() * memoryInfluences.length)];
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