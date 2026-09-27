/**
 * ============================================================================
 * AIDialogueSystem.js
 * In Search of Hope: The Ashen Bastion
 *
 * Implements the In-Game Gothic Oracle & Smart NPC Dialogue System.
 * Connects directly to the Vercel Serverless Function (/api/chat) powered by
 * Google Gemini.
 * ============================================================================
 */

(function (window) {
    'use strict';

    /**
     * @typedef {Object} DialogueMessage
     * @property {'player'|'oracle'} sender
     * @property {string} text
     * @property {string} [name]
     */

    const PERSONA_CONFIG = {
        loremaster: {
            id: 'loremaster',
            name: 'Mestre das Cinzas',
            title: 'Oráculo da Fenda Abissal',
            sigil: 'ᛟ',
            welcome: 'Aproxime-se das brasas, penitente. Diga-me, o que sua alma atormentada busca nas profundezas da Fenda Abissal?',
            quickPrompts: [
                'Quem é você e qual seu propósito?',
                'Como derroto os horrores da Fenda?',
                'Qual é a história do Último Bastião?',
                'O que é a Busca pela Esperança?'
            ]
        },
        blacksmith: {
            id: 'blacksmith',
            name: 'Kaelen',
            title: 'Ferreiro das Chamas Frias',
            sigil: '🜛',
            welcome: 'Se veio atrás de aço temperado e lâminas afiadas contra as abominações, você encontrou a bigorna certa. O que você quer?',
            quickPrompts: [
                'Como aprimoro meu equipamento?',
                'Qual o segredo da têmpera perfeita?',
                'Que materiais encontro nas masmorras?'
            ]
        },
        alchemist: {
            id: 'alchemist',
            name: 'Morvath',
            title: 'O Alquimista Cego',
            sigil: '🜂',
            welcome: 'Mesmo sem olhos, posso sentir o cheiro do medo e do sangue em sua armadura. Os vapores do caldeirão sussurram segredos... O que suas dores demandam?',
            quickPrompts: [
                'Como destilo poções mais potentes?',
                'Quais são os efeitos das essências mágicas?',
                'O que o caldeirão revela sobre meu destino?'
            ]
        },
        merchant: {
            id: 'merchant',
            name: 'Vesper',
            title: 'Mercadora das Cinzas',
            sigil: '🜚',
            welcome: 'Tudo tem um preço, forasteiro. O ouro faz até as almas perdidas dançarem neste bastião decrépito. Veio negociar ou apenas desperdiçar meu tempo?',
            quickPrompts: [
                'Por que suas mercadorias são tão caras?',
                'Como consigo mais ouro rapidamente?',
                'Quais riquezas se escondem na Fenda?'
            ]
        }
    };

    class AIDialogueSystemClass {
        /**
         * @param {Object} [gameState]
         */
        constructor(gameState) {
            this.gameState = gameState || window.gameState;
            this.activePersona = 'loremaster';
            this.isOpen = false;
            this.isBusy = false;
            
            /** @type {Record<string, DialogueMessage[]>} */
            this.history = {
                loremaster: [],
                blacksmith: [],
                alchemist: [],
                merchant: []
            };

            this.dom = {
                overlay: null,
                window: null,
                headerTitle: null,
                headerSubtitle: null,
                headerSigil: null,
                personasBar: null,
                messagesArea: null,
                quickPrompts: null,
                input: null,
                sendBtn: null,
                closeBtn: null,
                hudBtn: null
            };

            this._onKeyDown = this._onKeyDown.bind(this);
        }

        /**
         * Inicializa a interface e escutadores de eventos.
         */
        init() {
            try {
                this._buildDOM();
                this._attachListeners();
                this._setPersona(this.activePersona, false);
                console.log('[AIDialogueSystem] Inicializado com sucesso.');
            } catch (err) {
                console.error('[AIDialogueSystem] Erro durante a inicialização:', err);
            }
        }

        /**
         * Constrói a estrutura visual do modal gótico.
         * @private
         */
        _buildDOM() {
            // Se já existe no DOM, evita duplicidade
            if (document.getElementById('oracle-modal-overlay')) {
                this._bindExistingElements();
                return;
            }

            const overlay = document.createElement('div');
            overlay.id = 'oracle-modal-overlay';
            overlay.className = 'oracle-modal-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');

            overlay.innerHTML = `
                <div class="oracle-dialogue-window" id="oracle-dialogue-window">
                    <!-- Cabeçalho -->
                    <div class="oracle-header">
                        <div class="oracle-header-title-box">
                            <span class="oracle-sigil" id="oracle-sigil">ᛟ</span>
                            <div>
                                <h3 class="oracle-title" id="oracle-title">Oráculo das Cinzas</h3>
                                <p class="oracle-subtitle" id="oracle-subtitle">Comunhão com o Mestre das Cinzas</p>
                            </div>
                        </div>
                        <button class="oracle-close-btn" id="oracle-close-btn" title="Fechar (ESC)">✕</button>
                    </div>

                    <!-- Seletor de Personas -->
                    <div class="oracle-personas-bar" id="oracle-personas-bar">
                        <button class="persona-tab active" data-persona="loremaster">
                            <span class="rune-icon">ᛟ</span> Mestre das Cinzas
                        </button>
                        <button class="persona-tab" data-persona="blacksmith">
                            <span class="rune-icon">🜛</span> Kaelen (Ferreiro)
                        </button>
                        <button class="persona-tab" data-persona="alchemist">
                            <span class="rune-icon">🜂</span> Morvath (Alquimista)
                        </button>
                        <button class="persona-tab" data-persona="merchant">
                            <span class="rune-icon">🜚</span> Vesper (Mercadora)
                        </button>
                    </div>

                    <!-- Mensagens -->
                    <div class="oracle-messages-area" id="oracle-messages-area"></div>

                    <!-- Sugestões Rápidas -->
                    <div class="oracle-quick-prompts" id="oracle-quick-prompts"></div>

                    <!-- Entrada de Texto -->
                    <div class="oracle-input-bar">
                        <input type="text" class="oracle-input" id="oracle-input" placeholder="Faça sua indagação ao oráculo..." maxlength="500" autocomplete="off" />
                        <button class="oracle-send-btn" id="oracle-send-btn">
                            <span class="rune-icon">ᛏ</span> Perguntar
                        </button>
                    </div>

                    <!-- Rodapé de Status -->
                    <div class="oracle-status-footer">
                        <span>Vínculo Arcano: <strong class="status-cloud">Gemini 2.5 Flash</strong></span>
                        <span>[Atalho: Tecla O]</span>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            this._bindExistingElements();
        }

        /**
         * Associa referências de elementos ao DOM interno.
         * @private
         */
        _bindExistingElements() {
            this.dom.overlay        = document.getElementById('oracle-modal-overlay');
            this.dom.window         = document.getElementById('oracle-dialogue-window');
            this.dom.headerSigil    = document.getElementById('oracle-sigil');
            this.dom.headerTitle    = document.getElementById('oracle-title');
            this.dom.headerSubtitle = document.getElementById('oracle-subtitle');
            this.dom.personasBar    = document.getElementById('oracle-personas-bar');
            this.dom.messagesArea   = document.getElementById('oracle-messages-area');
            this.dom.quickPrompts   = document.getElementById('oracle-quick-prompts');
            this.dom.input          = document.getElementById('oracle-input');
            this.dom.sendBtn        = document.getElementById('oracle-send-btn');
            this.dom.closeBtn       = document.getElementById('oracle-close-btn');
            this.dom.hudBtn         = document.getElementById('btn-oracle');
        }

        /**
         * Registra escutadores de eventos de clique, tecla e atalhos globais.
         * @private
         */
        _attachListeners() {
            // Botão no Top HUD
            this.dom.hudBtn?.addEventListener('click', () => {
                this.toggle();
            });

            // Fechar modal
            this.dom.closeBtn?.addEventListener('click', () => this.close());
            this.dom.overlay?.addEventListener('click', (e) => {
                if (e.target === this.dom.overlay) this.close();
            });

            // Enviar mensagem
            this.dom.sendBtn?.addEventListener('click', () => this.sendCurrentInput());
            this.dom.input?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendCurrentInput();
                }
            });

            // Troca de personas
            this.dom.personasBar?.addEventListener('click', (e) => {
                const btn = e.target.closest('.persona-tab');
                if (btn && btn.dataset.persona) {
                    this._playAudioSFX(700);
                    this._setPersona(btn.dataset.persona);
                }
            });

            // Atalho global (Tecla 'O' para Oráculo, e ESC para fechar)
            window.addEventListener('keydown', this._onKeyDown);
        }

        /**
         * Gerenciador de teclas globais.
         * @param {KeyboardEvent} e
         * @private
         */
        _onKeyDown(e) {
            // Ignora se estiver digitando em outros inputs (exceto o próprio input do oráculo para fechar com ESC)
            const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            const isTyping = (activeTag === 'input' || activeTag === 'textarea');

            if (e.key === 'Escape' && this.isOpen) {
                e.preventDefault();
                this.close();
                return;
            }

            if ((e.key === 'o' || e.key === 'O') && !isTyping) {
                e.preventDefault();
                this.toggle();
            }
        }

        /**
         * Abre o painel do Oráculo.
         * @param {string} [persona]
         */
        open(persona) {
            if (persona && PERSONA_CONFIG[persona]) {
                this._setPersona(persona, false);
            }
            this.isOpen = true;
            this.dom.overlay?.classList.add('active');
            this._playAudioSFX(620);
            
            setTimeout(() => {
                this.dom.input?.focus();
                this._scrollToBottom();
            }, 100);
        }

        /**
         * Fecha o painel do Oráculo.
         */
        close() {
            this.isOpen = false;
            this.dom.overlay?.classList.remove('active');
            this._playAudioSFX(450);
        }

        /**
         * Alterna entre aberto e fechado.
         */
        toggle() {
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
            }
        }

        /**
         * Altera a persona ativa (Mestre, Ferreiro, etc.).
         * @param {string} personaKey
         * @param {boolean} [render=true]
         * @private
         */
        _setPersona(personaKey, render = true) {
            const config = PERSONA_CONFIG[personaKey] || PERSONA_CONFIG.loremaster;
            this.activePersona = config.id;

            // Atualiza cabeçalho
            if (this.dom.headerSigil) this.dom.headerSigil.textContent = config.sigil;
            if (this.dom.headerTitle) this.dom.headerTitle.textContent = config.name;
            if (this.dom.headerSubtitle) this.dom.headerSubtitle.textContent = config.title;

            // Atualiza abas ativas
            if (this.dom.personasBar) {
                const tabs = this.dom.personasBar.querySelectorAll('.persona-tab');
                tabs.forEach(tab => {
                    tab.classList.toggle('active', tab.dataset.persona === config.id);
                });
            }

            // Atualiza sugestões rápidas
            this._renderQuickPrompts(config.quickPrompts);

            // Se for a primeira vez nessa persona, adiciona mensagem de boas-vindas
            if (!this.history[config.id] || this.history[config.id].length === 0) {
                this.history[config.id] = [
                    { sender: 'oracle', name: config.name, text: config.welcome }
                ];
            }

            if (render) {
                this._renderMessages();
            }
        }

        /**
         * Renderiza as pílulas de perguntas rápidas.
         * @param {string[]} prompts
         * @private
         */
        _renderQuickPrompts(prompts) {
            if (!this.dom.quickPrompts) return;
            this.dom.quickPrompts.innerHTML = '';

            prompts.forEach(text => {
                const pill = document.createElement('button');
                pill.className = 'quick-prompt-btn';
                pill.textContent = text;
                pill.addEventListener('click', () => {
                    if (this.isBusy) return;
                    this.sendMessage(text);
                });
                this.dom.quickPrompts.appendChild(pill);
            });
        }

        /**
         * Renderiza o histórico de mensagens da persona atual.
         * @private
         */
        _renderMessages() {
            if (!this.dom.messagesArea) return;
            this.dom.messagesArea.innerHTML = '';

            const msgs = this.history[this.activePersona] || [];
            msgs.forEach(msg => {
                this._appendMessageToDOM(msg.sender, msg.name || 'Oráculo', msg.text);
            });

            this._scrollToBottom();
        }

        /**
         * Anexa uma bolha de mensagem ao DOM.
         * @param {'player'|'oracle'} sender
         * @param {string} senderName
         * @param {string} text
         * @private
         */
        _appendMessageToDOM(sender, senderName, text) {
            const row = document.createElement('div');
            row.className = `chat-msg ${sender}`;

            const config = PERSONA_CONFIG[this.activePersona] || PERSONA_CONFIG.loremaster;
            const sigil = sender === 'player' ? '⚔' : config.sigil;

            row.innerHTML = `
                <div class="chat-avatar">${sigil}</div>
                <div class="chat-bubble">
                    <span class="chat-sender-name">${senderName}</span>
                    <div class="chat-text">${this._escapeHTML(text)}</div>
                </div>
            `;

            this.dom.messagesArea?.appendChild(row);
        }

        /**
         * Extrai contexto atual do jogador para injetar no Gemini.
         * @returns {Object}
         * @private
         */
        _extractPlayerContext() {
            const gs = this.gameState || window.gameState;
            if (!gs) return {};

            const char = gs.character || {};
            const res = gs.resources || {};

            let loc = 'Acampamento do Bastião';
            if (document.getElementById('dungeon-screen')?.classList?.contains('active') ||
                document.querySelector('.tab-btn[data-tab="dungeon"]')?.classList?.contains('active')) {
                loc = 'Profundezas da Masmorra';
            }

            return {
                className: char.className || char.classId || 'Campeão das Cinzas',
                level: char.level || 1,
                hp: char.currentHp || 100,
                maxHp: char.maxHp || 100,
                gold: res.gold || 0,
                location: loc
            };
        }

        /**
         * Envia o texto digitado pelo jogador.
         */
        sendCurrentInput() {
            if (!this.dom.input) return;
            const text = this.dom.input.value.trim();
            if (!text || this.isBusy) return;

            this.dom.input.value = '';
            this.sendMessage(text);
        }

        /**
         * Processa e envia uma mensagem para a API na Vercel.
         * @param {string} messageText
         */
        async sendMessage(messageText) {
            if (!messageText || this.isBusy) return;

            const persona = this.activePersona;
            const personaCfg = PERSONA_CONFIG[persona];
            const playerName = this.gameState?.character?.name || 'Penitente';

            // 1. Registra mensagem do jogador no DOM e histórico
            this.history[persona].push({
                sender: 'player',
                name: playerName,
                text: messageText
            });
            this._appendMessageToDOM('player', playerName, messageText);
            this._scrollToBottom();

            // 2. Estado de Carregamento
            this.isBusy = true;
            this._setBusyState(true);
            const loaderRow = this._showContemplationIndicator(personaCfg.name);

            try {
                const context = this._extractPlayerContext();

                // Chamada à Serverless Function da Vercel
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: messageText,
                        persona: persona,
                        context: context
                    })
                });

                // Remove o indicador de carregamento
                loaderRow?.remove();

                if (!response.ok) {
                    let errorData = null;
                    try {
                        errorData = await response.json();
                    } catch (e) {}

                    // Mensagem informativa e segura caso esteja em localhost sem o endpoint da Vercel
                    if (response.status === 404 || window.location.protocol === 'file:') {
                        const fallbackText = `[Sussurro das Cinzas]: Quando este jogo for publicado na sua conta da Vercel, a rota /api/chat estará ativa e conectada ao Gemini diretamente na nuvem! No ambiente local offline (file://), o oráculo repousa em silêncio.`;
                        this._handleReply(persona, personaCfg.name, fallbackText);
                        return;
                    }

                    const errDesc = errorData?.error || `Erro de conexão (${response.status}).`;
                    this._handleReply(persona, personaCfg.name, `[O oráculo vacila diante da fenda]: ${errDesc}`);
                    return;
                }

                const data = await response.json();
                const reply = data.reply || '...apenas o sussurro do vento responde.';
                this._handleReply(persona, personaCfg.name, reply);

            } catch (err) {
                loaderRow?.remove();
                console.warn('[AIDialogueSystem] Erro na requisição:', err);

                let advice = `[Sussurro Arcano]: A comunhão com a nuvem da Vercel falhou ou você está executando em arquivo local. Ao fazer o deploy na Vercel com a variável GOOGLE_GENERATIVE_AI_API_KEY, a inteligência responderá ao vivo!`;
                this._handleReply(persona, personaCfg.name, advice);
            } finally {
                this.isBusy = false;
                this._setBusyState(false);
            }
        }

        /**
         * Registra e exibe a resposta recebida.
         * @private
         */
        _handleReply(persona, senderName, text) {
            this.history[persona].push({
                sender: 'oracle',
                name: senderName,
                text: text
            });
            this._appendMessageToDOM('oracle', senderName, text);
            this._scrollToBottom();
            this._playAudioSFX(880);
        }

        /**
         * Exibe o indicador de "contemplando as cinzas...".
         * @param {string} name
         * @returns {HTMLElement}
         * @private
         */
        _showContemplationIndicator(name) {
            const row = document.createElement('div');
            row.className = 'chat-msg oracle';
            row.innerHTML = `
                <div class="chat-avatar">${PERSONA_CONFIG[this.activePersona].sigil}</div>
                <div class="chat-bubble">
                    <span class="chat-sender-name">${name}</span>
                    <div class="oracle-contemplating">
                        <span>Contemplando as cinzas da Fenda</span>
                        <div class="ember-dots"><span>.</span><span>.</span><span>.</span></div>
                    </div>
                </div>
            `;
            this.dom.messagesArea?.appendChild(row);
            this._scrollToBottom();
            return row;
        }

        /**
         * Altera o estado dos botões durante a requisição.
         * @param {boolean} busy
         * @private
         */
        _setBusyState(busy) {
            if (this.dom.sendBtn) this.dom.sendBtn.disabled = busy;
            if (this.dom.input) this.dom.input.disabled = busy;
        }

        /**
         * Rola a área de mensagens para o final.
         * @private
         */
        _scrollToBottom() {
            if (this.dom.messagesArea) {
                this.dom.messagesArea.scrollTop = this.dom.messagesArea.scrollHeight;
            }
        }

        /**
         * Executa efeito sonoro se o AudioManager estiver ativo.
         * @param {number} freq
         * @private
         */
        _playAudioSFX(freq) {
            try {
                if (window.AudioManager && typeof window.AudioManager.playClick === 'function') {
                    window.AudioManager.playClick(freq);
                }
            } catch (e) {}
        }

        /**
         * Higieniza texto contra injeção de HTML.
         * @param {string} str
         * @returns {string}
         * @private
         */
        _escapeHTML(str) {
            return (str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
    }

    // Exposição Global
    window.AIDialogueSystem = AIDialogueSystemClass;

    // Inicialização automática segura no DOMContentLoaded
    if (typeof document !== 'undefined') {
        const autoInit = () => {
            if (!window.aiDialogueSystem) {
                window.aiDialogueSystem = new AIDialogueSystemClass(window.gameState);
                window.aiDialogueSystem.init();
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', autoInit);
        } else {
            autoInit();
        }
    }

})(window);
