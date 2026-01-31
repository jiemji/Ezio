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
                // Détection auto de l'endpoint spécifique LM Studio
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

    // Format spécifique LM Studio
    async lmStudioDirect(config, prompt) {
        const headers = { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey || 'lm-studio'}`
        };

        const body = {
            model: config.model,
            input: prompt,
            temperature: config.temperature || 0.7,
            context_length: config.context_length || 8000
        };
        if (config.integrations) body.integrations = config.integrations;

        try {
            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error(`Erreur LM Studio: ${response.status}`);
            const data = await response.json();
            return this.extractContent(data);
        } catch (error) {
            console.error("Erreur Fetch:", error);
            throw error;
        }
    },

    // Standard OpenAI (v1/chat/completions)
    async standardChatCompletion(config, prompt) {
        const headers = { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        };

        try {
            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: config.model,
                    messages: [{ role: "user", content: prompt }],
                    temperature: config.temperature || 0.7
                })
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

    // Nettoyage intelligent de la réponse
    extractContent(data) {
        // 1. Modèles "Reasoning" (Tableau d'outputs)
        if (data.output && Array.isArray(data.output)) {
            const msg = data.output.find(item => item.type === 'message');
            if (msg && msg.content) return msg.content.trim();
        }
        // 2. OpenAI Standard
        if (data.choices && data.choices[0]?.message?.content) {
            return data.choices[0].message.content.trim();
        }
        // 3. LM Studio simple / Autres
        if (typeof data.content === 'string') return data.content.trim();
        if (typeof data.output === 'string') return data.output.trim();
        if (data.message?.content) return data.message.content.trim();

        console.warn("Format inconnu:", data);
        return typeof data === 'object' ? JSON.stringify(data) : String(data);
    }
};

window.ApiService = ApiService;