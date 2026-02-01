/**
 * Service API IA - Version Finale Robuste
 * Gère : OpenAI, LM Studio (API standard & spécifique), Groq
 */
const ApiService = {
    async fetchLLM(config, prompt) {
        if (!config || !config.provider) throw new Error("Configuration IA manquante.");
        
        const provider = config.provider.toLowerCase();

        switch (provider) {
            case 'lmstudio':
                if (config.endpoint.endsWith('/api/v1/chat')) {
                    return await this.lmStudioDirect(config, prompt);
                }
                return await this.standardChatCompletion(config, prompt);
            
            case 'openai':
            case 'groq':
                return await this.standardChatCompletion(config, prompt);
            
            case 'mock':
                return new Promise(res => setTimeout(() => res("[MOCK] Réponse IA générée"), 800));
                
            default:
                throw new Error(`Provider '${provider}' non supporté.`);
        }
    },

    async standardChatCompletion(config, prompt) {
        const url = config.endpoint.endsWith('/chat/completions') 
            ? config.endpoint 
            : `${config.endpoint.replace(/\/$/, '')}/chat/completions`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [{ role: "user", content: prompt }],
                    temperature: config.temperature || 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Erreur API (${response.status}): ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return this.extractContent(data);
        } catch (error) {
            // Diagnostic amélioré
            if (error.message.includes('Failed to fetch')) {
                throw new Error("Impossible de contacter l'API. Vérifiez votre connexion internet ou les restrictions CORS de votre navigateur.");
            }
            throw error;
        }
    },

    // Format spécifique LM Studio
    async lmStudioDirect(config, prompt) {
        const headers = { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey || 'lm-studio'}`
        };

        const body = {
            model: config.model,
            input: prompt,
            temperature: config.temperature || 0.7
        };

        try {
            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
            const data = await response.json();
            return this.extractContent(data);
        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error("Connexion refusée. Vérifiez que le serveur local est lancé.");
            }
            throw error;
        }
    },

    extractContent(data) {
        if (data.output && Array.isArray(data.output)) {
            const msg = data.output.find(item => item.type === 'message');
            if (msg && msg.content) return msg.content.trim();
        }
        if (data.choices && data.choices[0]?.message?.content) {
            return data.choices[0].message.content.trim();
        }
        if (typeof data.content === 'string') return data.content.trim();
        if (typeof data.output === 'string') return data.output.trim();
        if (data.message?.content) return data.message.content.trim();

        console.warn("Format inconnu:", data);
        return "Format de réponse inconnu";
    }
};

window.ApiService = ApiService;