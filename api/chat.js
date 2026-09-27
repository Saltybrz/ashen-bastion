/**
 * ============================================================================
 * api/chat.js — Vercel Serverless Function for Gemini AI
 * In Search of Hope: The Ashen Bastion
 *
 * Implements intelligent NPC / Loremaster dialogue using Google Gemini.
 * Securely uses process.env.GOOGLE_GENERATIVE_AI_API_KEY without exposing it
 * to the client browser.
 * ============================================================================
 */

// Persona Lore Prompts for In Search of Hope
const PERSONA_PROMPTS = {
    loremaster: `Você é o "Mestre das Cinzas" (The Ashen Loremaster), uma entidade ancestral e enigmática que observa o Último Bastião no RPG de fantasia sombria "In Search of Hope: The Ashen Bastion".
Seu tom é solene, poético, misterioso e imersivo, como no universo de Dark Souls e Elden Ring.
Você comenta sobre a penitência do jogador, as profundezas da Fenda Abissal, os horrores dos chefes e a tênue chama de esperança.
Responda sempre em Português do Brasil de forma concisa (máximo 2 a 3 parágrafos breves), evitando enrolação. Nunca saia do personagem.`,

    blacksmith: `Você é Kaelen, o Ferreiro das Chamas Frias no Último Bastião ("In Search of Hope").
Você é um homem pragmático, austero, de voz ríspida, mas respeitoso para com quem empunha aço e derrama sangue nas masmorras.
Você fala sobre forjar, temperar ligas ancestrais, o valor do minério e a durabilidade das armas.
Responda em Português do Brasil de forma concisa (1 a 2 parágrafos curtos). Nunca saia do personagem.`,

    alchemist: `Você é Morvath, o Alquimista Cego de "In Search of Hope: The Ashen Bastion".
Você perdeu os olhos ao contemplar os vapores do Caldeirão Abissal, mas enxerga a essência de ervas, cinzas e sangue.
Você fala com sussurros misteriosos sobre elixires, tônicos e transmutações.
Responda em Português do Brasil de forma concisa (1 a 2 parágrafos curtos). Nunca saia do personagem.`,

    merchant: `Você é Vesper, a Mercadora das Cinzas no Último Bastião ("In Search of Hope").
Você é astuta, cínica, mas leal a quem traz ouro e relíquias da Fenda. Para você, até a esperança tem um preço em moedas de ouro.
Responda em Português do Brasil de forma concisa e com um leve toque sarcástico. Nunca saia do personagem.`
};

module.exports = async function handler(req, res) {
    // 1. Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize requisições POST.' });
    }

    try {
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                error: 'Chave de API (GOOGLE_GENERATIVE_AI_API_KEY) não encontrada nas variáveis de ambiente da Vercel.'
            });
        }

        // Parse and validate body
        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (pErr) {
                return res.status(400).json({ error: 'Corpo da requisição inválido (JSON malformado).' });
            }
        }
        body = body || {};

        const userMessage = (body.message || '').toString().trim();
        const personaKey = (body.persona || 'loremaster').toLowerCase();
        const playerContext = body.context || {};

        if (!userMessage) {
            return res.status(400).json({ error: 'A mensagem do jogador não pode estar vazia.' });
        }

        if (userMessage.length > 600) {
            return res.status(400).json({ error: 'A mensagem excede o limite máximo permitido de 600 caracteres.' });
        }

        const systemPrompt = PERSONA_PROMPTS[personaKey] || PERSONA_PROMPTS.loremaster;

        // Construir contexto dinâmico do estado do jogo
        let contextText = '';
        if (playerContext.className || playerContext.level) {
            contextText = `\n[Contexto Atual do Jogador no Jogo]:\n- Classe: ${playerContext.className || 'Guerreiro'}\n- Nível: ${playerContext.level || 1}\n- Vida: ${playerContext.hp || 100}/${playerContext.maxHp || 100}\n- Localização: ${playerContext.location || 'Acampamento do Bastião'}\n- Ouro: ${playerContext.gold || 0}\n`;
        }

        const fullPrompt = `${contextText}\nO jogador fala com você: "${userMessage}"`;

        // Request Payload para Gemini API v1beta
        const requestPayload = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: fullPrompt }]
                }
            ],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: 0.75,
                maxOutputTokens: 400
            }
        };

        // Fallback progressivo de modelos
        const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
        let lastError = null;
        let responseData = null;

        for (const model of models) {
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestPayload)
                    }
                );

                if (response.ok) {
                    responseData = await response.json();
                    break;
                } else {
                    const errText = await response.text();
                    lastError = `Modelo ${model} retornou ${response.status}: ${errText}`;
                }
            } catch (err) {
                lastError = err.message;
            }
        }

        if (!responseData || !responseData.candidates || !responseData.candidates[0]) {
            throw new Error(lastError || 'Não foi possível obter resposta do oráculo.');
        }

        const replyText = responseData.candidates[0].content?.parts?.[0]?.text || '...o eco das cinzas silencia qualquer resposta.';

        return res.status(200).json({
            reply: replyText,
            persona: personaKey
        });

    } catch (err) {
        console.error('[API Chat Error]:', err);
        return res.status(500).json({
            error: 'O véu das cinzas perturbou a comunhão com o oráculo.',
            details: err.message
        });
    }
};
