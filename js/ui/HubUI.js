/**
 * ============================================
 *  HUB UI
 *  Renders gathering nodes, workers, camp
 *  upgrades, and the 2D Walkable Courtyard
 *  (O Pátio da Vila) in the Hub tab.
 * ============================================
 */

class HubUI {
    constructor(state, idleEngine, uiManager) {
        /** @type {StateManager} */
        this.state = state;
        /** @type {IdleEngine} */
        this.idleEngine = idleEngine;
        /** @type {UIManager} */
        this.uiManager = uiManager;

        // Virtual Canonical Resolution (1376x768 matches the map artwork)
        this.courtyardW = 1376;
        this.courtyardH = 768;

        this.dom = {
            nodesContainer:      document.getElementById('gathering-nodes'),
            workersList:         document.getElementById('workers-list'),
            upgradesList:        document.getElementById('upgrades-list'),
            keyCost:             document.getElementById('key-cost'),
            btnForgeKey:         document.getElementById('btn-forge-key'),
            dungeonKeysCount:    document.getElementById('dungeon-keys-count'),
            courtyardCanvas:     document.getElementById('hub-canvas') || document.getElementById('hub-courtyard-canvas'),
            courtyardPrompt:     document.getElementById('courtyard-prompt'),
            courtyardPromptText: document.getElementById('courtyard-prompt-text'),
            courtyardWrapper:    document.getElementById('courtyard-wrapper'),
            managementPanel:     document.getElementById('hub-management-panel'),
        };

        // Node card DOM references for fast updates
        this._nodeCards = {};

        // Courtyard Controller (O Pátio da Vila)
        this.courtyardCtx = this.dom.courtyardCanvas ? this.dom.courtyardCanvas.getContext('2d') : null;
        if (this.dom.courtyardCanvas) {
            this.dom.courtyardCanvas.width = this.courtyardW;
            this.dom.courtyardCanvas.height = this.courtyardH;
        }

        // Dual Image Loading with Fail-Safe Preloader & Fallback
        this.bgLoaded = false;
        this.courtyardBg = null;

        // Hero in Courtyard: centered at (688, 384)
        const self = this;
        this.hero = {
            x: 688,
            y: 384,
            radius: 20,
            speed: 220,
            facing: { x: 0, y: 1 },
            targetPos: null,
            targetStation: null,
            get spriteKey() {
                return (typeof EntityRenderer !== 'undefined' ? EntityRenderer.getPlayerSpriteKey(self.state.character) : 'base_mannequin');
            },
            get sprite() {
                const key = this.spriteKey;
                return (typeof AssetManager !== 'undefined' ? AssetManager.get(key) : null);
            },
            frameWidth: 64,
            frameHeight: 64,
            width: 64,
            height: 64,
        };

        this.hubKeys = {};
        this.triggerZones = [];
        this.activeTriggerZone = null;
        this._courtyardAnimId = null;
        this._lastCourtyardTick = performance.now();
        this._courtyardInitialized = false;
        this._floatingWidgetInitialized = false;
        this._eventsBound = false;
        this._subnavInitialized = false;
        this._uiLoopInterval = null;
        this.currentViewMode = 'split'; // Default: view courtyard + gathering integrated

        // Initialize map asset via HubEngine or loadGameAsset if available
        if (window.HubEngine && window.HubEngine.hubMapAsset) {
            this.initCourtyardMap(window.HubEngine.hubMapAsset);
        } else if (typeof loadGameAsset === 'function') {
            loadGameAsset('./assets/maps/hub_courtyard.jpg', 1500).then(asset => {
                this.initCourtyardMap(asset);
            });
        } else {
            // Protected preloading with 1.5s emergency timeout
            const img = new Image();
            let settled = false;
            img.onload = () => {
                if (!settled) {
                    settled = true;
                    this.courtyardBg = img;
                    this.bgLoaded = true;
                    console.log('[HubUI] Primary hub image loaded successfully.');
                }
            };
            img.onerror = () => {
                if (!settled) {
                    settled = true;
                    this.initCourtyardMap({ img: null, loaded: false });
                }
            };
            setTimeout(() => {
                if (!settled) {
                    settled = true;
                    console.warn('[HubUI] Image preloader timeout (1.5s). Engaging fallback.');
                    this.initCourtyardMap({ img: null, loaded: false });
                }
            }, 1500);
            img.src = './assets/maps/hub_courtyard.jpg';
        }

        this._setupTriggerZones();
        console.log('[HubUI] Initialized with Courtyard Controller & Procedural Fallback.');
    }

    /**
     * Initializes or updates the Courtyard background image from preloader.
     * @param {{ img: HTMLImageElement|null, loaded: boolean }} hubMap
     */
    initCourtyardMap(hubMap) {
        if (hubMap && hubMap.loaded && hubMap.img) {
            this.courtyardBg = hubMap.img;
            this.bgLoaded = true;
            console.log('[HubUI] Primary hub image applied successfully (./assets/maps/hub_courtyard.jpg).');
        } else {
            console.warn('[HubUI] Primary hub asset unavailable. Attempting fallback ./VILA UM CERTA.jpg');
            const fallbackImg = new Image();
            fallbackImg.onload = () => {
                this.courtyardBg = fallbackImg;
                this.bgLoaded = true;
                console.log('[HubUI] Fallback hub image loaded successfully (./VILA UM CERTA.jpg).');
            };
            fallbackImg.onerror = () => {
                console.warn('[HubUI] All image assets failed. Engaging fail-safe procedural dark stone courtyard renderer.');
                this.bgLoaded = false;
                this.courtyardBg = null;
            };
            fallbackImg.src = './VILA UM CERTA.jpg';
        }
    }

    /**
     * Re-acquires DOM elements in case they were dynamically created or modified.
     */
    _refreshDomReferences() {
        this.dom.nodesContainer      = document.getElementById('gathering-nodes');
        this.dom.workersList         = document.getElementById('workers-list');
        this.dom.upgradesList        = document.getElementById('upgrades-list');
        this.dom.keyCost             = document.getElementById('key-cost');
        this.dom.btnForgeKey         = document.getElementById('btn-forge-key');
        this.dom.dungeonKeysCount    = document.getElementById('dungeon-keys-count');
        this.dom.courtyardCanvas     = document.getElementById('hub-canvas') || document.getElementById('hub-courtyard-canvas');
        this.dom.courtyardPrompt     = document.getElementById('courtyard-prompt');
        this.dom.courtyardPromptText = document.getElementById('courtyard-prompt-text');
        this.dom.courtyardWrapper    = document.getElementById('courtyard-wrapper');
        this.dom.managementPanel     = document.getElementById('hub-management-panel');

        if (this.dom.courtyardCanvas) {
            this.courtyardCtx = this.dom.courtyardCanvas.getContext('2d');
            this.dom.courtyardCanvas.width = 1376;
            this.dom.courtyardCanvas.height = 768;
        }
    }

    /**
     * Set up the 5 canonical interactive stations on the Courtyard Map.
     */
    _setupTriggerZones() {
        this.triggerZones = [
            {
                id: 'forge',
                name: 'Fornalha e Bigorna',
                prompt: '[E] Forja Ancestral & Aprimoramento',
                x: 420, y: 360, radius: 85,
                icon: '🜛',
                color: '#e67e22',
                action: () => {
                    this.uiManager.switchTab('forge_alchemy');
                    if (window.campServicesUI) window.campServicesUI.switchSubTab('forge');
                }
            },
            {
                id: 'market_alchemy',
                name: 'Tenda das Lanternas Verdes',
                prompt: '[E] Feira das Cinzas & Alquimia',
                x: 960, y: 380, radius: 85,
                icon: '🜚',
                color: '#2ecc71',
                action: () => {
                    this.uiManager.switchTab('market_bounties');
                    if (window.campServicesUI) window.campServicesUI.switchSubTab('market');
                }
            },
            {
                id: 'rift_gate',
                name: 'Arco da Fenda',
                prompt: '[E] Descer à Fenda Abissal',
                x: 688, y: 190, radius: 85,
                icon: '†',
                color: '#9b59b6',
                action: () => {
                    if (this.state.dungeonKeys > 0) {
                        this.uiManager.switchTab('dungeon');
                        const btnEnter = document.getElementById('btn-enter-dungeon');
                        if (btnEnter && !btnEnter.disabled) {
                            btnEnter.click();
                        }
                    } else {
                        this.uiManager.notify('Requer 1 Chave da Fenda! Forje uma ou permute no mercado.', 'error');
                        this.uiManager.switchTab('dungeon');
                    }
                }
            },
            {
                id: 'bounties',
                name: 'Quadro de Madeira',
                prompt: '[E] Editais de Caçada',
                x: 688, y: 540, radius: 85,
                icon: 'ᛏ',
                color: '#f39c12',
                action: () => {
                    this.uiManager.switchTab('market_bounties');
                    if (window.campServicesUI) window.campServicesUI.switchSubTab('bounties');
                }
            },
            {
                id: 'ascension_pyre',
                name: 'Pira Central',
                prompt: '[E] Comunhão com as Cinzas',
                x: 688, y: 384, radius: 60,
                icon: '🜂',
                color: '#cf3a3a',
                action: () => {
                    this.uiManager.showAscensionModal();
                }
            }
        ];
    }

    /**
     * Handles canvas resizing smoothly. Keeps virtual resolution at 1376x768.
     */
    onResize(width, height) {
        this.courtyardW = 1376;
        this.courtyardH = 768;
        if (this.dom.courtyardCanvas) {
            this.dom.courtyardCanvas.width = 1376;
            this.dom.courtyardCanvas.height = 768;
        }
    }

    /**
     * Full render of all Hub sections with error resilience.
     */
    render() {
        this._refreshDomReferences();

        try {
            if (this.dom.nodesContainer) this._renderNodes();
        } catch (err) {
            console.error('[HubUI] Error in _renderNodes:', err);
        }

        try {
            if (this.dom.workersList) this._renderWorkers();
        } catch (err) {
            console.error('[HubUI] Error in _renderWorkers:', err);
        }

        try {
            if (this.dom.upgradesList) this._renderUpgrades();
        } catch (err) {
            console.error('[HubUI] Error in _renderUpgrades:', err);
        }

        try {
            this._renderKeyCost();
        } catch (err) {
            console.error('[HubUI] Error in _renderKeyCost:', err);
        }

        try {
            this._bindEvents();
        } catch (err) {
            console.error('[HubUI] Error in _bindEvents:', err);
        }

        try {
            this._initSubnav();
        } catch (err) {
            console.error('[HubUI] Error in _initSubnav:', err);
        }

        try {
            this._initCourtyard();
        } catch (err) {
            console.error('[HubUI] Error in _initCourtyard:', err);
        }

        try {
            this._initFloatingGatheringWidget();
        } catch (err) {
            console.error('[HubUI] Error in _initFloatingGatheringWidget:', err);
        }

        try {
            this._startUILoop();
        } catch (err) {
            console.error('[HubUI] Error in _startUILoop:', err);
        }
    }

    /**
     * Initializes the subnav view selector (Courtyard vs Gathering vs Workers vs Split).
     */
    _initSubnav() {
        if (this._subnavInitialized) return;
        this._subnavInitialized = true;

        const viewModes = ['courtyard', 'gathering', 'workers', 'split'];
        for (const mode of viewModes) {
            const btn = document.getElementById(`btn-hub-view-${mode}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.switchHubView(mode);
                });
            }
        }

        const toggleBtn = document.getElementById('widget-btn-toggle-panel');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const nextMode = (this.currentViewMode === 'split' || this.currentViewMode === 'gathering') ? 'courtyard' : 'split';
                this.switchHubView(nextMode);
            });
        }

        this.switchHubView(this.currentViewMode || 'split');
    }

    /**
     * Switches the active view presentation mode inside the Hub tab.
     * @param {'courtyard'|'gathering'|'workers'|'split'} mode
     */
    switchHubView(mode) {
        this.currentViewMode = mode;
        const tabHub = document.getElementById('tab-hub');
        if (tabHub) {
            tabHub.classList.remove('view-courtyard', 'view-gathering', 'view-workers', 'view-split');
            tabHub.classList.add(`view-${mode}`);
        }

        document.querySelectorAll('.hub-subnav-btn').forEach(btn => {
            if (btn.dataset.hubView === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (mode === 'gathering') {
            const sec = document.querySelector('.gathering-section');
            if (sec) sec.scrollIntoView({ behavior: 'smooth' });
        } else if (mode === 'workers') {
            const sec = document.querySelector('.workers-section');
            if (sec) sec.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // ═══════════════════════════════════════════
    //  GATHERING NODES
    // ═══════════════════════════════════════════

    _renderNodes() {
        const container = this.dom.nodesContainer;
        if (!container) return;
        container.innerHTML = '';

        for (const node of this.state.nodes) {
            const card = document.createElement('div');
            card.className = 'node-card';
            card.id = `node-${node.id}`;
            card.style.setProperty('--node-accent', node.accentColor);
            card.style.setProperty('--node-accent-light', node.accentColorLight);

            card.innerHTML = `
                <div class="node-header">
                    <div class="node-title-group">
                        <span class="node-icon">${node.icon}</span>
                        <span class="node-name">${node.name}</span>
                    </div>
                    <span class="node-level" id="node-level-${node.id}">Nv. ${node.level}</span>
                </div>

                <div class="node-progress-wrapper">
                    <div class="node-progress-bar" id="node-bar-${node.id}" title="Clique para coletar">
                        <div class="node-progress-fill" id="node-fill-${node.id}" style="width:0%"></div>
                        <span class="node-progress-text" id="node-text-${node.id}">Clique para coletar</span>
                    </div>
                </div>

                <div class="node-stats">
                    <span class="node-stat"><span class="rune-icon">ᛟ</span> <strong id="node-yield-${node.id}">${node.currentYield}</strong> ${RESOURCE_META[node.resourceType].label}</span>
                    <span class="node-stat"><span class="rune-icon">ᛈ</span> <strong id="node-time-${node.id}">${node.currentTime.toFixed(1)}s</strong></span>
                    <span class="node-stat"><span class="rune-icon">☩</span> <strong id="node-rps-${node.id}">${node.resourcesPerSecond.toFixed(1)}</strong>/s</span>
                </div>

                <div class="node-stats" style="margin-bottom: 8px;">
                    <span class="node-stat">Total: <strong id="node-total-${node.id}">${Utils.formatNumber(node.totalGathered)}</strong></span>
                    <span class="automation-badge" id="node-auto-${node.id}" style="display:none;">
                        <span class="pulse-dot"></span> Auto
                    </span>
                </div>

                <div class="node-actions">
                    <button class="btn-gather" id="btn-gather-${node.id}">
                        <span class="rune-icon">🜛</span> Coletar
                    </button>
                    <button class="btn-upgrade" id="btn-upgrade-${node.id}" title="Melhorar nó">
                        ▲ ${Utils.formatNumber(node.upgradeCost)} <span class="rune-icon">🜚</span>
                    </button>
                </div>
            `;

            container.appendChild(card);

            // Cache references
            this._nodeCards[node.id] = {
                fill:      document.getElementById(`node-fill-${node.id}`),
                text:      document.getElementById(`node-text-${node.id}`),
                bar:       document.getElementById(`node-bar-${node.id}`),
                level:     document.getElementById(`node-level-${node.id}`),
                yield:     document.getElementById(`node-yield-${node.id}`),
                time:      document.getElementById(`node-time-${node.id}`),
                rps:       document.getElementById(`node-rps-${node.id}`),
                total:     document.getElementById(`node-total-${node.id}`),
                autoTag:   document.getElementById(`node-auto-${node.id}`),
                btnGather: document.getElementById(`btn-gather-${node.id}`),
                btnUpgrade: document.getElementById(`btn-upgrade-${node.id}`),
            };
        }
    }

    // ═══════════════════════════════════════════
    //  WORKERS
    // ═══════════════════════════════════════════

    _renderWorkers() {
        const container = this.dom.workersList;
        if (!container) return;
        container.innerHTML = '';

        for (const wDef of WORKER_DEFINITIONS) {
            const owned = this.state.getWorkerCount(wDef.id);
            const cost = this.state.getWorkerCost(wDef.id);
            const discountedCost = Math.floor(cost * this.state.getGoldCostMultiplier());

            const card = document.createElement('div');
            card.className = 'worker-card';
            card.id = `worker-${wDef.id}`;
            card.innerHTML = `
                <div class="worker-info">
                    <span class="worker-icon rune-icon">${wDef.icon}</span>
                    <div class="worker-details">
                        <span class="worker-name">${wDef.name}</span>
                        <span class="worker-desc">${wDef.description}</span>
                        <span class="worker-owned" id="worker-owned-${wDef.id}">Possui: ${owned}</span>
                    </div>
                </div>
                <div class="worker-cost">
                    <div class="worker-cost-label">Custo</div>
                    <div class="worker-cost-value" id="worker-cost-${wDef.id}">${Utils.formatNumber(discountedCost)} <span class="rune-icon">🜚</span></div>
                    <button class="btn btn-sm btn-hire-worker" id="btn-buy-worker-${wDef.id}" style="margin-top:4px;">Contratar</button>
                </div>
            `;
            container.appendChild(card);
        }
    }

    // ═══════════════════════════════════════════
    //  UPGRADES
    // ═══════════════════════════════════════════

    _renderUpgrades() {
        const container = this.dom.upgradesList;
        if (!container) return;
        container.innerHTML = `
            <div class="upgrade-card">
                <div class="upgrade-info">
                    <span class="upgrade-icon rune-icon">⛊</span>
                    <div class="upgrade-details">
                        <span class="upgrade-name">Paredes do Bastião Reforçadas</span>
                        <span class="upgrade-desc">Reduz a penalidade de perda de recursos em derrotas na fenda em 10%.</span>
                    </div>
                </div>
                <div class="upgrade-action">
                    <button class="btn btn-sm" disabled title="Requer nível de ascensão 1">Bloqueado (Ascensão)</button>
                </div>
            </div>
            <div class="upgrade-card">
                <div class="upgrade-info">
                    <span class="upgrade-icon rune-icon">🜂</span>
                    <div class="upgrade-details">
                        <span class="upgrade-name">Pira Central das Cinzas</span>
                        <span class="upgrade-desc">Canalize as Cinzas Sagradas no centro do pátio para renascer com poderes permanentes.</span>
                    </div>
                </div>
                <div class="upgrade-action">
                    <button class="btn btn-sm" id="btn-open-ascension-card">Comungar</button>
                </div>
            </div>
        `;
        const btnAsc = document.getElementById('btn-open-ascension-card');
        if (btnAsc) {
            btnAsc.addEventListener('click', () => {
                if (this.uiManager) this.uiManager.showAscensionModal();
            });
        }
    }

    // ═══════════════════════════════════════════
    //  DUNGEON KEY FORGE
    // ═══════════════════════════════════════════

    _renderKeyCost() {
        const costEl = this.dom.keyCost;
        if (!costEl) return;
        let html = '';
        for (const [type, amount] of Object.entries(DUNGEON_KEY_COST)) {
            const current = this.state.resources[type] || 0;
            const affordable = current >= amount;
            html += `<span class="key-cost-item ${affordable ? 'affordable' : 'expensive'}">
                ${RESOURCE_META[type].icon} ${current}/${amount}
            </span>`;
        }
        costEl.innerHTML = html;
    }

    // ═══════════════════════════════════════════
    //  EVENT BINDING
    // ═══════════════════════════════════════════

    _bindEvents() {
        if (this._eventsBound) return;
        this._eventsBound = true;

        // Gather buttons & progress bar click
        for (const node of this.state.nodes) {
            const refs = this._nodeCards[node.id];
            if (!refs || !refs.btnGather) continue;

            const gatherAction = () => {
                if (!node.isGathering) {
                    node.startGather();
                    refs.btnGather.classList.add('gathering');
                    refs.btnGather.textContent = 'Coletando...';
                    if (refs.fill) refs.fill.classList.add('active');
                }
            };

            refs.btnGather.addEventListener('click', gatherAction);
            if (refs.bar) refs.bar.addEventListener('click', gatherAction);

            // Upgrade button
            if (refs.btnUpgrade) {
                refs.btnUpgrade.addEventListener('click', () => {
                    const cost = Math.floor(node.upgradeCost * this.state.getGoldCostMultiplier());
                    const upgraded = node.upgrade(() => {
                        return this.state.spendResource(ResourceType.GOLD, cost);
                    });
                    if (upgraded) {
                        this.uiManager.notify(`▲ ${node.name} → Nv. ${node.level}`, 'level');
                        this._updateNodeStatic(node);
                    } else {
                        this.uiManager.notify('Ouro insuficiente!', 'error');
                    }
                });
            }
        }

        // Worker buy buttons
        for (const wDef of WORKER_DEFINITIONS) {
            const btn = document.getElementById(`btn-buy-worker-${wDef.id}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    if (this.state.buyWorker(wDef.id)) {
                        this.uiManager.notify(`${wDef.name} convocado!`, 'info');
                        this._updateWorkerCard(wDef.id);
                    } else {
                        this.uiManager.notify('Ouro insuficiente!', 'error');
                    }
                });
            }
        }

        // Forge key button
        if (this.dom.btnForgeKey) {
            this.dom.btnForgeKey.addEventListener('click', () => {
                if (this.state.forgeKey()) {
                    this.uiManager.notify('Chave da Fenda forjada!', 'loot');
                    this._renderKeyCost();
                } else {
                    this.uiManager.notify('Recursos insuficientes!', 'error');
                }
            });
        }

        // State events for re-renders
        this.state.on('resources:changed', () => {
            this._renderKeyCost();
            this._updateForgeButton();
            this._updateAllUpgradeButtons();
        });

        this.state.on('node:gathered', (data) => {
            const node = this.state.nodes.find(n => n.id === data.nodeId);
            if (node) {
                const refs = this._nodeCards[node.id];
                if (refs && refs.btnGather) {
                    refs.btnGather.classList.remove('gathering');
                    refs.btnGather.innerHTML = '<span class="rune-icon">🜛</span> Coletar';
                    if (refs.fill) refs.fill.classList.remove('active');
                    if (refs.total) refs.total.textContent = Utils.formatNumber(node.totalGathered);
                }
            }
        });

        this.state.on('workers:changed', () => {
            for (const wDef of WORKER_DEFINITIONS) {
                this._updateWorkerCard(wDef.id);
            }
        });

        this.state.on('nodes:reset', () => {
            this._renderNodes();
            this._bindNodeEvents();
        });
    }

    _bindNodeEvents() {
        for (const node of this.state.nodes) {
            const refs = this._nodeCards[node.id];
            if (!refs || !refs.btnGather) continue;

            const gatherAction = () => {
                if (!node.isGathering) {
                    node.startGather();
                    refs.btnGather.classList.add('gathering');
                    refs.btnGather.textContent = 'Coletando...';
                    if (refs.fill) refs.fill.classList.add('active');
                }
            };

            refs.btnGather.addEventListener('click', gatherAction);
            if (refs.bar) refs.bar.addEventListener('click', gatherAction);

            if (refs.btnUpgrade) {
                refs.btnUpgrade.addEventListener('click', () => {
                    const cost = Math.floor(node.upgradeCost * this.state.getGoldCostMultiplier());
                    const upgraded = node.upgrade(() => {
                        return this.state.spendResource(ResourceType.GOLD, cost);
                    });
                    if (upgraded) {
                        this.uiManager.notify(`▲ ${node.name} → Nv. ${node.level}`, 'level');
                        this._updateNodeStatic(node);
                    } else {
                        this.uiManager.notify('Ouro insuficiente!', 'error');
                    }
                });
            }
        }
    }

    // ═══════════════════════════════════════════
    //  UI UPDATE LOOP (synced to idle tick)
    // ═══════════════════════════════════════════

    _startUILoop() {
        if (this._uiLoopInterval) return;
        this._uiLoopInterval = setInterval(() => {
            for (const node of this.state.nodes) {
                const refs = this._nodeCards[node.id];
                if (!refs) continue;

                const pct = (node.gatherProgress * 100).toFixed(1);
                if (refs.fill) refs.fill.style.width = pct + '%';

                if (refs.text) {
                    if (node.isGathering) {
                        const remaining = Math.max(0, node.currentTime - node.gatherElapsed).toFixed(1);
                        refs.text.textContent = `${remaining}s`;
                    } else {
                        refs.text.textContent = 'Clique para coletar';
                    }
                }

                // Show automation badge
                if (refs.autoTag) {
                    const hasWorker = this._nodeHasWorker(node.id);
                    refs.autoTag.style.display = hasWorker ? 'inline-flex' : 'none';
                }
            }

            // Update idle earnings display
            if (this.idleEngine && this.uiManager) {
                const rates = this.idleEngine.getAutomationRatesPerSecond();
                this.uiManager.updateIdleEarnings(rates);
            }
        }, IDLE_TICK_MS);
    }

    _nodeHasWorker(nodeId) {
        for (const wDef of WORKER_DEFINITIONS) {
            if (wDef.nodeId === nodeId || wDef.nodeId === 'all') {
                if (this.state.getWorkerCount(wDef.id) > 0) return true;
            }
        }
        return false;
    }

    _updateNodeStatic(node) {
        const refs = this._nodeCards[node.id];
        if (!refs) return;
        if (refs.level) refs.level.textContent = `Nv. ${node.level}`;
        if (refs.yield) refs.yield.textContent = node.currentYield;
        if (refs.time)  refs.time.textContent  = node.currentTime.toFixed(1) + 's';
        if (refs.rps)   refs.rps.textContent   = node.resourcesPerSecond.toFixed(1);

        if (refs.btnUpgrade) {
            const cost = Math.floor(node.upgradeCost * this.state.getGoldCostMultiplier());
            refs.btnUpgrade.innerHTML = `▲ ${Utils.formatNumber(cost)} <span class="rune-icon">🜚</span>`;
        }
    }

    _updateWorkerCard(workerId) {
        const ownedEl = document.getElementById(`worker-owned-${workerId}`);
        const costEl  = document.getElementById(`worker-cost-${workerId}`);
        if (ownedEl) ownedEl.textContent = `Possui: ${this.state.getWorkerCount(workerId)}`;
        if (costEl) {
            const cost = Math.floor(this.state.getWorkerCost(workerId) * this.state.getGoldCostMultiplier());
            costEl.innerHTML = `${Utils.formatNumber(cost)} <span class="rune-icon">🜚</span>`;
        }
    }

    _updateForgeButton() {
        if (this.dom.btnForgeKey) {
            this.dom.btnForgeKey.disabled = !this.state.canForgeKey();
        }
        const enterBtn = document.getElementById('btn-enter-dungeon');
        if (enterBtn) enterBtn.disabled = this.state.dungeonKeys <= 0;
    }

    _updateAllUpgradeButtons() {
        for (const node of this.state.nodes) {
            const refs = this._nodeCards[node.id];
            if (!refs || !refs.btnUpgrade) continue;
            const cost = Math.floor(node.upgradeCost * this.state.getGoldCostMultiplier());
            refs.btnUpgrade.disabled = (this.state.resources[ResourceType.GOLD] || 0) < cost;
        }
    }

    // ═══════════════════════════════════════════
    //  O PÁTIO DA VILA (Walkable 2D Courtyard)
    // ═══════════════════════════════════════════

    _initCourtyard() {
        if (!this.dom.courtyardCanvas || !this.courtyardCtx) return;
        if (this._courtyardInitialized) return;
        this._courtyardInitialized = true;

        this._setupTriggerZones();
        this._bindCourtyardInput();
        this._startCourtyardLoop();
    }

    _bindCourtyardInput() {
        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            this.hubKeys[k] = true;
            this.hubKeys[e.code] = true;

            const sm = window.SettingsManager;
            const keyState = { [e.code]: true, [k]: true };

            const isMoveKey = sm ? (
                sm.isActionActive('moveUp', keyState) ||
                sm.isActionActive('moveDown', keyState) ||
                sm.isActionActive('moveLeft', keyState) ||
                sm.isActionActive('moveRight', keyState)
            ) : ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(k);

            if (isMoveKey) {
                // Keyboard overrides mouse pathfinding
                this.hero.targetPos = null;
                this.hero.targetStation = null;
            }

            // Debug Mode Toggles (F1: Combat, F3: Asset Pipeline)
            if (e.key === 'F3') {
                e.preventDefault();
                if (typeof window.toggleAssetDebug === 'function') {
                    window.toggleAssetDebug();
                } else {
                    window.ASHEN_ASSET_DEBUG = !window.ASHEN_ASSET_DEBUG;
                }
            } else if (e.key === 'F1') {
                e.preventDefault();
                window.ASHEN_COMBAT_DEBUG = !window.ASHEN_COMBAT_DEBUG;
            }

            // Interact trigger (SettingsManager interact action, E or Space)
            const wantsInteract = sm ? sm.isActionActive('interact', keyState) : (k === 'e' || e.code === 'Space');
            if (wantsInteract && this.activeTriggerZone) {
                const hubTab = document.getElementById('tab-hub');
                const modal = document.getElementById('modal-overlay');
                if (hubTab && hubTab.classList.contains('active') && (!modal || modal.classList.contains('hidden'))) {
                    e.preventDefault();
                    // Pause movement
                    this.hubKeys = {};
                    this.hero.targetPos = null;
                    this.hero.targetStation = null;
                    this.activeTriggerZone.action();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            this.hubKeys[k] = false;
            this.hubKeys[e.code] = false;
        });

        // Mouse click on canvas for click-to-move
        if (this.dom.courtyardCanvas) {
            this.dom.courtyardCanvas.addEventListener('click', (e) => {
                const rect = this.dom.courtyardCanvas.getBoundingClientRect();
                const scaleX = 1376 / rect.width;
                const scaleY = 768 / rect.height;
                const clickX = (e.clientX - rect.left) * scaleX;
                const clickY = (e.clientY - rect.top) * scaleY;

                // Check if clicked directly on or near any station
                let clickedStation = null;
                for (const zone of this.triggerZones) {
                    const dist = Math.hypot(clickX - zone.x, clickY - zone.y);
                    if (dist <= zone.radius * 1.3) {
                        clickedStation = zone;
                        break;
                    }
                }

                if (clickedStation) {
                    this.hero.targetStation = clickedStation;
                    this.hero.targetPos = { x: clickedStation.x, y: clickedStation.y };
                } else {
                    this.hero.targetStation = null;
                    this.hero.targetPos = { x: clickX, y: clickY };
                }
            });
        }
    }

    _initFloatingGatheringWidget() {
        if (this._floatingWidgetInitialized) return;
        this._floatingWidgetInitialized = true;

        const nodes = ['wood_grove', 'iron_mine', 'gold_stream'];
        for (const nodeId of nodes) {
            const btn = document.getElementById(`widget-btn-${nodeId}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    const node = this.state.nodes.find(n => n.id === nodeId);
                    if (node && !node.isGathering) {
                        node.startGather();
                    }
                });
            }
        }

        // Real-time progress update for the 3px amber bars
        this.state.on('node:progress', (data) => {
            const fill = document.getElementById(`widget-fill-${data.nodeId}`);
            if (fill) {
                fill.style.width = (data.progress * 100).toFixed(1) + '%';
            }
        });

        this.state.on('node:gathered', (data) => {
            const fill = document.getElementById(`widget-fill-${data.nodeId}`);
            if (fill) {
                fill.style.width = '0%';
            }
        });
    }

    _startCourtyardLoop() {
        this._lastCourtyardTick = performance.now();

        const loop = () => {
            const now = performance.now();
            const dt = Math.min((now - this._lastCourtyardTick) / 1000, 0.06);
            this._lastCourtyardTick = now;

            const hubTab = document.getElementById('tab-hub');
            if (hubTab && hubTab.classList.contains('active')) {
                this._updateCourtyard(dt);
                this._renderCourtyard();
            }

            this._courtyardAnimId = requestAnimationFrame(loop);
        };

        this._courtyardAnimId = requestAnimationFrame(loop);
    }

    _updateCourtyard(dt) {
        let dx = 0;
        let dy = 0;

        const sm = window.SettingsManager;
        if (sm ? sm.isActionActive('moveUp', this.hubKeys) : (this.hubKeys['w'] || this.hubKeys['arrowup']))    dy -= 1;
        if (sm ? sm.isActionActive('moveDown', this.hubKeys) : (this.hubKeys['s'] || this.hubKeys['arrowdown']))  dy += 1;
        if (sm ? sm.isActionActive('moveLeft', this.hubKeys) : (this.hubKeys['a'] || this.hubKeys['arrowleft']))  dx -= 1;
        if (sm ? sm.isActionActive('moveRight', this.hubKeys) : (this.hubKeys['d'] || this.hubKeys['arrowright'])) dx += 1;

        if (dx !== 0 || dy !== 0) {
            this.hero.targetPos = null;
            this.hero.targetStation = null;
            const len = Math.hypot(dx, dy);
            dx /= len;
            dy /= len;

            this.hero.x += dx * this.hero.speed * dt;
            this.hero.y += dy * this.hero.speed * dt;
            this.hero.facing.x = dx;
            this.hero.facing.y = dy;
        } else if (this.hero.targetPos) {
            const tdx = this.hero.targetPos.x - this.hero.x;
            const tdy = this.hero.targetPos.y - this.hero.y;
            const tDist = Math.hypot(tdx, tdy);

            const stopDist = this.hero.targetStation ? Math.min(this.hero.targetStation.radius * 0.7, 35) : 6;
            if (tDist > stopDist) {
                const moveDist = Math.min(this.hero.speed * dt, tDist);
                this.hero.x += (tdx / tDist) * moveDist;
                this.hero.y += (tdy / tDist) * moveDist;
                this.hero.facing.x = tdx / tDist;
                this.hero.facing.y = tdy / tDist;
            } else {
                const st = this.hero.targetStation;
                this.hero.targetPos = null;
                this.hero.targetStation = null;
                if (st && typeof st.action === 'function') {
                    st.action();
                }
            }
        }

        // Collision bounds: circular inner courtyard around center (688, 384)
        const cx = 688;
        const cy = 384;
        const maxRadius = 300;
        const dist = Math.hypot(this.hero.x - cx, this.hero.y - cy);
        if (dist > maxRadius) {
            this.hero.x = cx + ((this.hero.x - cx) / dist) * maxRadius;
            this.hero.y = cy + ((this.hero.y - cy) / dist) * maxRadius;
        }

        // Hard bounding clamp inside the 1376x768 courtyard canvas
        this.hero.x = Utils.clamp(this.hero.x, 340, 1040);
        this.hero.y = Utils.clamp(this.hero.y, 140, 620);

        // Detect proximity to 5 interactive trigger zones
        let nearest = null;
        let minDist = Infinity;
        for (const zone of this.triggerZones) {
            const d = Math.hypot(this.hero.x - zone.x, this.hero.y - zone.y);
            if (d <= zone.radius && d < minDist) {
                minDist = d;
                nearest = zone;
            }
        }
        this.activeTriggerZone = nearest;

        if (this.dom.courtyardPrompt && this.dom.courtyardPromptText) {
            if (nearest) {
                this.dom.courtyardPromptText.textContent = nearest.prompt;
                this.dom.courtyardPrompt.classList.remove('hidden');
            } else {
                this.dom.courtyardPrompt.classList.add('hidden');
            }
        }
    }

    _renderCourtyard() {
        const ctx = this.courtyardCtx;
        if (!ctx) return;

        const w = 1376;
        const h = 768;
        const now = performance.now();

        try {
            ctx.clearRect(0, 0, w, h);

            // 1. Draw Background Map
            if (this.courtyardBg && this.courtyardBg.complete && this.courtyardBg.naturalWidth > 0) {
                ctx.drawImage(this.courtyardBg, 0, 0, w, h);
            } else {
                // High-fidelity procedural dark fantasy village courtyard fallback
                this._drawProceduralCourtyard(ctx, w, h, now);
            }

            // 2. Draw Subtle Runic Interactive Zones
            for (const zone of this.triggerZones) {
                const isNear = (this.activeTriggerZone && this.activeTriggerZone.id === zone.id);
                const pulse = (Math.sin(now / 400) + 1) * 0.5;

                ctx.save();
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, isNear ? 32 + pulse * 4 : 24, 0, Math.PI * 2);

                ctx.fillStyle = isNear ? 'rgba(197, 160, 89, 0.26)' : 'rgba(0, 0, 0, 0.4)';
                ctx.fill();

                ctx.strokeStyle = isNear ? '#c5a059' : 'rgba(197, 160, 89, 0.55)';
                ctx.lineWidth = isNear ? 2.5 : 1.4;
                if (isNear) {
                    ctx.shadowColor = '#c5a059';
                    ctx.shadowBlur = 14;
                }
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Landmark Icon
                ctx.font = 'bold 16px "Cinzel", serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = isNear ? '#fceecb' : '#c5a059';
                ctx.fillText(zone.icon, zone.x, zone.y);

                // Landmark Name Tag
                ctx.font = 'bold 11px "Cinzel", serif';
                ctx.fillStyle = isNear ? '#ffffff' : '#b8a994';
                ctx.fillText(zone.name, zone.x, zone.y + 34);

                // Floating Runic Label in Canvas
                if (isNear) {
                    const labelText = zone.prompt;
                    ctx.font = 'bold 12px "Cinzel", serif';
                    const textMetrics = ctx.measureText(labelText);
                    const boxW = textMetrics.width + 24;
                    const boxH = 26;
                    const boxX = zone.x - boxW / 2;
                    const boxY = zone.y - 50;

                    ctx.fillStyle = 'rgba(12, 10, 14, 0.94)';
                    ctx.beginPath();
                    if (ctx.roundRect) {
                        ctx.roundRect(boxX, boxY, boxW, boxH, 4);
                    } else {
                        ctx.rect(boxX, boxY, boxW, boxH);
                    }
                    ctx.fill();

                    ctx.strokeStyle = '#c5a059';
                    ctx.lineWidth = 1.5;
                    ctx.shadowColor = '#c5a059';
                    ctx.shadowBlur = 10;
                    ctx.stroke();
                    ctx.shadowBlur = 0;

                    ctx.fillStyle = '#fceecb';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(labelText, zone.x, boxY + boxH / 2);
                }

                ctx.restore();
            }

            // 3. Draw Hero ("O Boneco" Paperdoll Rig)
            const hero = this.hero;
            const char = this.state.character;

            ctx.save();

            // Walking bob effect
            const isMoving = (Math.hypot(hero.facing.x, hero.facing.y) > 0.1 && (this.hubKeys['w'] || this.hubKeys['s'] || this.hubKeys['a'] || this.hubKeys['d'] || hero.targetPos));
            const bob = isMoving ? Math.sin(now / 100) * 2.5 : 0;

            if (typeof EntityRenderer !== 'undefined' && EntityRenderer.drawPlayer) {
                EntityRenderer.drawPlayer(ctx, hero, char, 0.016);
            } else if (typeof PaperdollSystem !== 'undefined' && PaperdollSystem.drawCharacter) {
                // Top-Down Inclinada (15° a 20°) Paperdoll Modular Rig
                PaperdollSystem.drawCharacter(ctx, hero, char, 0.016);
            } else {
                // Fallback Circle Rig
                const sealAngle = (now / 2200) % (Math.PI * 2);
                ctx.save();
                ctx.translate(hero.x, hero.y + 10);
                ctx.rotate(sealAngle);
                ctx.beginPath();
                ctx.arc(0, 0, hero.radius + 8, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(197, 160, 89, 0.5)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 3]);
                ctx.stroke();
                ctx.restore();

                ctx.beginPath();
                ctx.ellipse(hero.x, hero.y + 14, 16, 7, 0, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(hero.x, hero.y + bob, hero.radius, 0, Math.PI * 2);
                ctx.fillStyle = '#221d27';
                ctx.fill();
                ctx.strokeStyle = '#c5a059';
                ctx.lineWidth = 2.5;
                ctx.stroke();

                ctx.font = 'bold 16px "Cinzel", serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#ffeed0';
                ctx.fillText((char && char.classIcon) ? char.classIcon : 'ᛏ', hero.x, hero.y + bob);
            }

            // Facing indicator (golden direction pointer)
            if (hero.facing && (hero.facing.x !== 0 || hero.facing.y !== 0)) {
                const angle = Math.atan2(hero.facing.y, hero.facing.x);
                ctx.save();
                ctx.translate(hero.x, hero.y + bob);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(hero.radius + 12, 0);
                ctx.lineTo(hero.radius + 5, -5);
                ctx.lineTo(hero.radius + 5, 5);
                ctx.closePath();
                ctx.fillStyle = '#fceecb';
                ctx.fill();
                ctx.restore();
            }

            // Hero Label & Level Badge (above head)
            const charName = (char && (char.name || char.className)) ? (char.name || char.className) : 'Campeão';
            const charLvl = (char && char.level) ? char.level : 1;
            const labelText = `${charName} (Nv. ${charLvl})`;

            ctx.font = 'bold 11px "Cinzel", serif';
            ctx.textAlign = 'center';
            const textMetrics = ctx.measureText(labelText);
            const tagW = textMetrics.width + 16;
            const tagH = 18;
            const tagX = hero.x - tagW / 2;
            const tagY = hero.y + bob - 44;

            ctx.fillStyle = 'rgba(12, 10, 14, 0.9)';
            ctx.strokeStyle = '#785f34';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(tagX, tagY, tagW, tagH, 3);
            } else {
                ctx.rect(tagX, tagY, tagW, tagH);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#fceecb';
            ctx.fillText(labelText, hero.x, tagY + tagH / 2 + 1);

            ctx.restore();

            // Ashen Asset Debug Overlay in Hub (F3)
            if (window.ASHEN_ASSET_DEBUG && typeof AssetManager !== 'undefined' && typeof AssetManager.drawDebugOverlay === 'function') {
                AssetManager.drawDebugOverlay(ctx, this.courtyardW, this.courtyardH);
            }

        } catch (err) {
            console.error('[HubUI] Courtyard rendering error:', err);
        }
    }

    /**
     * Procedural dark fantasy village courtyard fallback if background image is loading or fails.
     */
    _drawProceduralCourtyard(ctx, w, h, now) {
        // Base ground: dark obsidian flagstones
        const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, Math.max(w, h) / 1.4);
        bgGrad.addColorStop(0, '#1c1722');
        bgGrad.addColorStop(0.5, '#120f16');
        bgGrad.addColorStop(1, '#070608');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Cobblestone paving pattern
        ctx.strokeStyle = 'rgba(70, 55, 78, 0.22)';
        ctx.lineWidth = 1;
        const tileSize = 48;
        for (let x = 0; x < w; x += tileSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += tileSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Circular ancient plaza stones
        ctx.save();
        ctx.beginPath();
        ctx.arc(688, 384, 300, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(197, 160, 89, 0.3)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(688, 384, 180, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(197, 160, 89, 0.2)';
        ctx.setLineDash([8, 8]);
        ctx.stroke();
        ctx.restore();

        // Central Brasier / Ember Circle (Pira das Cinzas)
        const flamePulse = (Math.sin(now / 180) + 1) * 0.5;
        const fireGrad = ctx.createRadialGradient(688, 384, 8, 688, 384, 45 + flamePulse * 8);
        fireGrad.addColorStop(0, 'rgba(255, 140, 40, 0.9)');
        fireGrad.addColorStop(0.4, 'rgba(217, 70, 20, 0.6)');
        fireGrad.addColorStop(0.8, 'rgba(120, 30, 10, 0.2)');
        fireGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = fireGrad;
        ctx.beginPath();
        ctx.arc(688, 384, 55 + flamePulse * 8, 0, Math.PI * 2);
        ctx.fill();

        // Torchlight auras at stations
        const torchCoords = [
            { x: 420, y: 360, color: 'rgba(230, 126, 34, 0.22)' }, // Forge
            { x: 960, y: 380, color: 'rgba(46, 204, 113, 0.18)' }, // Market
            { x: 688, y: 190, color: 'rgba(155, 89, 182, 0.22)' }, // Rift
            { x: 688, y: 540, color: 'rgba(243, 156, 18, 0.20)' }, // Bounties
        ];
        for (const t of torchCoords) {
            const g = ctx.createRadialGradient(t.x, t.y, 10, t.x, t.y, 80);
            g.addColorStop(0, t.color);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(t.x, t.y, 80, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

console.log('[HubUI] Class loaded successfully with Walkable Courtyard & Gathering Management.');
