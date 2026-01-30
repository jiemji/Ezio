/**
 * Service d'abstraction API IA - Version Compatible (OpenAI, LM Studio, Reasoning Models)
 */
const ApiService = {
    async fetchLLM(config, prompt) {
        if (!config || !config.provider) throw new Error("Configuration IA manquante.");
        
        const provider = config.provider.toLowerCase();

        switch (provider) {
            case 'lmstudio':
                // Détection de l'endpoint spécifique LM Studio
                if (config.endpoint.endsWith('/api/v1/chat')) {
                    return await this.lmStudioDirect(config, prompt);
                }
                return await this.standardChatCompletion(config, prompt);
            
            case 'openai':
            case 'groq':
                return await this.standardChatCompletion(config, prompt);
            
            case 'mock':
                return new Promise(res => setTimeout(() => res("[TEST] Réponse simulée"), 800));
                
            default:
                throw new Error(`Provider '${provider}' non supporté.`);
        }
    },

    /**
     * Gestion spécifique pour LM Studio direct
     */
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
            console.error("Erreur Fetch LM Studio:", error);
            throw error;
        }
    },

    /**
     * Standard OpenAI (v1/chat/completions)
     */
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

    /**
     * Fonction de nettoyage intelligente
     * Gère : OpenAI standard, LM Studio simple, et les modèles avec "reasoning" (tableau d'outputs)
     */
    extractContent(data) {
        // 1. Cas Spécifique "Reasoning/Chain of Thought" (Votre cas actuel)
        // Format: { output: [ {type: "reasoning", ...}, {type: "message", content: "..."} ] }
        if (data.output && Array.isArray(data.output)) {
            // On cherche l'élément qui est le message final
            const finalMessage = data.output.find(item => item.type === 'message');
            if (finalMessage && finalMessage.content) {
                return finalMessage.content.trim();
            }
        }

        // 2. Cas Standard OpenAI (choices -> message -> content)
        if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
            const firstChoice = data.choices[0];
            if (firstChoice.message && firstChoice.message.content) {
                return firstChoice.message.content.trim();
            }
        }

        // 3. Cas LM Studio simple (content à la racine)
        if (data.content && typeof data.content === 'string') {
            return data.content.trim();
        }

        // 4. Cas Output simple (string)
        if (data.output && typeof data.output === 'string') {
            return data.output.trim();
        }

        // 5. Cas Message isolé
        if (data.message && data.message.content) {
            return data.message.content.trim();
        }

        // DEBUG : Si aucun format ne correspond
        console.warn("Format inconnu :", data);
        return JSON.stringify(data);
    }
};

window.ApiService = ApiService;