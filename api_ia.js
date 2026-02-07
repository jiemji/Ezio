/**
 * Service API IA - Version Finale Robuste
 * Gère : OpenAI, LM Studio (API standard & spécifique), Groq
 */
const ApiService = {
    async fetchLLM(config, messages) {
        if (!config || !config.provider) throw new Error("Configuration IA manquante.");

        const provider = config.provider.toLowerCase();

        // Support de l'ancien format (backward compatibility) ou format direct
        // Si 'messages' est une string, on la convertit en structure message simple
        let finalMessages = messages;
        if (typeof messages === 'string') {
            finalMessages = [{ role: "user", content: messages }];
        }

        switch (provider) {
            case 'lmstudio':
                if (config.endpoint.endsWith('/api/v1/chat')) {
                    return await this.lmStudioDirect(config, finalMessages);
                }
                return await this.standardChatCompletion(config, finalMessages);

            case 'openai':
            case 'groq':
                return await this.standardChatCompletion(config, finalMessages);

            case 'mock':
                return new Promise(res => setTimeout(() => res("[MOCK] Réponse IA générée"), 800));

            default:
                throw new Error(`Provider '${provider}' non supporté.`);
        }
    },

    async standardChatCompletion(config, messages) {
        const url = config.endpoint.endsWith('/chat/completions')
            ? config.endpoint
            : `${config.endpoint.replace(/\/$/, '')}/chat/completions`;

        // Pré-traitement pour serialiser le contenu mixte si l'API ne le supporte pas nativement
        // (La plupart des API OpenAI-like attendant [ { type: text, text: ...} ] ou juste string)
        // Ici on va stringify les objets dans le tableau content pour éviter le rejet
        const sanitizedMessages = messages.map(m => {
            if (Array.isArray(m.content)) {
                // On transforme le tableau [ "prompt", { obj } ] en une seule string
                // pour maximiser la compatibilité, sauf si on est sûr que l'API mange du JSON mixte
                const contentStr = m.content.map(c => {
                    if (typeof c === 'object') return JSON.stringify(c, null, 2);
                    return c;
                }).join("\n\nContexte JSON :\n");
                return { ...m, content: contentStr };
            }
            return m;
        });

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: sanitizedMessages, // On envoie les messages nettoyés
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
    async lmStudioDirect(config, messages) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey || 'lm-studio'}`
        };

        // Transformation demandée : Flattened array of text parts
        // "input": [ {type: "text", content: ...}, ... ]

        let inputPayload = [];

        if (Array.isArray(messages)) {
            for (const msg of messages) {
                // 1. System Prompt
                if (msg.role === 'system') {
                    inputPayload.push({ type: "text", content: msg.content });
                }
                // 2. User Prompt & Context
                else if (msg.role === 'user') {
                    if (Array.isArray(msg.content)) {
                        // Structure attendue issue de app_audit.js: [ promptString, contextObject ]
                        const promptStr = msg.content[0];
                        const contextObj = msg.content[1];

                        // A. Le prompt de la colonne IA
                        if (promptStr) {
                            inputPayload.push({ type: "text", content: String(promptStr) });
                        }

                        // B. Les colonnes du contexte
                        if (contextObj && typeof contextObj === 'object') {
                            Object.entries(contextObj).forEach(([colName, colValue]) => {
                                inputPayload.push({
                                    type: "text",
                                    content: `${colName}:\n${colValue}`
                                });
                            });
                        }
                    } else {
                        // Fallback si on reçoit juste une string
                        inputPayload.push({ type: "text", content: String(msg.content) });
                    }
                }
            }
        }

        const body = {
            model: config.model,
            input: inputPayload,
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