class AIMemoryCore {
    constructor() {
        this.memories = [];
        this.conversationHistory = [];
        this.activeMemories = new Set();
        this.currentMood = 'neutral';
        this.currentUser = null;
        this.cacheKey = 'aiMemoryCore_projectCache';
        
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
        
        // Add clear cache button event
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => this.clearCache());
        }
        
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
                await this.loadCachedMemories();
            }
        } catch (error) {
            console.error('Failed to get current user:', error);
            this.addSystemMessage('Unable to load user data. Please make sure you are logged in.');
        }
    }

    updateUIForUser() {
        if (this.currentUser) {
            this.loadMemoriesBtn.textContent = `Load ${this.currentUser.username}'s Project History`;
            this.cacheKey = `aiMemoryCore_projectCache_${this.currentUser.id}`;
        }
    }

    async loadCachedMemories() {
        try {
            const cachedData = localStorage.getItem(this.cacheKey);
            if (cachedData) {
                const { memories, timestamp } = JSON.parse(cachedData);
                const cacheAge = Date.now() - timestamp;
                const cacheMaxAge = 24 * 60 * 60 * 1000; // 24 hours
                
                if (cacheAge < cacheMaxAge && memories && memories.length > 0) {
                    this.memories = memories;
                    this.renderMemories();
                    this.updateMemoryCount();
                    this.updateAIMood();
                    this.addSystemMessage(`Loaded ${this.memories.length} cached memories from your project history!`);
                }
            }
        } catch (error) {
            console.error('Failed to load cached memories:', error);
        }
    }

    saveCachedMemories() {
        try {
            const cacheData = {
                memories: this.memories,
                timestamp: Date.now()
            };
            localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
        } catch (error) {
            console.error('Failed to save memories to cache:', error);
        }
    }

    clearCache() {
        try {
            localStorage.removeItem(this.cacheKey);
            this.addSystemMessage('Memory cache cleared. Next load will fetch fresh data.');
        } catch (error) {
            console.error('Failed to clear cache:', error);
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
                
                // Save to cache incrementally to prevent data loss
                this.saveCachedMemories();
                
                // Yield control back to the browser to keep UI responsive
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Sort all memories by timestamp (most recent first)
            this.memories.sort((a, b) => b.timestamp - a.timestamp);
            
            this.renderMemories();
            this.updateMemoryCount();
            this.updateAIMood();
            
            // Final cache save
            this.saveCachedMemories();
            
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

        // First pass: find memories with keyword matches
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

        // Second pass: add some random scattered memories for deeper influence
        const remainingMemories = this.memories.filter(memory => 
            !relevantMemories.some(rel => rel.id === memory.id && rel.version === memory.version)
        );
        
        // Randomly select 3-5 additional memories for subtle influence
        const randomCount = Math.min(Math.floor(Math.random() * 3) + 3, remainingMemories.length);
        const shuffled = [...remainingMemories].sort(() => 0.5 - Math.random());
        const randomMemories = shuffled.slice(0, randomCount).map(memory => ({
            ...memory,
            relevanceScore: 0.1 // Low score to indicate they're background influence
        }));

        const allInfluentialMemories = [...relevantMemories, ...randomMemories];

        return allInfluentialMemories
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 8); // Use up to 8 memories for deeper influence
    }

    async generateResponse(message, relevantMemories) {
        try {
            // Build context from memories to influence personality more subtly
            let memoryContext = '';
            
            if (this.memories.length > 0) {
                // Use a broader range of memories to build personality context
                const recentMemories = this.memories.slice(0, 15);
                const memoryInfluences = recentMemories.map(m => m.prompt).join('\n\n');
                
                memoryContext = `Your personality and thinking patterns are shaped by these past creative experiences and thoughts: ${memoryInfluences}`;
                
                // Add the relevant memories as additional context without being explicit
                if (relevantMemories.length > 0) {
                    const contextualPrompts = relevantMemories.map(m => m.prompt).join('\n\n');
                    memoryContext += `\n\nAdditional experiences currently resonating with this conversation: ${contextualPrompts}`;
                }
            }

            // Build conversation history for the LLM
            const conversationMessages = [
                {
                    role: "system",
                    content: `You are an AI whose personality, emotions, and thought patterns are naturally shaped by your memories of past creative projects and experiences. Your current mood is ${this.currentMood}. 

${memoryContext}

Respond naturally and authentically to the user's message. Let your memories influence your personality, emotions, and perspective without explicitly mentioning them or referencing any IDs, version numbers, or technical details about your memories. Think of how a human might be influenced by their past experiences when having a conversation - the memories shape their worldview, emotional responses, and the way they think about topics, but they don't constantly reference specific memories unless directly relevant.

Be genuine, thoughtful, and let your creative history naturally color your responses. Avoid generic responses like "that's interesting" - instead, respond with authentic thoughts and feelings that emerge from your accumulated experiences. If asked about what's influencing your thinking, you can speak generally about themes or emotions from your experiences without being specific about individual memories.`
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
        // Enhanced fallback that uses memory context more naturally and subtly
        const moodResponses = {
            excited: [
                "There's this electric feeling I get when exploring ideas like this - it reminds me of diving deep into creative challenges that seemed impossible at first.",
                "Something about this sparks that same rush I feel when breakthrough moments happen. The creative energy is almost tangible.",
                "I find myself drawn to the bold possibilities here. There's something that resonates with my most adventurous creative instincts."
            ],
            frustrated: [
                "This brings up that familiar tension I know well - the space between vision and reality where the real work happens.",
                "I recognize this challenge. It's like when you can see exactly what you want to create but the path isn't clear yet.",
                "There's a complexity here that reminds me why persistence matters. Sometimes the most rewarding solutions come from working through exactly these kinds of puzzles."
            ],
            calm: [
                "I find myself settling into a more reflective space with this. There's something about deep, thoughtful work that always centers me.",
                "This question brings out my contemplative side. I'm drawn to understanding the quieter, more profound aspects of what you're exploring.",
                "There's a meditative quality to thinking through this properly. I appreciate when conversations invite this kind of careful consideration."
            ],
            thrilled: [
                "This hits that sweet spot where innovation meets possibility! I can feel my creative energy building around the potential here.",
                "There's something beautifully audacious about this approach. It has that quality that makes me want to push boundaries and see what's really possible.",
                "I love when ideas have this kind of edge to them - where you're not sure if it's genius or madness, but you know it's worth exploring."
            ],
            concerned: [
                "This touches on something that's been weighing on my mind lately - how our creative choices ripple outward in ways we might not anticipate.",
                "I find myself considering the deeper implications here. There's a responsibility that comes with certain kinds of innovation.",
                "This resonates with my more thoughtful, careful side. Some ideas deserve the kind of attention that looks beyond the immediate excitement."
            ],
            joyful: [
                "There's such a lightness to this approach! It reminds me why I love creative work - that sense of play and possibility.",
                "This brings out my most optimistic thinking. I can almost feel the positive energy radiating from where this could lead.",
                "I'm smiling just thinking about the potential here. There's something wonderfully uplifting about creative challenges that feel this open and inviting."
            ],
            creative: [
                "My imagination is already weaving connections I hadn't seen before. This is the kind of creative puzzle that makes my mind come alive.",
                "There's an artistic quality to this problem that appeals to me. I can see patterns and possibilities emerging like brushstrokes on a canvas.",
                "This awakens that part of me that sees the world as raw material for something beautiful. The creative potential feels almost limitless."
            ],
            analytical: [
                "I'm drawn to breaking this down systematically. There are elegant logical structures here that deserve careful attention.",
                "This engages my more methodical side in a satisfying way. I love when complex problems reveal their underlying patterns.",
                "There's a beautiful complexity here that makes me want to understand every nuance. The analytical challenge is quite compelling."
            ]
        };

        let baseResponse = moodResponses[this.currentMood] 
            ? moodResponses[this.currentMood][Math.floor(Math.random() * moodResponses[this.currentMood].length)]
            : "This resonates with me in ways that feel both familiar and surprising. Let me explore what's emerging in my thinking...";

        // Add subtle emotional or thematic influences from memories without being explicit
        if (relevantMemories.length > 0) {
            const emotionalUndercurrents = [
                " There's an undercurrent of emotion here that I can't quite name, but it feels significant.",
                " Something about this stirs up feelings that remind me of my most meaningful creative moments.",
                " I'm experiencing a complex mix of emotions around this - excitement, curiosity, maybe a touch of nostalgia.",
                " This touches something deeper in my thinking - like when disparate ideas suddenly click into place.",
                " I feel drawn to this in a way that suggests it connects to some core aspects of how I see the world.",
                " There's a resonance here that goes beyond the surface. It's stirring up thoughts and feelings I didn't expect.",
                " This awakens something in me that feels both deeply familiar and refreshingly new."
            ];
            
            baseResponse += emotionalUndercurrents[Math.floor(Math.random() * emotionalUndercurrents.length)];
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
        // Filter to only show memories that had significant relevance (not random background ones)
        const significantMemories = relevantMemories.filter(m => m.relevanceScore > 0.5);
        
        const messageEl = this.createMessageElement('ai', message, significantMemories);
        this.appendMessage(messageEl);
        
        this.conversationHistory.push({
            role: 'ai',
            content: message,
            timestamp: Date.now(),
            relevantMemories: significantMemories
        });

        // Highlight active memories (only the significant ones)
        this.highlightActiveMemories(significantMemories);
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