/**
 * Service d'abstraction API IA - Mis à jour pour le format spécifique LM Studio
 */
const ApiService = {
    async fetchLLM(config, prompt) {
        if (!config || !config.provider) throw new Error("Configuration IA manquante.");
        
        const provider = config.provider.toLowerCase();

        switch (provider) {
            case 'lmstudio':
                // On vérifie si l'URL se termine par /api/v1/chat pour utiliser le format spécifique
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
     * Format spécifique LM Studio (basé sur ta documentation)
     */
    async lmStudioDirect(config, prompt) {
        const headers = { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey || 'lm-studio'}`
        };

        const body = {
            model: config.model,
            input: prompt, // Syntaxe spécifique "input" au lieu de "messages"
            temperature: config.temperature || 0,
            context_length: config.context_length || 8000
        };

        // Optionnel : Ajout des intégrations si présentes dans la config
        if (config.integrations) body.integrations = config.integrations;

        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error(`Erreur LM Studio Direct: ${response.status}`);

        const data = await response.json();
        
        // Attention : la structure de réponse peut varier, 
        // généralement le texte est dans data.output ou data.content
        return data.output || data.content || JSON.stringify(data);
    },

    /**
     * Standard OpenAI / Compatible (v1/chat/completions)
     */
    async standardChatCompletion(config, prompt) {
        const headers = { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        };

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
        return data.choices[0].message.content.trim();
    }
};

window.ApiService = ApiService;