/**
 * ============================================
 *  UI MANAGER
 *  Handles top-level UI: Onboarding state flow
 *  (Title, Prologue, Class Selection, Difficulty),
 *  tabs, notifications, modals, resource display,
 *  and HUD updates.
 * ============================================
 */

class UIManager {
    constructor(state) {
        /** @type {StateManager} */
        this.state = state;

        // Cache DOM elements
        this.dom = {
            loadingScreen:       document.getElementById('loading-screen'),
            loadingBar:          document.getElementById('loading-bar'),
            loadingText:         document.getElementById('loading-text'),

            // Stage A: Title Screen
            titleScreen:         document.getElementById('title-screen'),
            btnTitleNew:         document.getElementById('btn-title-new'),
            btnTitleContinue:    document.getElementById('btn-title-continue'),
            btnTitleSettings:    document.getElementById('btn-title-settings'),
            titleSaveInfo:       document.getElementById('title-save-info'),

            // Stage B: Narrative Prologue
            prologueScreen:      document.getElementById('prologue-screen'),
            prologueP1:          document.getElementById('prologue-p1'),
            prologueP2:          document.getElementById('prologue-p2'),
            prologueP3:          document.getElementById('prologue-p3'),
            btnContinuePrologue: document.getElementById('btn-continue-prologue'),
            btnSkipPrologue:     document.getElementById('btn-skip-prologue'),

            // Stage C: Bloodline Selection (Etapa I)
            bloodlineScreen:     document.getElementById('bloodline-selection-screen'),
            bloodlineGrid:       document.getElementById('bloodline-grid'),
            btnBloodlineBack:    document.getElementById('btn-bloodline-back'),
            btnConfirmBloodline: document.getElementById('btn-confirm-bloodline'),

            // Stage D: Class Selection (Etapa II)
            classScreen:         document.getElementById('class-selection-screen'),
            classGrid:           document.getElementById('class-grid'),
            btnClassBack:        document.getElementById('btn-class-back'),
            btnConfirmClass:     document.getElementById('btn-confirm-class'),

            // Stage E: Difficulty Selection (Etapa III)
            diffScreen:          document.getElementById('difficulty-selection-screen'),
            diffGrid:            document.getElementById('difficulty-grid'),
            btnDiffBack:         document.getElementById('btn-diff-back'),
            btnConfirmDiff:      document.getElementById('btn-confirm-diff'),

            // Main Game Screen
            gameScreen:          document.getElementById('game-screen'),

            // HUD
            playerAvatar:        document.getElementById('player-avatar'),
            playerName:          document.getElementById('player-name'),
            playerClassLabel:    document.getElementById('player-class-label'),
            hpFill:              document.getElementById('hp-fill'),
            hpText:              document.getElementById('hp-text'),
            resourceFill:        document.getElementById('resource-fill'),
            resourceText:        document.getElementById('resource-text'),
            resourceBar:         document.getElementById('resource-bar-container'),
            xpFill:              document.getElementById('xp-fill'),
            playerLevel:         document.getElementById('player-level'),

            // Resources
            resWood:             document.getElementById('res-wood'),
            resOre:              document.getElementById('res-ore'),
            resGold:             document.getElementById('res-gold'),
            resAshes:            document.getElementById('res-ashes'),
            resEssence:          document.getElementById('res-essence'),
            idleEarnings:        document.getElementById('idle-earnings'),

            // Dungeon
            dungeonKeysCount:    document.getElementById('dungeon-keys-count'),

            // Notifications
            notifStack:          document.getElementById('notification-stack'),

            // Modal
            modalOverlay:        document.getElementById('modal-overlay'),
            modalContent:        document.getElementById('modal-content'),
        };

        this._selectedBloodline = (typeof BloodlineType !== 'undefined' ? BloodlineType.CHILDREN_OF_PYRE : 'children_of_pyre');
        this._selectedClass = null;
        this._selectedDifficulty = DifficultyType.NORMAL;
        this._activeSkillModalTab = 'class';
        this.rubricsCanvas = null;
        this._prologueTimeouts = [];
        this.skillTreeManager = new SkillTreeManager(this.state);
        this.attributeManager = new AttributeManager(this.state);
        window.attributeManager = this.attributeManager;

        console.log('[UIManager] Initialized with SkillTreeManager, AttributeManager & Bloodlines.');
    }

    // ═══════════════════════════════════════════
    //  LOADING SCREEN
    // ═══════════════════════════════════════════

    async playLoadingSequence() {
        const steps = [
            { pct: 25,  text: 'Invocando glifos ancestrais...' },
            { pct: 50,  text: 'Erguendo o acampamento nas cinzas...' },
            { pct: 75,  text: 'Despertando as profundezas da Fenda...' },
            { pct: 100, text: 'Os portões foram abertos.' },
        ];

        for (const step of steps) {
            this.dom.loadingBar.style.width = step.pct + '%';
            this.dom.loadingText.textContent = step.text;
            await this._delay(300);
        }

        await this._delay(200);
        this.dom.loadingScreen.classList.add('fade-out');
        await this._delay(500);
        this.dom.loadingScreen.classList.add('hidden');
    }

    // ═══════════════════════════════════════════
    //  STAGE A: TITLE SCREEN
    // ═══════════════════════════════════════════

    showTitleScreen(hasSave = false, saveDetails = '') {
        this.dom.titleScreen.classList.remove('hidden');
        // Reset the fade overlay for fresh display
        const fadeOverlay = document.getElementById('ts-fade-overlay');
        if (fadeOverlay) fadeOverlay.classList.remove('active');
        this.updateTitleSaveInfo(hasSave, saveDetails);

        // General game music theme across title screen and menus
        if (window.AudioManager && typeof window.AudioManager.playMusic === 'function') {
            window.AudioManager.playMusic('general');
        }
    }

    updateTitleSaveInfo(hasSave, saveDetails = '') {
        if (hasSave) {
            this.dom.btnTitleContinue.disabled = false;
            this.dom.titleSaveInfo.innerHTML = `<span class="rune-icon">ᛟ</span> Registro Ativo: <strong>${saveDetails || 'Penitência Gravada'}</strong>`;
        } else {
            this.dom.btnTitleContinue.disabled = true;
            this.dom.titleSaveInfo.innerHTML = `Nenhum registro encontrado nas cinzas`;
        }
    }

    hideTitleScreen() {
        this.dom.titleScreen.classList.add('hidden');
    }

    // ═══════════════════════════════════════════
    //  STAGE B: NARRATIVE PROLOGUE
    // ═══════════════════════════════════════════

    playPrologueSequence() {
        this._clearPrologueTimeouts();
        this.dom.prologueScreen.classList.remove('hidden');

        // Reset visibility
        this.dom.prologueP1.classList.remove('visible');
        this.dom.prologueP2.classList.remove('visible');
        this.dom.prologueP3.classList.remove('visible');
        this.dom.btnContinuePrologue.classList.remove('visible');

        // Cadenced responsive fade-in sequence
        this._prologueTimeouts.push(setTimeout(() => {
            this.dom.prologueP1.classList.add('visible');
        }, 250));

        this._prologueTimeouts.push(setTimeout(() => {
            this.dom.prologueP2.classList.add('visible');
        }, 1100));

        this._prologueTimeouts.push(setTimeout(() => {
            this.dom.prologueP3.classList.add('visible');
        }, 1900));

        this._prologueTimeouts.push(setTimeout(() => {
            this.dom.btnContinuePrologue.classList.add('visible');
        }, 2400));
    }

    skipPrologue() {
        this._clearPrologueTimeouts();
        this.dom.prologueP1.classList.add('visible');
        this.dom.prologueP2.classList.add('visible');
        this.dom.prologueP3.classList.add('visible');
        this.dom.btnContinuePrologue.classList.add('visible');
    }

    hidePrologue() {
        this._clearPrologueTimeouts();
        this.dom.prologueScreen.classList.add('hidden');
    }

    _clearPrologueTimeouts() {
        for (const t of this._prologueTimeouts) {
            clearTimeout(t);
        }
        this._prologueTimeouts = [];
    }

    // ═══════════════════════════════════════════
    //  STAGE C: BLOODLINE SELECTION (Etapa I)
    // ═══════════════════════════════════════════

    showBloodlineSelection() {
        if (this.dom.bloodlineScreen) {
            this.dom.bloodlineScreen.classList.remove('hidden');
        }
        if (!this._selectedBloodline) {
            this._selectedBloodline = (typeof BloodlineType !== 'undefined' ? BloodlineType.CHILDREN_OF_PYRE : 'children_of_pyre');
        }
        this._renderBloodlineCards();
    }

    _renderBloodlineCards() {
        const grid = this.dom.bloodlineGrid;
        if (!grid || typeof BLOODLINE_DEFINITIONS === 'undefined') return;
        grid.innerHTML = '';

        for (const [id, def] of Object.entries(BLOODLINE_DEFINITIONS)) {
            const card = document.createElement('div');
            const isSelected = (this._selectedBloodline === id);
            card.className = 'bloodline-card' + (isSelected ? ' selected' : '');
            card.dataset.bloodlineId = id;
            card.innerHTML = `
                <div class="bloodline-card-ornament top-left"></div>
                <div class="bloodline-card-ornament top-right"></div>
                <div class="bloodline-card-ornament bottom-left"></div>
                <div class="bloodline-card-ornament bottom-right"></div>
                <div class="bloodline-avatar rune-icon">${def.icon}</div>
                <div class="bloodline-name">${def.name}</div>
                <div class="bloodline-epithet">${def.epithet || ''}</div>
                <div class="bloodline-quote">${def.quote}</div>
                <div class="bloodline-desc">${def.lore || def.narrative || ''}</div>
                <div class="bloodline-bonus-box">
                    <span class="rune-icon" style="color: var(--accent-orange); margin-right: 6px;">✦</span>
                    <strong>${def.bonusesDescription || def.bonusSummary || ''}</strong>
                </div>
            `;

            card.addEventListener('click', () => {
                grid.querySelectorAll('.bloodline-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this._selectedBloodline = id;
                if (this.dom.btnConfirmBloodline) {
                    this.dom.btnConfirmBloodline.disabled = false;
                }
            });

            grid.appendChild(card);
        }

        if (this.dom.btnConfirmBloodline) {
            this.dom.btnConfirmBloodline.disabled = false;
        }
    }

    getSelectedBloodline() {
        return this._selectedBloodline || (typeof BloodlineType !== 'undefined' ? BloodlineType.CHILDREN_OF_PYRE : 'children_of_pyre');
    }

    hideBloodlineSelection() {
        if (this.dom.bloodlineScreen) {
            this.dom.bloodlineScreen.classList.add('hidden');
        }
    }

    // ═══════════════════════════════════════════
    //  STAGE D: CLASS SELECTION (Etapa II)
    // ═══════════════════════════════════════════

    showClassSelection() {
        this.dom.classScreen.classList.remove('hidden');
        if (!this._selectedClass) {
            this._selectedClass = 'barbarian';
        }
        this._renderClassCards();
    }

    _renderClassCards() {
        const grid = this.dom.classGrid;
        grid.innerHTML = '';

        for (const [id, def] of Object.entries(CLASS_DEFINITIONS)) {
            const card = document.createElement('div');
            card.className = 'class-card' + (this._selectedClass === id ? ' selected' : '');
            card.dataset.classId = id;
            card.innerHTML = `
                <div class="class-card-ornament top-left"></div>
                <div class="class-card-ornament top-right"></div>
                <div class="class-card-ornament bottom-left"></div>
                <div class="class-card-ornament bottom-right"></div>
                <div class="class-avatar rune-icon">${def.icon}</div>
                <div class="class-name">${def.name}</div>
                <div class="class-epithet">${def.epithet || ''}</div>
                <div class="class-role">${def.role}</div>
                <div class="class-desc">${def.description}</div>
                <div class="class-idle-bonus">
                    <span class="rune-icon">${def.icon}</span> 
                    <span>${def.idleBonus.label}</span>
                </div>
            `;

            card.addEventListener('click', () => {
                grid.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this._selectedClass = id;
                if (this.dom.btnConfirmClass) {
                    this.dom.btnConfirmClass.disabled = false;
                }
            });

            grid.appendChild(card);
        }

        if (this.dom.btnConfirmClass) {
            this.dom.btnConfirmClass.disabled = false;
        }
    }

    getSelectedClass() {
        return this._selectedClass || 'barbarian';
    }

    hideClassSelection() {
        this.dom.classScreen.classList.add('hidden');
    }

    // ═══════════════════════════════════════════
    //  STAGE D: DIFFICULTY SELECTION
    // ═══════════════════════════════════════════

    showDifficultySelection() {
        this.dom.diffScreen.classList.remove('hidden');
        if (!this._selectedDifficulty) {
            this._selectedDifficulty = DifficultyType.NORMAL;
        }
        this._renderDifficultyCards();
    }

    _renderDifficultyCards() {
        const grid = this.dom.diffGrid;
        grid.innerHTML = '';

        for (const [id, def] of Object.entries(DIFFICULTY_DEFINITIONS)) {
            const card = document.createElement('div');
            const isSelected = (this._selectedDifficulty === id);
            card.className = 'diff-card' + (isSelected ? ' selected' : '');
            card.dataset.diffId = id;

            const badgeClass = id === DifficultyType.NORMAL ? 'normal' : id === DifficultyType.NIGHTMARE ? 'nightmare' : 'torment';
            const deathPenaltyPct = Math.round(def.deathLootLoss * 100);

            card.innerHTML = `
                <div class="diff-header">
                    <span class="diff-glyph rune-icon">${def.rune}</span>
                    <div>
                        <div class="diff-name">${def.name}</div>
                        <span class="diff-badge ${badgeClass}">${def.subtitle}</span>
                    </div>
                </div>
                <p class="diff-desc">${def.description}</p>
                <div class="diff-stats">
                    <div class="diff-stat-item">
                        <span>Multiplicador de Vida:</span>
                        <strong>${def.enemyHpMult > 1 ? '+' + Math.round((def.enemyHpMult - 1) * 100) + '%' : 'Padrão (100%)'}</strong>
                    </div>
                    <div class="diff-stat-item">
                        <span>Multiplicador de Dano:</span>
                        <strong>${def.enemyDmgMult > 1 ? '+' + Math.round((def.enemyDmgMult - 1) * 100) + '%' : 'Padrão (100%)'}</strong>
                    </div>
                    <div class="diff-stat-item">
                        <span>Bônus de Relíquias (Mágico/Raro):</span>
                        <strong>${def.lootQualityBonus > 0 ? '+' + Math.round(def.lootQualityBonus * 100) + '%' : 'Padrão'}</strong>
                    </div>
                    <div class="diff-stat-item">
                        <span>Penalidade de Derrota:</span>
                        <strong style="color: #cf3a3a;">Perda de ${deathPenaltyPct}% do Loot${def.breaksKeyOnDeath ? ' + Chave Quebrada' : ''}</strong>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                grid.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this._selectedDifficulty = id;
            });

            grid.appendChild(card);
        }
    }

    getSelectedDifficulty() {
        return this._selectedDifficulty;
    }

    hideDifficultySelection() {
        this.dom.diffScreen.classList.add('hidden');
    }

    hideAllOnboardingScreens() {
        this.hideTitleScreen();
        this.hidePrologue();
        this.hideBloodlineSelection();
        this.hideClassSelection();
        this.hideDifficultySelection();
    }

    // ═══════════════════════════════════════════
    //  GAME SCREEN
    // ═══════════════════════════════════════════

    showGameScreen() {
        this.dom.gameScreen.classList.remove('hidden');
        this._setupTabs();
        this._setupHUDButtons();
        this._bindStateEvents();
    }

    switchTab(tabId) {
        const btns = document.querySelectorAll('.tab-btn');
        btns.forEach(b => {
            if (b.dataset.tab === tabId) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });

        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById('tab-' + tabId);
        if (panel) {
            panel.classList.add('active');
        }

        // Keep general theme active in all non-dungeon tabs
        if (tabId !== 'dungeon' && (!this.state || !this.state.inDungeon)) {
            if (window.AudioManager && typeof window.AudioManager.playMusic === 'function') {
                if (window.AudioManager.getCurrentTrack() !== 'general') {
                    window.AudioManager.playMusic('general');
                }
            }
        }

        if (tabId === 'hub') {
            if (typeof window.resizeHubCanvas === 'function') {
                window.resizeHubCanvas();
            }
        } else if (tabId === 'forge_alchemy') {
            if (window.campServicesUI) {
                window.campServicesUI.render();
            }
        } else if (tabId === 'market_bounties') {
            if (window.campServicesUI) {
                window.campServicesUI.render();
            }
        }
    }

    showDungeonConfirmationModal() {
        const keys = this.state.dungeonKeys || 0;
        if (keys <= 0) {
            this.notify('Você não possui Chaves da Fenda! Forje uma Chave no Acampamento.', 'error');
            this.switchTab('dungeon');
            return;
        }

        const html = `
            <div class="dungeon-confirm-modal" style="text-align: center; padding: 12px 6px;">
                <h2 class="modal-title font-cinzel" style="color: #cf3a3a; margin-bottom: 8px;">
                    <span class="rune-icon">†</span> A Fenda Abissal
                </h2>
                <p style="color: #ded7cd; margin-bottom: 16px; font-size: 0.95rem;">
                    Você está diante do portal das profundezas. Deseja consumir <strong>1 Chave da Fenda</strong> e iniciar a Masmorra agora?
                </p>
                <div style="background: rgba(0,0,0,0.55); border: 1px solid #4a3b22; padding: 10px 18px; margin-bottom: 22px; display: inline-block;">
                    <span style="color: var(--color-gold); font-size: 1.05rem; font-family: var(--font-display);">
                        <span class="rune-icon">⚿</span> Chaves Disponíveis: <strong>${keys}</strong>
                    </span>
                </div>
                <div style="display: flex; justify-content: center; gap: 14px;">
                    <button class="btn btn-gothic btn-gothic-secondary" onclick="uiManager.closeModal()">
                        Permanecer no Acampamento
                    </button>
                    <button class="btn btn-gothic btn-gothic-primary" id="btn-confirm-dungeon-enter" style="background: linear-gradient(180deg, #611212 0%, #2b0808 100%); border-color: #cf3a3a;">
                        <span class="rune-icon">†</span> Descer Agora
                    </button>
                </div>
            </div>
        `;

        this.showModal(html);
        setTimeout(() => {
            const confirmBtn = document.getElementById('btn-confirm-dungeon-enter');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => {
                    this.closeModal();
                    this.switchTab('dungeon');
                    const btnEnter = document.getElementById('btn-enter-dungeon');
                    if (btnEnter && !btnEnter.disabled) {
                        btnEnter.click();
                    }
                });
            }
        }, 50);
    }

    _setupTabs() {
        const btns = document.querySelectorAll('.tab-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                if (tabId === 'dungeon') {
                    this.showDungeonConfirmationModal();
                } else if (tabId === 'forge_alchemy') {
                    this.switchTab('forge_alchemy');
                    if (window.campServicesUI) window.campServicesUI.switchSubTab('forge');
                } else if (tabId === 'market_bounties') {
                    this.switchTab('market_bounties');
                    if (window.campServicesUI) window.campServicesUI.switchSubTab('market');
                } else {
                    this.switchTab(tabId);
                }
            });
        });
    }

    _setupHUDButtons() {
        const btnSave = document.getElementById('btn-save');
        const saveStatus = document.getElementById('save-status-text');

        const triggerSave = () => {
            this.state.save();
            this.notify('ᛟ Penitência gravada nas cinzas da eternidade.', 'info');
            if (btnSave) {
                btnSave.classList.remove('saved');
                void btnSave.offsetWidth;
                btnSave.classList.add('saved');
                setTimeout(() => {
                    btnSave.classList.remove('saved');
                }, 2000);
            }
            if (saveStatus) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                saveStatus.textContent = `Gravado às ${timeStr} • [Ctrl+S]`;
            }
        };

        if (btnSave) {
            btnSave.addEventListener('click', triggerSave);
        }

        // Global Ctrl+S / Cmd+S Quick-Save Shortcut
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                e.stopPropagation();
                triggerSave();
            }
        });

        const btnInv = document.getElementById('btn-inventory');
        if (btnInv) {
            btnInv.addEventListener('click', () => {
                this.showInventoryModal();
            });
        }

        const btnStats = document.getElementById('btn-stats');
        if (btnStats) {
            btnStats.addEventListener('click', () => {
                this.showStatsModal();
            });
        }

        const btnSkills = document.getElementById('btn-skills');
        if (btnSkills) {
            btnSkills.addEventListener('click', () => {
                this.showSkillTreeModal();
            });
        }

        const btnAsc = document.getElementById('btn-ascension');
        if (btnAsc) {
            btnAsc.addEventListener('click', () => {
                this.showAscensionModal();
            });
        }

        const btnSettings = document.getElementById('btn-settings');
        if (btnSettings) {
            btnSettings.addEventListener('click', () => {
                if (window.SettingsUI) {
                    window.SettingsUI.open('audio');
                }
            });
        }

        // Global Dynamic Key Shortcuts for Menus (I, C, K) from SettingsManager
        window.addEventListener('keydown', (e) => {
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
            if (window.SettingsUI && window.SettingsUI.isOpen) return;

            const keyState = { [e.code]: true, [e.key.toLowerCase()]: true };

            if (window.SettingsManager) {
                if (window.SettingsManager.isActionActive('inventory', keyState)) {
                    e.preventDefault();
                    this.showInventoryModal();
                } else if (window.SettingsManager.isActionActive('characterSheet', keyState)) {
                    e.preventDefault();
                    this.showStatsModal();
                } else if (window.SettingsManager.isActionActive('skillsMenu', keyState)) {
                    e.preventDefault();
                    this.showSkillTreeModal();
                }
            } else {
                if (e.key.toLowerCase() === 'k' && !this.state.inDungeon) {
                    this.showSkillTreeModal();
                }
            }
        });
    }

    // ═══════════════════════════════════════════
    //  HUD UPDATES
    // ═══════════════════════════════════════════

    _bindStateEvents() {
        this.state.on('resources:changed', (res) => this.updateResources(res));
        this.state.on('character:changed', (char) => this.updateCharacterHUD(char));
        this.state.on('character:levelup', (data) => {
            const srcLabel = data.source === 'passive' ? ' (Hub Passivo)' : ' (Combate)';
            this.notify(`ᛟ Nível ${data.level} alcançado!${srcLabel}`, 'level');
            this.updateCharacterHUD(this.state.character);

            // Level 40 Milestone: Ancestral Rubrics Awakening Celebration
            if (data.level === 40) {
                this.showRubricsAwakeningCelebration();
            }
        });
        this.state.on('skill:unlocked', (data) => {
            this.notify(`ᛉ Habilidade [${data.skill.name}] desperta!`, 'level');
            this.updateCharacterHUD(this.state.character);
        });
        this.state.on('skilltree:respec', (data) => {
            this.notify(`☩ Glifos redefinidos! +${data.refundedPoints} pontos devolvidos.`, 'info');
            this.updateCharacterHUD(this.state.character);
        });
        this.state.on('skill:modifier_toggled', (data) => {
            this.notify(`ᛟ Mutação ativada: ${data.modifier.name}!`, 'info');
        });
        this.state.on('keys:changed', (count) => {
            this.dom.dungeonKeysCount.textContent = count;
        });
        this.state.on('node:raredrop', (data) => {
            this.notify(`☩ Relíquia encontrada: ${data.drop.icon} ${data.drop.name}!`, 'loot');
        });
        this.state.on('loot:picked', (data) => {
            this.notify(`${data.item.icon} ${data.item.name} guardado na algibeira`, 'loot');
        });
        this.state.on('ascension:complete', (data) => {
            this.notify(`🜂 Ascensão consumada! +${data.reward} Cinzas Sagradas`, 'level');
        });
        this.state.on('offline:earnings', (data) => {
            const time = Utils.formatTime(data.seconds);
            const earned = Object.entries(data.earned)
                .map(([type, amt]) => `${RESOURCE_META[type]?.icon || ''} ${Utils.formatNumber(amt)}`)
                .join(', ');
            this.notify(`☩ Tributos acumulados (${time}): ${earned}`, 'info');
        });

        // Initial render
        this.updateCharacterHUD(this.state.character);
        this.updateResources(this.state.resources);
        this.dom.dungeonKeysCount.textContent = this.state.dungeonKeys;
    }

    updateCharacterHUD(char) {
        if (!char) return;
        this.dom.playerAvatar.innerHTML = `<span class="rune-icon">${char.classIcon}</span>`;
        this.dom.playerName.textContent = char.className;
        this.dom.playerClassLabel.textContent = `Nv. ${char.level} • ${CLASS_DEFINITIONS[char.classId]?.role || ''}`;

        // HP
        const hpPct = (char.hp / char.maxHp * 100).toFixed(0);
        this.dom.hpFill.style.width = hpPct + '%';
        this.dom.hpText.textContent = `${Math.floor(char.hp)}/${char.maxHp}`;

        // Resource
        const resPct = (char.resource / char.maxResource * 100).toFixed(0);
        this.dom.resourceFill.style.width = resPct + '%';
        this.dom.resourceText.textContent = `${Math.floor(char.resource)}/${char.maxResource}`;
        this.dom.resourceBar.className = `stat-bar resource-bar ${char.resourceType === 'fury' ? 'fury' : char.resourceType === 'faith' ? 'faith' : 'mana'}`;

        // XP
        const xpPct = (char.xp / char.xpToNext * 100).toFixed(1);
        this.dom.xpFill.style.width = xpPct + '%';
        this.dom.playerLevel.textContent = char.level;

        // Skill Points Badge in Top HUD
        this.updateSkillPointsBadge(char.progression ? char.progression.skillPoints : 0);
    }

    updateSkillPointsBadge(points = 0) {
        const badge = document.getElementById('skill-points-badge-hud');
        if (badge) {
            if (points > 0) {
                badge.textContent = points;
                badge.classList.remove('hidden');
                badge.style.display = 'inline-flex';
            } else {
                badge.classList.add('hidden');
                badge.style.display = 'none';
            }
        }
    }

    updateResources(res) {
        const updates = [
            { el: this.dom.resWood,    key: ResourceType.WOOD },
            { el: this.dom.resOre,     key: ResourceType.ORE },
            { el: this.dom.resGold,    key: ResourceType.GOLD },
            { el: this.dom.resAshes,   key: ResourceType.ASHES },
            { el: this.dom.resEssence, key: ResourceType.ESSENCE },
        ];

        for (const { el, key } of updates) {
            const newVal = Utils.formatNumber(res[key] || 0);
            if (el.textContent !== newVal) {
                el.textContent = newVal;
                const parent = el.closest('.resource-item');
                if (parent) {
                    parent.classList.remove('flash');
                    void parent.offsetWidth; // Force reflow
                    parent.classList.add('flash');
                }
            }
        }
    }

    /**
     * Update automation rate display.
     */
    updateIdleEarnings(rates) {
        if (!rates || Object.keys(rates).length === 0) {
            this.dom.idleEarnings.textContent = '';
            return;
        }
        const parts = Object.entries(rates)
            .filter(([, v]) => v > 0)
            .map(([type, v]) => `${RESOURCE_META[type]?.icon || ''} ${v.toFixed(1)}/s`);
        this.dom.idleEarnings.textContent = parts.join('  ');
    }

    // ═══════════════════════════════════════════
    //  NOTIFICATIONS
    // ═══════════════════════════════════════════

    notify(message, type = 'info') {
        const el = document.createElement('div');
        el.className = `notification ${type}`;
        el.textContent = message;
        this.dom.notifStack.appendChild(el);

        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 3200);

        while (this.dom.notifStack.children.length > 5) {
            this.dom.notifStack.removeChild(this.dom.notifStack.firstChild);
        }
    }

    // ═══════════════════════════════════════════
    //  MODALS
    // ═══════════════════════════════════════════

    showModal(html) {
        if (window.dungeonEngine) {
            const pauseAllowed = (window.SettingsManager && window.SettingsManager.get('gameplay.pauseOnModals') === true);
            if (pauseAllowed) {
                window.dungeonEngine.isPaused = true;
            }
        }
        this.dom.modalContent.innerHTML = html;
        this.dom.modalOverlay.classList.remove('hidden');

        const closeHandler = (e) => {
            if (e.target === this.dom.modalOverlay) {
                this.closeModal();
                this.dom.modalOverlay.removeEventListener('click', closeHandler);
            }
        };
        this.dom.modalOverlay.addEventListener('click', closeHandler);
    }

    closeModal() {
        if (window.dungeonEngine) {
            window.dungeonEngine.isPaused = false;
        }
        this.dom.modalOverlay.classList.add('hidden');
        if (this.dom.modalContent) {
            this.dom.modalContent.classList.remove('modal-skill-tree');
        }
        if (this.rubricsCanvas) {
            this.rubricsCanvas.destroy();
            this.rubricsCanvas = null;
        }
    }

    /**
     * Show Victory Summary Modal upon extracting through the monolith.
     * @param {Object} data - { gold, items, floor, onReturn }
     * @param {Function} [onReturnCallback]
     */
    showVictorySummaryModal(data, onReturnCallback) {
        const items = data.items || [];
        let itemsHtml = '';
        if (items.length > 0) {
            itemsHtml = `
                <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin: 12px 0;">
                    ${items.map(it => `
                        <div style="background:#141216; border:1px solid ${RARITY_META[it.rarity]?.color || '#c5a059'}; padding:6px 10px; border-radius:4px; display:flex; align-items:center; gap:6px;">
                            <span class="rune-icon" style="font-size:1.1rem; color:${RARITY_META[it.rarity]?.color || '#c5a059'};">${it.icon}</span>
                            <span style="font-size:0.8rem; color:#ded7cd; font-weight:700;">${it.name}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            itemsHtml = `<p style="color:#8c8273; font-size:0.85rem; font-style:italic;">Nenhum item recolhido.</p>`;
        }

        const html = `
            <div class="victory-modal-fx" style="text-align: center; padding: 22px 14px;">
                <div style="font-size: 2.8rem; margin-bottom: 8px; filter: drop-shadow(0 0 16px rgba(197, 160, 89, 0.9));">
                    <span class="rune-icon" style="color: #c5a059;">✦</span>
                </div>
                <h2 class="modal-title font-cinzel" style="color: #c5a059; font-size: 1.6rem; letter-spacing: 2px; text-shadow: 0 0 16px rgba(197, 160, 89, 0.6); margin-bottom: 6px;">
                    EXPEDIÇÃO VITORIOSA
                </h2>
                <div style="font-size: 0.95rem; color: #fbd38d; margin-bottom: 16px; font-style: italic;">
                    "O Carrasco de Ferro Negro sucumbiu perante sua lâmina. A Fenda silencia."
                </div>
                
                <div style="background: rgba(0,0,0,0.55); border: 1px solid #4a3b22; padding: 14px 20px; border-radius: 4px; margin: 0 auto 18px auto; max-width: 440px;">
                    <div style="display:flex; justify-content:space-around; margin-bottom: 10px; font-family: var(--font-display);">
                        <div style="color: #e2c27c;">
                            <span style="font-size:0.75rem; color:#9c9285; display:block;">OURO RESGATADO</span>
                            <strong style="font-size:1.25rem;">+${data.gold || 0} <span class="rune-icon">🜚</span></strong>
                        </div>
                        <div style="color: #a855f7;">
                            <span style="font-size:0.75rem; color:#9c9285; display:block;">ANDAR CONCLUÍDO</span>
                            <strong style="font-size:1.25rem;">Andar ${data.floor || 1}</strong>
                        </div>
                        <div style="color: #38bdf8;">
                            <span style="font-size:0.75rem; color:#9c9285; display:block;">ITENS RESGATADOS</span>
                            <strong style="font-size:1.25rem;">${items.length}</strong>
                        </div>
                    </div>
                    <div style="border-top: 1px solid #332b22; padding-top: 8px;">
                        <span style="font-size:0.75rem; color:#9c9285; font-family:var(--font-display);">ESPÓLIOS RECOLHIDOS:</span>
                        ${itemsHtml}
                    </div>
                </div>

                <div style="display: flex; justify-content: center; gap: 14px;">
                    <button class="btn btn-gothic btn-gothic-primary" id="btn-victory-extract" style="background: linear-gradient(180deg, #c5a059 0%, #8c6f36 100%); color: #000; font-weight: 800; border-color: #f5dfa8; padding: 10px 24px;">
                        <span class="rune-icon">☩</span> Retornar ao Bastião com os Espólios
                    </button>
                </div>
            </div>
        `;

        this.showModal(html);
        setTimeout(() => {
            const btn = document.getElementById('btn-victory-extract');
            if (btn) {
                btn.addEventListener('click', () => {
                    this.closeModal();
                    const cb = (typeof onReturnCallback === 'function') ? onReturnCallback : (data && typeof data.onReturn === 'function') ? data.onReturn : null;
                    if (cb) cb();
                });
            }
        }, 50);
    }

    /**
     * Show Funeral Modal upon dying in the dungeon.
     * @param {Object} data - { lostGold, lostItemsCount, penaltyPct, onRespawn }
     * @param {Function} [onRespawnCallback]
     */
    showFuneralModal(data, onRespawnCallback) {
        const html = `
            <div class="funeral-modal-fx" style="text-align: center; padding: 24px 16px;">
                <div style="font-size: 2.8rem; margin-bottom: 8px; filter: drop-shadow(0 0 16px rgba(207, 58, 58, 0.9));">
                    <span class="rune-icon" style="color: #cf3a3a;">†</span>
                </div>
                <h2 class="modal-title font-cinzel" style="color: #cf3a3a; font-size: 1.6rem; letter-spacing: 2px; text-shadow: 0 0 16px rgba(207, 58, 58, 0.6); margin-bottom: 6px;">
                    AS CINZAS REIVINDICAM SEU CORPO
                </h2>
                <div style="font-size: 0.95rem; color: #ff8c8c; margin-bottom: 18px; font-style: italic;">
                    "Sua determinação fraquejou diante da escuridão da Fenda."
                </div>

                <div style="background: rgba(20, 8, 8, 0.7); border: 1px solid #5a1e1e; padding: 14px 20px; border-radius: 4px; margin: 0 auto 20px auto; max-width: 440px;">
                    <p style="color: #e5d5d5; font-size: 0.88rem; margin: 0 0 10px 0;">
                        O Juramento cobrou seu preço. Uma fração dos espólios recolhidos nesta incursão foi perdida nas sombras:
                    </p>
                    <div style="display:flex; justify-content:space-around; font-family: var(--font-display); color: #ff6b6b;">
                        <div>
                            <span style="font-size:0.75rem; color:#a38080; display:block;">OURO PERDIDO</span>
                            <strong style="font-size:1.15rem;">-${data.lostGold || 0} <span class="rune-icon">🜚</span></strong>
                        </div>
                        <div>
                            <span style="font-size:0.75rem; color:#a38080; display:block;">ITENS PERDIDOS</span>
                            <strong style="font-size:1.15rem;">-${data.lostItemsCount || 0}</strong>
                        </div>
                        <div>
                            <span style="font-size:0.75rem; color:#a38080; display:block;">PENALIDADE</span>
                            <strong style="font-size:1.15rem;">${data.penaltyPct || 25}%</strong>
                        </div>
                    </div>
                    ${data.keyBroken ? `<p style="color:#ef4444; font-size:0.8rem; margin-top:8px;">A Chave da Fenda foi estilhaçada pelo impacto!</p>` : ''}
                </div>

                <div style="display: flex; justify-content: center; gap: 14px;">
                    <button class="btn btn-gothic btn-gothic-primary" id="btn-funeral-respawn" style="background: linear-gradient(180deg, #611212 0%, #2b0808 100%); border-color: #cf3a3a; color: #fff; padding: 10px 24px;">
                        <span class="rune-icon">🜂</span> Renascer na Pira Central
                    </button>
                </div>
            </div>
        `;

        this.showModal(html);
        setTimeout(() => {
            const btn = document.getElementById('btn-funeral-respawn');
            if (btn) {
                btn.addEventListener('click', () => {
                    this.closeModal();
                    const cb = (typeof onRespawnCallback === 'function') ? onRespawnCallback : (data && typeof data.onRespawn === 'function') ? data.onRespawn : null;
                    if (cb) cb();
                });
            }
        }, 50);
    }

    showRubricsAwakeningCelebration() {
        const html = `
            <div class="awakening-modal-fx" style="text-align: center; padding: 24px 16px;">
                <div style="font-size: 3rem; margin-bottom: 8px; filter: drop-shadow(0 0 16px rgba(249,115,22,0.9));">
                    <span class="rune-icon" style="color: #f97316;">✦</span>
                </div>
                <h2 class="modal-title font-cinzel" style="color: #f97316; font-size: 1.6rem; letter-spacing: 2px; text-shadow: 0 0 16px rgba(249,115,22,0.6); margin-bottom: 8px;">
                    O DESPERTAR DAS RÚBRICAS
                </h2>
                <div style="font-size: 0.95rem; color: #fbd38d; margin-bottom: 16px; font-style: italic;">
                    "As correntes rúnicas do 40º círculo se romperam nas profundezas da sua alma."
                </div>
                <p style="color: #ded7cd; font-size: 0.92rem; line-height: 1.6; max-width: 480px; margin: 0 auto 20px auto;">
                    Você superou o domínio elemental da sua vocação. A partir deste momento, cada nível conquistado concede <strong style="color: #f97316;">Pontos de Rúbrica</strong> para trilhar a imensa <strong>Teia Astral</strong>, desbloqueando especializações híbridas e pedras angulares lendárias.
                </p>
                <div style="display: flex; justify-content: center; gap: 14px;">
                    <button class="btn btn-gothic btn-gothic-primary" id="btn-open-rubrics-awakened" style="background: linear-gradient(180deg, #ea580c 0%, #7c2d12 100%); border-color: #f97316; color: #fff;">
                        <span class="rune-icon">✦</span> Contemplar a Teia Astral
                    </button>
                    <button class="btn btn-gothic btn-gothic-secondary" onclick="uiManager.closeModal()">
                        Prosseguir
                    </button>
                </div>
            </div>
        `;
        this.showModal(html);
        setTimeout(() => {
            const btn = document.getElementById('btn-open-rubrics-awakened');
            if (btn) {
                btn.addEventListener('click', () => {
                    this.closeModal();
                    this.showSkillTreeModal('rubrics');
                });
            }
        }, 50);
    }

    showInventoryModal() {
        const char = this.state.character;
        if (!char) return;

        let html = `<h2 class="modal-title"><span class="rune-icon">†</span> Inventário (${char.inventory.length}/${char.maxInventory})</h2>`;

        // Equipment - 4 core slots highlighted
        html += `<h3 style="color: var(--accent-gold); margin-bottom: 8px; font-family: var(--font-display); font-size: 0.9rem; text-transform:uppercase; letter-spacing:1px;">Equipamento Ativo (Clique para Desequipar)</h3>`;
        html += `<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px;">`;
        
        const coreSlots = ['weapon', 'armor', 'ring', 'amulet'];
        for (const slot of coreSlots) {
            const item = char.equipment ? char.equipment[slot] : null;
            const slotMeta = {
                weapon: { label: 'Arma Principal', icon: '†' },
                armor:  { label: 'Armadura Peitoral', icon: '⛊' },
                ring:   { label: 'Anel / Relíquia', icon: '○' },
                amulet: { label: 'Amuleto', icon: '◇' }
            }[slot];

            if (item) {
                const statDesc = item.baseDamage ? `Dano: +${item.effectiveDamage || item.baseDamage}` : (item.baseArmor ? `Armadura: +${item.effectiveArmor || item.baseArmor}` : '');
                html += `<div class="inv-slot has-item" data-slot="${slot}" style="--slot-rarity: ${RARITY_META[item.rarity]?.color || '#c5a059'}; aspect-ratio: auto; padding: 10px 8px; flex-direction: column; font-size: 0.75rem; cursor: pointer; border: 1.5px solid ${RARITY_META[item.rarity]?.color || '#c5a059'};" title="${item.name} (${statDesc}) - Clique para desequipar">
                    <span class="rune-icon" style="font-size: 1.3rem;">${item.icon}</span>
                    <span style="color: ${RARITY_META[item.rarity]?.color || '#c5a059'}; font-weight: 700; font-size: 0.76rem; text-align: center;">${item.name}</span>
                    <span style="color: var(--text-muted); font-size: 0.65rem;">${slotMeta.label}</span>
                </div>`;
            } else {
                html += `<div class="inv-slot" style="aspect-ratio: auto; padding: 10px 8px; font-size: 0.7rem; color: var(--text-muted); flex-direction: column; gap: 4px; background: rgba(0,0,0,0.3); border: 1px dashed #3a322d;">
                    <span class="rune-icon" style="opacity: 0.35; font-size: 1.2rem;">${slotMeta.icon}</span>
                    <span style="font-size: 0.68rem; text-align: center;">${slotMeta.label}</span>
                </div>`;
            }
        }
        html += `</div>`;

        // Inventory items
        html += `<h3 style="color: var(--text-primary); margin-bottom: 8px; font-family: var(--font-display); font-size: 0.9rem; text-transform:uppercase; letter-spacing:1px;">Algibeira (${char.inventory.length}/${char.maxInventory})</h3>`;
        html += `<div class="inventory-grid">`;
        for (let i = 0; i < char.maxInventory; i++) {
            const item = char.inventory[i];
            if (item) {
                const statDesc = item.baseDamage ? `[Dano +${item.baseDamage}]` : (item.baseArmor ? `[Armadura +${item.baseArmor}]` : (item.quantity ? `[x${item.quantity}]` : ''));
                html += `<div class="inv-slot has-item" style="--slot-rarity: ${RARITY_META[item.rarity]?.color || '#8a8580'}; cursor: pointer;" data-item-idx="${i}" title="${item.name} ${statDesc}">
                    <span class="rune-icon">${item.icon}</span>
                </div>`;
            } else {
                html += `<div class="inv-slot"></div>`;
            }
        }
        html += `</div>`;

        html += `<button class="btn btn-gothic btn-gothic-secondary" onclick="uiManager.closeModal()" style="margin-top:16px; width: 100%;">Fechar Algibeira</button>`;

        this.showModal(html);

        setTimeout(() => {
            // Equip item from inventory
            this.dom.modalContent.querySelectorAll('[data-item-idx]').forEach(el => {
                el.addEventListener('click', () => {
                    const idx = parseInt(el.dataset.itemIdx);
                    const item = char.inventory[idx];
                    if (item && item.type !== ItemType.MATERIAL && item.type !== ItemType.KEY) {
                        const equipped = char.equipItem(item.id);
                        if (equipped) {
                            this.notify(`${item.icon} ${item.name} empunhado!`, 'info');
                            this.updateCharacterHUD(char);
                            this.showInventoryModal();
                        }
                    }
                });
            });

            // Unequip item from equipment slots
            this.dom.modalContent.querySelectorAll('[data-slot]').forEach(el => {
                el.addEventListener('click', () => {
                    const slot = el.dataset.slot;
                    if (slot && char.equipment && char.equipment[slot]) {
                        const unequipped = char.unequipItem(slot);
                        if (unequipped) {
                            this.notify(`Item desequipado para a algibeira.`, 'info');
                            this.updateCharacterHUD(char);
                            this.showInventoryModal();
                        }
                    }
                });
            });
        }, 50);
    }

    showStatsModal() {
        const char = this.state.character;
        if (!char) return;

        const freePoints = char.attributePoints || 0;

        const primaryStats = [
            { id: 'strength',     label: 'Força',        value: char.stats.strength || char.baseStats.strength,     rune: 'ᛏ', benefit: '+2.5 Dano Físico • +0.4% Dano Crítico' },
            { id: 'dexterity',    label: 'Destreza',     value: char.stats.dexterity || char.baseStats.dexterity,    rune: 'ᚱ', benefit: '+0.4% Vel. Ataque • +0.3% Chance Crítica • +0.2% Esquiva' },
            { id: 'vitality',     label: 'Vitalidade',   value: char.stats.vitality || char.baseStats.vitality,     rune: 'ᚦ', benefit: '+18 Vida Máxima • +0.8 Armadura' },
            { id: (char.classId === 'mage' || char.classId === 'necromancer') ? 'intelligence' : 'faith',
                                  label: (char.classId === 'mage' || char.classId === 'necromancer') ? 'Éter / Inteligência' : 'Fé / Sagrado',
                                                         value: (char.classId === 'mage' || char.classId === 'necromancer') ? (char.stats.intelligence || char.baseStats.intelligence) : (char.stats.faith || char.baseStats.faith),
                                                                                                                     rune: 'ᛉ', benefit: '+12 Recurso Máximo • +1.8 Dano Arcano' },
        ];

        const combat = [
            { label: 'Dano Base',       value: char.baseDamage },
            { label: 'Vida Máx',        value: char.maxHp },
            { label: 'Armadura',        value: char.armor },
            { label: 'Chance Crítica',  value: char.critChance.toFixed(1) + '%' },
            { label: 'Dano Crítico',    value: char.critDamage.toFixed(1) + '%' },
            { label: 'Vel. Ataque',     value: char.attackSpeed.toFixed(2) + '/s' },
            { label: 'Roubo de Vida',   value: char.lifeSteal + '%' },
        ];

        let html = `
            <div class="stats-modal-container">
                <div class="stats-header-row" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #5a4625; padding-bottom:8px; margin-bottom:14px;">
                    <div>
                        <h2 class="modal-title" style="margin:0; border:none; padding:0;"><span class="rune-icon">⛊</span> Ficha de Atributos</h2>
                        <span style="font-size:0.8rem; color:var(--text-muted);">${char.className} • Nível ${char.level}</span>
                    </div>
                    <div class="free-attr-badge" style="background:#131115; border:1px solid ${freePoints > 0 ? '#c5a059' : '#3d3742'}; padding:6px 14px; border-radius:4px; box-shadow:inset 0 0 10px #000;">
                        <span style="font-family:var(--font-display); font-size:0.75rem; color:#9e9589; letter-spacing:1px; margin-right:6px;">PONTOS LIVRES:</span>
                        <strong style="font-family:var(--font-display); font-size:1.15rem; color:${freePoints > 0 ? '#e6c57e' : '#635d54'}; text-shadow:${freePoints > 0 ? '0 0 8px rgba(197,160,89,0.6)' : 'none'};">${freePoints}</strong>
                    </div>
                </div>

                <h3 style="color: var(--accent-gold); margin: 0 0 8px 0; font-family: var(--font-display); font-size: 0.9rem; text-transform:uppercase; letter-spacing:1px;">
                    Atributos Primários
                </h3>
                <div class="attr-alloc-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
        `;

        for (const s of primaryStats) {
            html += `
                <div class="attr-alloc-row" style="display:flex; align-items:center; justify-content:space-between; background:#141216; border:1px solid #332d29; border-radius:4px; padding:8px 12px; box-shadow:inset 0 0 10px #000;">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="rune-icon" style="font-size:1.1rem;">${s.rune}</span>
                            <span style="font-family:var(--font-display); font-weight:700; color:#ded7cd; font-size:0.95rem;">${s.label}</span>
                        </div>
                        <span style="font-size:0.72rem; color:#8c8273; font-style:italic;">${s.benefit}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-family:var(--font-display); font-size:1.15rem; font-weight:700; color:#e2c27c; min-width:32px; text-align:right;">${s.value}</span>
                        <button class="btn-stat-add" data-stat="${s.id}" ${freePoints <= 0 ? 'disabled' : ''} style="background:${freePoints > 0 ? 'linear-gradient(180deg, #c5a059 0%, #8c6f36 100%)' : '#1f1e21'}; color:${freePoints > 0 ? '#0b090d' : '#4d4740'}; border:1px solid ${freePoints > 0 ? '#e6c57e' : '#2b292e'}; border-radius:3px; padding:3px 10px; font-family:var(--font-display); font-weight:900; font-size:0.85rem; cursor:${freePoints > 0 ? 'pointer' : 'not-allowed'}; box-shadow:${freePoints > 0 ? '0 0 8px rgba(197,160,89,0.4)' : 'none'};">
                            [ + ]
                        </button>
                    </div>
                </div>
            `;
        }

        html += `
                </div>

                <h3 style="color: var(--text-primary); margin: 0 0 8px 0; font-family: var(--font-display); font-size: 0.9rem; text-transform:uppercase; letter-spacing:1px;">
                    Estatísticas de Combate
                </h3>
                <div class="stats-grid">
        `;

        for (const c of combat) {
            html += `<div class="stat-card">
                <div class="stat-label">${c.label}</div>
                <div class="stat-value">${c.value}</div>
            </div>`;
        }
        html += `</div>`;

        html += `<button class="btn btn-gothic btn-gothic-secondary" onclick="uiManager.closeModal()" style="margin-top:16px; width:100%;">Fechar</button></div>`;
        this.showModal(html);

        // Bind [ + ] buttons
        setTimeout(() => {
            this.dom.modalContent.querySelectorAll('.btn-stat-add').forEach(btn => {
                btn.addEventListener('click', () => {
                    const stat = btn.dataset.stat;
                    if (stat && this.attributeManager) {
                        const res = this.attributeManager.spendPoint(stat);
                        if (res.success) {
                            this.notify(`☩ Ponto alocado em ${stat}!`, 'info');
                            this.updateCharacterHUD(this.state.character);
                            this.showStatsModal();
                        }
                    }
                });
            });
        }, 50);
    }

    showAscensionModal() {
        const ashesReward = this.state.getAscensionAshesReward();
        const currentAshes = this.state.resources[ResourceType.ASHES];
        const mult = (1 + currentAshes * ASCENSION_MULTIPLIER_PER_ASH) * 100;

        let html = `
            <div class="ascension-panel" style="border: none; padding: 0; background: none;">
                <h2 class="ascension-title"><span class="rune-icon">🜂</span> Ascensão das Cinzas</h2>
                <p class="ascension-desc">
                    Sacrifique seu acampamento atual (nós, ouro e trabalhadores) ao abismo em troca de
                    <strong style="color: var(--color-ashes);">Cinzas Sagradas</strong>.
                    Esta oferenda garante multiplicadores permanentes de velocidade às forjas e expedições futuras.
                </p>
                <div style="margin-bottom: 16px;">
                    <p style="font-size: 0.85rem; color: var(--text-secondary);">Cinzas acumuladas: <strong style="color: var(--color-ashes);">${currentAshes}</strong></p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary);">Poder ancestral: <strong style="color: var(--accent-green);">${mult.toFixed(0)}%</strong></p>
                </div>
                <p class="ascension-reward">Tributo da Purificação: +${ashesReward} <span class="rune-icon">🜂</span> Cinzas Sagradas</p>
                <div style="display: flex; gap: 12px; justify-content: center; margin-top: 16px;">
                    <button class="btn btn-gothic btn-gothic-danger" id="btn-do-ascension">
                        <span class="rune-icon">🜂</span> Consumir em Cinzas
                    </button>
                    <button class="btn btn-gothic btn-gothic-secondary" onclick="uiManager.closeModal()">Preservar Matéria</button>
                </div>
            </div>
        `;
        this.showModal(html);

        setTimeout(() => {
            const btn = document.getElementById('btn-do-ascension');
            if (btn) {
                btn.addEventListener('click', () => {
                    const shouldConfirm = (!window.SettingsManager || window.SettingsManager.get('gameplay.confirmAscension') !== false);
                    if (shouldConfirm) {
                        const ok = window.confirm('ATENÇÃO: Deseja realmente ascender e sacrificar o acampamento atual em troca de Cinzas Sagradas?');
                        if (!ok) return;
                    }
                    this.state.performAscension();
                    this.closeModal();
                });
            }
        }, 50);
    }

    showSkillTreeModal(activeTab = null) {
        const char = this.state.character;
        if (!char || !char.skillTree) return;

        if (activeTab) {
            this._activeSkillModalTab = activeTab;
        } else if (!this._activeSkillModalTab) {
            this._activeSkillModalTab = 'class';
        }

        // Clean up previous canvas if any
        if (this.rubricsCanvas) {
            this.rubricsCanvas.destroy();
            this.rubricsCanvas = null;
        }

        const progression = char.progression;
        const respecCost = progression.getRespecCost();
        const canAffordRespec = (this.state.resources[ResourceType.GOLD] || 0) >= respecCost.gold &&
                                (this.state.resources[ResourceType.ORE] || 0) >= respecCost.ore;

        this.dom.modalContent.classList.add('modal-skill-tree');

        const isRubrics = (this._activeSkillModalTab === 'rubrics');
        const isLevel40Plus = (char.level >= 40 || (progression && progression.isRubricUnlocked));

        let html = `
            <div class="skill-tree-modal">
                <!-- Dual-Tab Navigation Bar -->
                <div class="skill-tabs-nav">
                    <button class="skill-tab-btn ${!isRubrics ? 'active' : ''}" data-target-tab="class">
                        <span class="rune-icon">ᛉ</span> Vocação da Classe (1–40)
                        ${progression.skillPoints > 0 ? `<span class="tab-point-badge">${progression.skillPoints}</span>` : ''}
                    </button>
                    <button class="skill-tab-btn ${isRubrics ? 'active' : ''}" data-target-tab="rubrics">
                        <span class="rune-icon">✦</span> As Rúbricas Ancestrais (Pós-40)
                        ${isLevel40Plus 
                            ? (progression.rubricPoints > 0 ? `<span class="tab-point-badge rubric">${progression.rubricPoints}</span>` : '')
                            : `<span class="tab-sealed-lock" title="Selado até o nível 40">🔒</span>`
                        }
                    </button>
                </div>
        `;

        if (!isRubrics) {
            // ═══════════════════════════════════════════
            //  FASE 1: DOMÍNIO DA VOCAÇÃO (CLASSE)
            // ═══════════════════════════════════════════
            html += `
                <div class="skill-tree-header">
                    <div>
                        <h2 class="modal-title" style="margin-bottom: 2px;"><span class="rune-icon">ᛉ</span> Grimório de Habilidades — ${char.className}</h2>
                        <span style="font-size: 0.82rem; color: var(--text-secondary);">
                            Nível ${progression.level} • XP Ativo: <strong style="color:var(--accent-orange);">${Utils.formatNumber(progression.activeXP)}</strong> • XP Passivo: <strong style="color:var(--accent-cyan);">${Utils.formatNumber(progression.passiveXP)}</strong>
                        </span>
                    </div>
                    <div class="skill-points-badge">
                        <span>PONTOS DE GLIFO:</span>
                        <strong>${progression.skillPoints}</strong>
                    </div>
                </div>

                <div class="tiers-container">
            `;

            const allSkills = char.skillTree.getAllSkills();
            for (const skill of allSkills) {
                const isUnlocked = skill.unlocked === true || 
                                   (typeof skill.level === 'number' && skill.level >= 1) || 
                                   skill.isAllocated === true || 
                                   (typeof skill.allocated === 'number' && skill.allocated > 0);
                const validation = !isUnlocked ? this.skillTreeManager.validatePrereqs(skill.id) : { valid: false };

                const tierNames = {
                    1: 'Tier I — Básica & Geradora',
                    2: 'Tier II — Mobilidade & Esquiva',
                    3: 'Tier III — Central de Dano & Mutações',
                    4: 'Tier IV — Suprema & Grande Área',
                };

                html += `
                    <div class="tier-card ${isUnlocked ? 'unlocked' : 'locked'}">
                        <div class="tier-header">
                            <span class="tier-tag">${tierNames[skill.tier] || ('Tier ' + skill.tier)}</span>
                            <span class="tier-level-req">Nível Requerido: ${skill.requiredLevel}</span>
                        </div>
                        <div class="tier-main">
                            <div class="skill-big-icon rune-icon">${skill.icon}</div>
                            <div class="skill-info">
                                <div class="skill-name-row">
                                    <span class="skill-name">${skill.name}</span>
                                    <span class="skill-key-badge">Tecla ${skill.key || (skill.tier === 1 ? 'Q' : skill.tier === 2 ? 'W' : skill.tier === 3 ? 'E' : 'R')}</span>
                                </div>
                                <div class="skill-meta">
                                    <span><span class="rune-icon">ᛟ</span> Recarga: ${skill.cooldown > 0 ? skill.cooldown + 's' : 'Instantâneo'}</span>
                                    <span><span class="rune-icon">🜂</span> Custo: ${skill.cost > 0 ? skill.cost + ' ' + skill.resourceType : 'Nenhum'}</span>
                                </div>
                                <p class="skill-desc">${skill.desc}</p>
                `;

                // Tier 3 Mutations
                if (skill.modifiers && skill.modifiers.length > 0) {
                    html += `
                        <div class="modifiers-section">
                            <div class="modifiers-title"><span class="rune-icon">ᛟ</span> Modificadores de Mutação (Escolha 1 variante ativa)</div>
                            <div class="modifiers-grid">
                    `;

                    for (const mod of skill.modifiers) {
                        const isActive = isUnlocked && (
                            skill.activeModifierId === mod.id || 
                            (char && char.activeMutations && char.activeMutations[skill.id] === mod.id)
                        );
                        html += `
                            <div class="modifier-card ${isActive ? 'active' : ''}" 
                                 data-skill-id="${skill.id}" 
                                 data-mod-id="${mod.id}"
                                 title="${isUnlocked ? 'Clique para ativar esta mutação' : 'Desbloqueie a habilidade para alternar mutações'}">
                                <div class="modifier-card-header">
                                    <span class="modifier-name"><span class="rune-icon">${mod.icon}</span> ${mod.name}</span>
                                    <span class="modifier-status-radio"></span>
                                </div>
                                <p class="modifier-desc">${mod.desc}</p>
                            </div>
                        `;
                    }

                    html += `
                            </div>
                        </div>
                    `;
                }

                html += `
                            </div>
                `;

                // Action button / status
                if (isUnlocked) {
                    html += `
                        <div style="align-self: center; text-align: right; min-width: 130px;">
                            <button class="btn btn-gothic btn-sm" disabled style="color: var(--accent-green); border-color: var(--accent-green); opacity: 0.9;">
                                ✓ Alocado
                            </button>
                        </div>
                    `;
                } else if (validation.valid) {
                    html += `
                        <div style="align-self: center; text-align: right; min-width: 130px;">
                            <button class="btn btn-gothic btn-gothic-primary btn-sm btn-unlock-skill" data-unlock-id="${skill.id}" title="Alocar 1 Ponto de Glifo">
                                <span class="rune-icon">ᛉ</span> [+ Alocar]
                            </button>
                        </div>
                    `;
                } else {
                    html += `
                        <div style="align-self: center; text-align: right; min-width: 130px;">
                            <button class="btn btn-gothic btn-sm" disabled title="${validation.reason || 'Requisitos não cumpridos'}">
                                <span class="rune-icon">ᚾ</span> [+ Alocar]
                            </button>
                            <span style="color: var(--text-muted); font-size: 0.72rem; display: block; margin-top: 4px; max-width: 130px;">
                                ${validation.reason || 'Bloqueado'}
                            </span>
                        </div>
                    `;
                }

                html += `
                        </div>
                    </div>
                `;
            }

            html += `
                    </div>

                    <!-- Respec Panel -->
                    <div class="respec-panel">
                        <div class="respec-info">
                            <h4><span class="rune-icon">☩</span> Purificação dos Glifos (Respec)</h4>
                            <p class="respec-desc">Redefine as habilidades acima do Tier 1 e recupera todos os pontos de glifos consumidos.</p>
                            <div class="respec-cost">
                                <span>Tributo:</span>
                                <span style="color: var(--color-gold);"><span class="rune-icon">🜚</span> ${respecCost.gold} Ouro</span>
                                <span style="color: var(--color-ore);"><span class="rune-icon">🜛</span> ${respecCost.ore} Minério</span>
                            </div>
                        </div>
                        <button class="btn btn-gothic btn-gothic-danger btn-sm" id="btn-execute-respec" ${canAffordRespec ? '' : 'disabled title="Tributo insuficiente"'}>
                            <span class="rune-icon">☩</span> Redefinir Árvore
                        </button>
                    </div>
            `;
        } else {
            // ═══════════════════════════════════════════
            //  FASE 2: AS RÚBRICAS ANCESTRAIS (TEIA ASTRAL)
            // ═══════════════════════════════════════════
            if (!isLevel40Plus) {
                // Selado por correntes rúnicas até o nível 40
                const currentLvl = char.level;
                const progressPct = Math.min(100, Math.max(0, Math.round((currentLvl / 40) * 100)));
                html += `
                    <div class="rubrics-sealed-container">
                        <div class="rubrics-sealed-chain-icon rune-icon">⛓</div>
                        <h3 class="rubrics-sealed-title font-cinzel">As Rúbricas Ancestrais</h3>
                        <div class="rubrics-sealed-progress-wrap">
                            <div class="rubrics-sealed-progress-bar" style="width: ${progressPct}%;"></div>
                        </div>
                        <div class="rubrics-sealed-level-text">
                            Círculo de Penitência Atual: <strong>${currentLvl} / 40</strong>
                        </div>
                        <p class="rubrics-sealed-message">
                            "As Rúbricas Ancestrais despertam apenas para aqueles que atingirem o 40º círculo de penitência."
                        </p>
                    </div>
                `;
            } else {
                // Desbloqueado: Teia Astral Interconectada em Canvas
                html += `
                    <div class="rubrics-active-container">
                        <div class="rubrics-toolbar">
                            <div class="rubrics-stats-summary">
                                <span class="rubrics-points-label">PONTOS DE RÚBRICA:</span>
                                <strong class="rubrics-points-value">${progression.rubricPoints || 0}</strong>
                                <span class="rubrics-allocated-label">Alocados: <strong>${char.rubricsAllocated ? char.rubricsAllocated.length : 0}</strong></span>
                            </div>
                            <div class="rubrics-tool-actions">
                                <button class="btn btn-gothic btn-sm" id="btn-rubrics-zoom-in" title="Aproximar Visão">+</button>
                                <button class="btn btn-gothic btn-sm" id="btn-rubrics-zoom-out" title="Afastar Visão">-</button>
                                <button class="btn btn-gothic btn-sm" id="btn-rubrics-center" title="Centralizar no seu Arquétipo">⌂ Origem</button>
                                <button class="btn btn-gothic btn-gothic-danger btn-sm" id="btn-rubrics-respec" title="Redefinir todas as Rúbricas alocadas">
                                    <span class="rune-icon">☩</span> Redefinir Rúbricas
                                </button>
                            </div>
                        </div>
                        <div class="rubrics-canvas-wrapper" id="rubrics-canvas-container" style="position: relative; width: 100%; height: 520px; overflow: hidden; border: 1px solid #4a3b22; background: #07070a; border-radius: 4px; box-shadow: inset 0 0 40px #000;">
                            <canvas id="rubrics-canvas" width="900" height="520" style="display: block; width: 100%; height: 100%; cursor: grab;"></canvas>
                        </div>
                    </div>
                `;
            }
        }

        html += `
                <div style="text-align: center; margin-top: 14px;">
                    <button class="btn btn-gothic btn-gothic-secondary" onclick="uiManager.closeModal()">Fechar Grimório</button>
                </div>
            </div>
        `;

        this.showModal(html);

        // Bind interactive elements
        setTimeout(() => {
            // Tab Buttons navigation
            this.dom.modalContent.querySelectorAll('.skill-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const targetTab = btn.dataset.targetTab;
                    this.showSkillTreeModal(targetTab);
                });
            });

            if (!isRubrics) {
                // Class Tree Binds
                this.dom.modalContent.querySelectorAll('[data-unlock-id]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const skillId = btn.dataset.unlockId;
                        const res = this.skillTreeManager.spendPoint(skillId);
                        if (res.success) {
                            this.showSkillTreeModal('class');
                        } else {
                            this.notify(res.reason, 'error');
                        }
                    });
                });

                this.dom.modalContent.querySelectorAll('.modifier-card').forEach(card => {
                    card.addEventListener('click', () => {
                        const skillId = card.dataset.skillId;
                        const modId = card.dataset.modId;
                        const res = this.skillTreeManager.toggleModifier(skillId, modId);
                        if (res.success) {
                            this.showSkillTreeModal('class');
                        } else {
                            this.notify(res.reason, 'error');
                        }
                    });
                });

                const respecBtn = document.getElementById('btn-execute-respec');
                if (respecBtn) {
                    respecBtn.addEventListener('click', () => {
                        const res = this.skillTreeManager.respec();
                        if (res.success) {
                            this.showSkillTreeModal('class');
                        } else {
                            this.notify(res.reason, 'error');
                        }
                    });
                }
            } else if (isLevel40Plus) {
                // Rubrics Canvas Initialization
                const canvasEl = document.getElementById('rubrics-canvas');
                if (canvasEl && typeof RubricsCanvas !== 'undefined') {
                    this.rubricsCanvas = new RubricsCanvas(canvasEl, this.state, this);
                    this.rubricsCanvas.start();

                    const btnZoomIn = document.getElementById('btn-rubrics-zoom-in');
                    if (btnZoomIn) {
                        btnZoomIn.addEventListener('click', () => {
                            if (this.rubricsCanvas) {
                                this.rubricsCanvas.zoom(0.2);
                            }
                        });
                    }

                    const btnZoomOut = document.getElementById('btn-rubrics-zoom-out');
                    if (btnZoomOut) {
                        btnZoomOut.addEventListener('click', () => {
                            if (this.rubricsCanvas) {
                                this.rubricsCanvas.zoom(-0.2);
                            }
                        });
                    }

                    const btnCenter = document.getElementById('btn-rubrics-center');
                    if (btnCenter) {
                        btnCenter.addEventListener('click', () => {
                            if (this.rubricsCanvas) {
                                this.rubricsCanvas.centerOnClassOrigin();
                            }
                        });
                    }

                    const btnRubricsRespec = document.getElementById('btn-rubrics-respec');
                    if (btnRubricsRespec) {
                        btnRubricsRespec.addEventListener('click', () => {
                            if (!char.rubricsAllocated || char.rubricsAllocated.length === 0) {
                                this.notify('Nenhuma Rúbrica alocada para redefinir.', 'info');
                                return;
                            }
                            const refunded = char.respecRubrics();
                            this.notify(`☩ Rúbricas purificadas! +${refunded} pontos devolvidos.`, 'info');
                            this.updateCharacterHUD(char);
                            this.showSkillTreeModal('rubrics');
                        });
                    }
                }
            }
        }, 50);
    }

    // ─── Helpers ───
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

console.log('[UIManager] Class loaded.');
