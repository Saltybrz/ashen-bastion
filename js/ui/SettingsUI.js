/**
 * ============================================================================
 * SettingsUI.js
 * Gothic Modal Interface & Reactive Controller for In Search of Hope
 * Handles Audio, Visual, Gameplay, and Key Remapping Tab Interactions
 * ============================================================================
 */

(function (window) {
    'use strict';

    class SettingsUIClass {
        constructor() {
            this.modalEl = null;
            this.activeTab = 'audio';
            this.workingSettings = null;
            this.remappingAction = null;
            this.remapListener = null;
            this.remapMouseListener = null;
            this.isOpen = false;
        }

        init() {
            this._renderModalDOM();
            this._bindDOMEvents();
            this._bindGlobalShortcuts();
            console.log('[SettingsUI] Initialized and bound to global ESC & UI triggers.');
        }

        /**
         * Open Settings Modal at specific tab.
         */
        open(tabName = 'audio') {
            if (!this.modalEl) this.init();

            // Clone working settings from SettingsManager
            this.workingSettings = JSON.parse(JSON.stringify(window.SettingsManager.settings));
            this.isOpen = true;

            // Pause Dungeon simulation if inside dungeon
            if (window.dungeonEngine && typeof window.dungeonEngine === 'object') {
                window.dungeonEngine.isPausedBySettings = true;
            }

            this.switchTab(tabName);
            this._syncFormFromWorking();

            this.modalEl.classList.add('active');

            if (window.AudioManager) {
                window.AudioManager.playClick(600);
            }
        }

        /**
         * Close Settings Modal without saving uncommitted changes.
         */
        close() {
            if (!this.isOpen) return;
            this._cancelRemapping();

            this.isOpen = false;
            if (this.modalEl) {
                this.modalEl.classList.remove('active');
            }

            // Unpause Dungeon simulation
            if (window.dungeonEngine && typeof window.dungeonEngine === 'object') {
                window.dungeonEngine.isPausedBySettings = false;
            }

            if (window.AudioManager) {
                window.AudioManager.playClick(480);
            }
        }

        /**
         * Switch Heraldic Tab.
         */
        switchTab(tabName) {
            this._cancelRemapping();
            this.activeTab = tabName;

            // Tab Buttons
            const tabButtons = this.modalEl.querySelectorAll('.settings-tab-btn');
            tabButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tabName);
            });

            // Tab Panes
            const panes = this.modalEl.querySelectorAll('.settings-pane');
            panes.forEach(pane => {
                pane.classList.toggle('active', pane.dataset.pane === tabName);
            });

            if (window.AudioManager) {
                window.AudioManager.playClick(720);
            }
        }

        /**
         * Apply & Save to localStorage and notify engines.
         */
        applyAndSave() {
            this._cancelRemapping();
            window.SettingsManager.save(this.workingSettings);

            if (window.AudioManager) {
                window.AudioManager.playClick(880);
            }

            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast('Configurações gravadas nas cinzas do Bastião.');
            }

            this.close();
        }

        /**
         * Reset all defaults with confirmation.
         */
        resetToDefaults() {
            const confirmed = window.confirm('Deseja restaurar todas as configurações originais do Bastião?');
            if (!confirmed) return;

            window.SettingsManager.resetDefaults();
            this.workingSettings = JSON.parse(JSON.stringify(window.SettingsManager.settings));
            this._syncFormFromWorking();

            if (window.AudioManager) {
                window.AudioManager.playClash(true);
            }

            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast('Padrões restaurados com sucesso.');
            }
        }

        // ══════════════════════════════════════════════════════════════
        //  FORM SYNCHRONIZATION & RENDERING
        // ══════════════════════════════════════════════════════════════

        _syncFormFromWorking() {
            const s = this.workingSettings;
            if (!s || !this.modalEl) return;

            // --- ABA 1: ÁUDIO ---
            this._syncSlider('audio-master', s.audio.masterVolume, (v) => `${Math.round(v * 100)}%`);
            this._syncSlider('audio-music', s.audio.musicVolume, (v) => `${Math.round(v * 100)}%`);
            this._syncSlider('audio-sfx', s.audio.sfxVolume, (v) => `${Math.round(v * 100)}%`);
            this._syncSlider('audio-ambience', s.audio.ambienceVolume, (v) => `${Math.round(v * 100)}%`);
            this._syncToggle('toggle-mute-blur', s.audio.muteOnBlur);

            // --- ABA 2: VISUAL ---
            this._syncFullscreenBtn();
            this._syncSlider('visual-shake', s.visual.screenShakeIntensity, (v) => `${Math.round(v * 100)}%`);
            this._syncToggle('toggle-hit-flash', s.visual.hitFlashEnabled);
            this._syncPillGroup('ember-density-group', s.visual.emberDensity);
            this._syncSlider('visual-brightness', s.visual.brightness, (v) => `${Math.round(v * 100)}%`);

            // --- ABA 3: JOGABILIDADE ---
            this._syncToggle('toggle-damage-numbers', s.gameplay.showDamageNumbers);
            this._syncPillGroup('enemy-hp-group', s.gameplay.enemyHealthBars);
            this._syncPillGroup('attack-aim-group', s.gameplay.attackAim);
            this._syncToggle('toggle-pause-modals', s.gameplay.pauseOnModals);
            this._syncToggle('toggle-confirm-ascension', s.gameplay.confirmAscension);

            // --- ABA 4: CONTROLES ---
            this._renderRemapList();
        }

        _syncSlider(id, value, formatFn) {
            const slider = this.modalEl.querySelector(`#${id}`);
            const label = this.modalEl.querySelector(`#${id}-val`);
            if (slider) slider.value = value;
            if (label) label.textContent = formatFn(value);
        }

        _syncToggle(id, isActive) {
            const btn = this.modalEl.querySelector(`#${id}`);
            if (!btn) return;
            btn.classList.toggle('active', !!isActive);
            const textSpan = btn.querySelector('.toggle-label');
            const runeSpan = btn.querySelector('.toggle-rune');
            if (textSpan) textSpan.textContent = isActive ? 'Ligado' : 'Desligado';
            if (runeSpan) runeSpan.textContent = isActive ? 'ᛏ' : '○';
        }

        _syncPillGroup(groupId, activeValue) {
            const group = this.modalEl.querySelector(`#${groupId}`);
            if (!group) return;
            const btns = group.querySelectorAll('.settings-pill-btn');
            btns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.val === activeValue);
            });
        }

        _syncFullscreenBtn() {
            const btn = this.modalEl.querySelector('#btn-toggle-fullscreen');
            if (!btn) return;
            const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
            btn.querySelector('.btn-label').textContent = isFs ? 'Modo Janela' : 'Tela Cheia';
            btn.classList.toggle('active', isFs);
        }

        _renderRemapList() {
            const container = this.modalEl.querySelector('#remap-slots-container');
            if (!container) return;

            const controls = this.workingSettings.controls;
            let html = '';

            for (const [action, code] of Object.entries(controls)) {
                const label = window.SettingsManager.getActionLabel(action);
                const display = window.SettingsManager.getKeyDisplay(code);
                html += `
                    <div class="setting-row">
                        <div class="setting-info">
                            <span class="setting-label">${label}</span>
                        </div>
                        <div class="setting-control">
                            <button type="button" class="remap-slot-btn" data-action="${action}" id="remap-${action}">
                                ${display}
                            </button>
                        </div>
                    </div>
                `;
            }

            container.innerHTML = html;

            // Bind click to each remap button
            const btns = container.querySelectorAll('.remap-slot-btn');
            btns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._startRemapping(btn.dataset.action);
                });
            });
        }

        // ══════════════════════════════════════════════════════════════
        //  INTERACTIVE KEY REMAPPING SYSTEM
        // ══════════════════════════════════════════════════════════════

        _startRemapping(action) {
            this._cancelRemapping();

            this.remappingAction = action;
            const btn = this.modalEl.querySelector(`#remap-${action}`);
            if (!btn) return;

            btn.classList.add('listening');
            btn.textContent = 'Pressione uma tecla...';

            const banner = this.modalEl.querySelector('#remap-status-banner');
            if (banner) {
                banner.textContent = 'Aguardando tecla para ' + window.SettingsManager.getActionLabel(action) + ' (ESC para cancelar)';
                banner.classList.add('show');
            }

            if (window.AudioManager) {
                window.AudioManager.playClick(900);
            }

            // Keyboard listener
            this.remapListener = (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (e.code === 'Escape') {
                    this._cancelRemapping();
                    return;
                }

                this._finishRemap(action, e.code);
            };

            // Mouse button listener (supports Mouse 1, 2, 3)
            this.remapMouseListener = (e) => {
                e.preventDefault();
                e.stopPropagation();

                const mouseCode = `Mouse${e.button}`;
                this._finishRemap(action, mouseCode);
            };

            window.addEventListener('keydown', this.remapListener, { capture: true, once: true });
            window.addEventListener('mousedown', this.remapMouseListener, { capture: true, once: true });
        }

        _finishRemap(action, newCode) {
            const currentCode = this.workingSettings.controls[action];

            // Check conflict
            let conflictAction = null;
            for (const [act, c] of Object.entries(this.workingSettings.controls)) {
                if (act !== action && c === newCode) {
                    conflictAction = act;
                    break;
                }
            }

            if (conflictAction) {
                // Auto-swap
                this.workingSettings.controls[conflictAction] = currentCode;
                const conflictLabel = window.SettingsManager.getActionLabel(conflictAction);
                const actionLabel = window.SettingsManager.getActionLabel(action);

                const banner = this.modalEl.querySelector('#remap-status-banner');
                if (banner) {
                    banner.textContent = `Tecla [${window.SettingsManager.getKeyDisplay(newCode)}] em uso por "${conflictLabel}". Teclas trocadas com sucesso!`;
                    banner.classList.add('show');
                }
            } else {
                const banner = this.modalEl.querySelector('#remap-status-banner');
                if (banner) {
                    banner.textContent = `Ação "${window.SettingsManager.getActionLabel(action)}" remapeada para [${window.SettingsManager.getKeyDisplay(newCode)}].`;
                    banner.classList.add('show');
                }
            }

            this.workingSettings.controls[action] = newCode;
            this._cancelRemapping();
            this._renderRemapList();

            if (window.AudioManager) {
                window.AudioManager.playClick(650);
            }
        }

        _cancelRemapping() {
            if (this.remapListener) {
                window.removeEventListener('keydown', this.remapListener, { capture: true });
                this.remapListener = null;
            }
            if (this.remapMouseListener) {
                window.removeEventListener('mousedown', this.remapMouseListener, { capture: true });
                this.remapMouseListener = null;
            }

            if (this.remappingAction && this.modalEl) {
                const btn = this.modalEl.querySelector(`#remap-${this.remappingAction}`);
                if (btn) {
                    btn.classList.remove('listening');
                    const code = this.workingSettings.controls[this.remappingAction];
                    btn.textContent = window.SettingsManager.getKeyDisplay(code);
                }
                this.remappingAction = null;
            }
        }

        // ══════════════════════════════════════════════════════════════
        //  DOM CREATION & BINDING
        // ══════════════════════════════════════════════════════════════

        _renderModalDOM() {
            if (document.getElementById('settings-modal-overlay')) {
                this.modalEl = document.getElementById('settings-modal-overlay');
                return;
            }

            const wrapper = document.createElement('div');
            wrapper.id = 'settings-modal-overlay';
            wrapper.className = 'settings-modal-overlay';
            wrapper.innerHTML = `
                <div class="settings-modal-window" role="dialog" aria-modal="true" aria-labelledby="settings-title">
                    <!-- Header -->
                    <div class="settings-header">
                        <div class="settings-title-group">
                            <span class="settings-title-icon rune-icon">⚙</span>
                            <h2 class="settings-title-text" id="settings-title">CONFIGURAÇÕES DO BASTIÃO</h2>
                        </div>
                        <button type="button" class="settings-close-btn" id="btn-settings-close" title="Fechar (ESC)">✕</button>
                    </div>

                    <!-- 4 Heraldic Navigation Tabs -->
                    <div class="settings-tabs-bar">
                        <button type="button" class="settings-tab-btn active" data-tab="audio">
                            <span class="tab-icon">🔊</span>
                            <span>ÁUDIO</span>
                        </button>
                        <button type="button" class="settings-tab-btn" data-tab="visual">
                            <span class="tab-icon">👁</span>
                            <span>VISUAL</span>
                        </button>
                        <button type="button" class="settings-tab-btn" data-tab="gameplay">
                            <span class="tab-icon">⚔</span>
                            <span>JOGABILIDADE</span>
                        </button>
                        <button type="button" class="settings-tab-btn" data-tab="controls">
                            <span class="tab-icon">🎮</span>
                            <span>CONTROLES</span>
                        </button>
                    </div>

                    <!-- Tab Contents Area -->
                    <div class="settings-content-wrapper">
                        <!-- ABA 1: ÁUDIO -->
                        <div class="settings-pane active" data-pane="audio">
                            <div class="setting-row">
                                <div class="setting-info">
                                    <span class="setting-label">Volume Mestre</span>
                                    <span class="setting-description">Controla a saída sonora geral de todo o jogo.</span>
                                </div>
                                <div class="setting-control">
                                    <div class="settings-slider-wrapper">
                                        <input type="range" min="0" max="1" step="0.05" id="audio-master" class="settings-slider">
                                        <span class="settings-slider-value" id="audio-master-val">80%</span>
                                    </div>
                                </div>
                            </div>

                            <div class="setting-row">
                                <div class="setting-info">
                                    <span class="setting-label">Música & Cânticos</span>
                                    <span class="setting-description">Volume das trilhas ancestrais do menu, vila e masmorra.</span>
                                </div>
                                <div class="setting-control">
                                    <div class="settings-slider-wrapper">
                                        <input type="range" min="0" max="1" step="0.05" id="audio-music" class="settings-slider">
                                        <span class="settings-slider-value" id="audio-music-val">70%</span>
                                    </div>
                                </div>
                            </div>

                            <div class="setting-row">
                                <div class="setting-info">
                                    <span class="setting-label">Efeitos Sonoros (SFX)</span>
                                    <span class="setting-description">Lâminas colidindo, passos na pedra e impactos cinzas.</span>
                                </div>
                                <div class="setting-control">
                                    <div class="settings-slider-wrapper">
                                        <input type="range" min="0" max="1" step="0.05" id="audio-sfx" class="settings-slider">
                                        <span class="settings-slider-value" id="audio-sfx-val">90%</span>
                                    </div>
                                </div>
                            </div>

                            <div class="setting-row">
                                <div class="setting-info">
                                    <span class="setting-label">Sons de Ambiência</span>
                                    <span class="setting-description">Crepitação de fogueiras, vento fúnebre e respiração do abismo.</span>
                                </div>
                                <div class="setting-control">
                                    <div class="settings-slider-wrapper">
                                        <input type="range" min="0" max="1" step="0.05" id="audio-ambience" class="settings-slider">
                                        <span class="settings-slider-value" id="audio-ambience-val">80%</span>
                                    </div>
                                </div>
                            </div>

                            <div class="setting-row">
                                <div class="setting-info">
                                    <span class="setting-label">Mutar em Segundo Plano</span>
                                    <span class="setting-description">Silencia automaticamente se você alternar de aba no navegador.</span>
                                </div>
                                <div class="setting-control">
                                    <button type="button" class="settings-toggle-btn active" id="toggle-mute-blur">
                                        <span class="toggle-rune">ᛏ</span>
                                        <span class="toggle-label">Ligado</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- ABA 2: VISUAL -->
                        <div class="settings-pane" data-pane="visual">
                            <div class="setting-row">
                                <div class="setting-info">
                                    <span class="setting-label">Modo de Tela</span>
                                    <span class="setting-description">Alternar entre exibição em Janela ou Tela Cheia Real.</span>
                                </div>
                                <div class="setting-control">
                                    <button type="button" class="btn-settings-action btn-settings-cancel" id="btn-toggle-fullscreen">
                                        <span class="rune-icon">⛶</span>
                                        <span class="btn-label">Tela Cheia</span>
                                    </button>
                                </div>
                            </div>

                            <div class="setting-row">
                                <div class="setting-info">
                                    <span class="setting-label">Tremor de Tela (Screen Shake)</span>
                                    <span class="setting-description">Intensidade do impacto ao golpear ou sofrer dano (0% desativa).</span>
                                </div>
                                <div class="setting-control">
                                    <div class="settings-slider-wrapper">
                                        <input type="range" min="0" max="1" step="0.05" id="visual-shake" class="settings-slider">
                                        <span class="settings-slider-value" id="visual-shake-val">100%</span>
                                    </div>
                                </div>
                            </div>

                            <div class="setting-row">
                                <div class="setting-info">
                                    <span class="setting-label">Flash de Impacto (Hit Flash)</span>
                                    <span class="setting-description">Piscar branco ao acertar monstros e vinheta vermelha de dano.</span>
                                </div>
                                <div class="setting-control">
                                    <button type="button" class="settings-toggle-btn active" id="toggle-hit-flash">
                                        <span class="toggle-rune">ᛏ</span>
                                        <span class="toggle-label">Ligado</span>
                                    </button>
                                </div>
                            </div>

                            <div class="setting-row">
                                <div class="setting-info">
                                    <span class="setting-label">Densidade de Cinzas & Brasas</span>
                                    <span class="setting-description">Quantidade de partículas atmosféricas ascendentes no Canvas.</span>
                                </div>
                                <div class="setting-control">
                                    <div class="settings-pill-group" id="ember-density-group">
                                        <button type="button" class="settings-pill-btn" data-val="low">Baixa</button>
                                        <button type="button" class="settings-pill-btn" data-val="medium">Média</button>
                                        <button type="button" class="settings-pill-btn active" data-val="high">Alta</button>
                                    </div>
                                </div>
                            </div>

                            <div class="setting-row">
                                <div class="setting-info">
                                    <span class="setting-label">Brilho / Gama Sombria</span>
                                    <span class="setting-description">Calibração de contraste para iluminar cantos escuros da masmorra.</span>
                                </div>
                                <div class="setting-control">
                                    <div class="settings-slider-wrapper">
                                        <input type="range" min="0.8" max="1.4" step="0.05" id="visual-brightness" class="settings-slider">
                                        <span class="settings-slider-value" id="visual-brightness-val">100%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- ABA 3: JOGABILIDADE -->
                        <div class="settings-pane" data-pane="gameplay">
                            <div class="setting-row">
                                <div class="setting-info">
                                    <span class="setting-label">Números de Dano Flutuantes</span>
                                    <span class="setting-description">Exibe valores balísticos de dano e acertos críticos na tela.</span>
                                </div>
                                <div class="setting-control">
                                    <button type="button" class="settings-toggle-btn active" id="toggle-damage-numbers">
                                        <span class="toggle-rune">ᛏ</span>
                                        <span class="toggle-label">Ligado</span>
                                    </button>
                                </div>
                            </div>

                            <div class="setting-row">
                                <div class="setting-info">
                                    <span class="setting-label">Barras de Vida dos Inimigos</span>
                                    <span class="setting-description">Visibilidade das barras suspensas sobre monstros e elites.</span>
                                </div>
                                <div class="setting-control">
                                    <div class="settings-pill-group" id="enemy-hp-group">
                                        <button type="button" class="settings-pill-btn" data-val="always">Sempre</button>
                                        <button type="button" class="settings-pill-btn active" data-val="combat">Combate</button>
                                        <button type="button" class="settings-pill-btn" data-val="hidden">Ocultas</button>
                                    </div>
                                </div>
                            </div>

                            <div class="setting-row">
                                <div class="setting-info">
                                    <span class="setting-label">Direção do Ataque</span>
                                    <span class="setting-description">Mirar com o cursor do mouse (Diablo) ou com a movimentação (Twin-Stick).</span>
                                </div>
                                <div class="setting-control">
                                    <div class="settings-pill-group" id="attack-aim-group">
                                        <button type="button" class="settings-pill-btn active" data-val="mouse">Mouse</button>
                                        <button type="button" class="settings-pill-btn" data-val="movement">Movimento</button>
                                    </div>
                                </div>
                            </div>

                            <div class="setting-row">
                                <div class="setting-info">
                                    <span class="setting-label">Pausar o Jogo em Menus</span>
                                    <span class="setting-description">Pausar o mundo ao redor ao inspecionar o Inventário ou Atributos.</span>
                                </div>
                                <div class="setting-control">
                                    <button type="button" class="settings-toggle-btn" id="toggle-pause-modals">
                                        <span class="toggle-rune">○</span>
                                        <span class="toggle-label">Desligado</span>
                                    </button>
                                </div>
                            </div>

                            <div class="setting-row">
                                <div class="setting-info">
                                    <span class="setting-label">Confirmar Ascensão das Cinzas</span>
                                    <span class="setting-description">Exigir confirmação antes de consumir o herói no fogo sagrado.</span>
                                </div>
                                <div class="setting-control">
                                    <button type="button" class="settings-toggle-btn active" id="toggle-confirm-ascension">
                                        <span class="toggle-rune">ᛏ</span>
                                        <span class="toggle-label">Ligado</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- ABA 4: CONTROLES -->
                        <div class="settings-pane" data-pane="controls">
                            <div class="remap-list" id="remap-slots-container">
                                <!-- Populated dynamically by _renderRemapList() -->
                            </div>
                            <div class="remap-status-banner" id="remap-status-banner"></div>
                        </div>
                    </div>

                    <!-- Action Footer -->
                    <div class="settings-footer">
                        <div class="settings-footer-left">
                            <button type="button" class="btn-settings-action btn-settings-reset" id="btn-settings-reset">
                                <span class="rune-icon">ᛏ</span>
                                <span>Restaurar Padrões</span>
                            </button>
                        </div>
                        <div class="settings-footer-right">
                            <button type="button" class="btn-settings-action btn-settings-cancel" id="btn-settings-cancel">
                                Cancelar
                            </button>
                            <button type="button" class="btn-settings-action btn-settings-apply" id="btn-settings-apply">
                                <span class="rune-icon">🜚</span>
                                <span>Aplicar & Salvar</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(wrapper);
            this.modalEl = wrapper;
        }

        _bindDOMEvents() {
            if (!this.modalEl) return;

            // Close Button [X]
            const btnClose = this.modalEl.querySelector('#btn-settings-close');
            if (btnClose) btnClose.addEventListener('click', () => this.close());

            // Outside Click on Backdrop
            this.modalEl.addEventListener('click', (e) => {
                if (e.target === this.modalEl) {
                    this.close();
                }
            });

            // Tab Switching
            const tabBtns = this.modalEl.querySelectorAll('.settings-tab-btn');
            tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.switchTab(btn.dataset.tab);
                });
            });

            // --- AUDIO CONTROLS LIVE UPDATES ---
            this._bindLiveSlider('audio-master', (val) => {
                this.workingSettings.audio.masterVolume = parseFloat(val);
                if (window.AudioManager) window.AudioManager.updateVolumes(this.workingSettings.audio);
            });
            this._bindLiveSlider('audio-music', (val) => {
                this.workingSettings.audio.musicVolume = parseFloat(val);
                if (window.AudioManager) window.AudioManager.updateVolumes(this.workingSettings.audio);
            });
            this._bindLiveSlider('audio-sfx', (val) => {
                this.workingSettings.audio.sfxVolume = parseFloat(val);
                if (window.AudioManager) {
                    window.AudioManager.updateVolumes(this.workingSettings.audio);
                    window.AudioManager.playClick(800);
                }
            });
            this._bindLiveSlider('audio-ambience', (val) => {
                this.workingSettings.audio.ambienceVolume = parseFloat(val);
                if (window.AudioManager) window.AudioManager.updateVolumes(this.workingSettings.audio);
            });

            this._bindToggleBtn('toggle-mute-blur', (isActive) => {
                this.workingSettings.audio.muteOnBlur = isActive;
            });

            // --- VISUAL CONTROLS ---
            const btnFs = this.modalEl.querySelector('#btn-toggle-fullscreen');
            if (btnFs) {
                btnFs.addEventListener('click', () => {
                    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
                    if (!isFs) {
                        if (document.documentElement.requestFullscreen) {
                            document.documentElement.requestFullscreen().catch(() => {});
                        }
                        this.workingSettings.visual.fullscreen = true;
                    } else {
                        if (document.exitFullscreen) {
                            document.exitFullscreen().catch(() => {});
                        }
                        this.workingSettings.visual.fullscreen = false;
                    }
                    setTimeout(() => this._syncFullscreenBtn(), 100);
                });
            }

            this._bindLiveSlider('visual-shake', (val) => {
                this.workingSettings.visual.screenShakeIntensity = parseFloat(val);
            });

            this._bindToggleBtn('toggle-hit-flash', (isActive) => {
                this.workingSettings.visual.hitFlashEnabled = isActive;
            });

            this._bindPillGroupEvents('ember-density-group', (val) => {
                this.workingSettings.visual.emberDensity = val;
            });

            this._bindLiveSlider('visual-brightness', (val) => {
                this.workingSettings.visual.brightness = parseFloat(val);
                const app = document.getElementById('app');
                if (app) {
                    const b = this.workingSettings.visual.brightness;
                    const c = 1.0 + (b - 1.0) * 0.25;
                    app.style.filter = (b === 1.0) ? 'none' : `brightness(${b}) contrast(${c})`;
                }
            });

            // --- GAMEPLAY CONTROLS ---
            this._bindToggleBtn('toggle-damage-numbers', (isActive) => {
                this.workingSettings.gameplay.showDamageNumbers = isActive;
            });

            this._bindPillGroupEvents('enemy-hp-group', (val) => {
                this.workingSettings.gameplay.enemyHealthBars = val;
            });

            this._bindPillGroupEvents('attack-aim-group', (val) => {
                this.workingSettings.gameplay.attackAim = val;
            });

            this._bindToggleBtn('toggle-pause-modals', (isActive) => {
                this.workingSettings.gameplay.pauseOnModals = isActive;
            });

            this._bindToggleBtn('toggle-confirm-ascension', (isActive) => {
                this.workingSettings.gameplay.confirmAscension = isActive;
            });

            // --- ACTION FOOTER BUTTONS ---
            const btnReset = this.modalEl.querySelector('#btn-settings-reset');
            if (btnReset) btnReset.addEventListener('click', () => this.resetToDefaults());

            const btnCancel = this.modalEl.querySelector('#btn-settings-cancel');
            if (btnCancel) btnCancel.addEventListener('click', () => {
                // Revert live brightness if cancelled
                const currentB = window.SettingsManager.get('visual.brightness', 1.0);
                const app = document.getElementById('app');
                if (app) {
                    const c = 1.0 + (currentB - 1.0) * 0.25;
                    app.style.filter = (currentB === 1.0) ? 'none' : `brightness(${currentB}) contrast(${c})`;
                }
                // Revert live audio volume
                if (window.AudioManager) window.AudioManager.updateVolumes(window.SettingsManager.get('audio'));
                this.close();
            });

            const btnApply = this.modalEl.querySelector('#btn-settings-apply');
            if (btnApply) btnApply.addEventListener('click', () => this.applyAndSave());
        }

        _bindLiveSlider(id, callback) {
            const slider = this.modalEl.querySelector(`#${id}`);
            const label = this.modalEl.querySelector(`#${id}-val`);
            if (!slider) return;

            slider.addEventListener('input', (e) => {
                const val = e.target.value;
                if (label) label.textContent = `${Math.round(val * 100)}%`;
                callback(val);
            });
        }

        _bindToggleBtn(id, callback) {
            const btn = this.modalEl.querySelector(`#${id}`);
            if (!btn) return;

            btn.addEventListener('click', () => {
                const isCurrentlyActive = btn.classList.contains('active');
                const nextState = !isCurrentlyActive;
                this._syncToggle(id, nextState);
                callback(nextState);

                if (window.AudioManager) window.AudioManager.playClick(600);
            });
        }

        _bindPillGroupEvents(groupId, callback) {
            const group = this.modalEl.querySelector(`#${groupId}`);
            if (!group) return;

            const btns = group.querySelectorAll('.settings-pill-btn');
            btns.forEach(btn => {
                btn.addEventListener('click', () => {
                    btns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    callback(btn.dataset.val);

                    if (window.AudioManager) window.AudioManager.playClick(650);
                });
            });
        }

        // ══════════════════════════════════════════════════════════════
        //  GLOBAL ESCAPE SHORTCUT & UI INTEGRATION
        // ══════════════════════════════════════════════════════════════

        _bindGlobalShortcuts() {
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    if (this.remappingAction) {
                        e.preventDefault();
                        this._cancelRemapping();
                        return;
                    }

                    // Check if other standard modals are open first (Inventory, Stats, Skills, etc.)
                    const legacyModal = document.getElementById('modal-overlay');
                    if (legacyModal && !legacyModal.classList.contains('hidden') && legacyModal.style.display !== 'none') {
                        // Let legacy modal close or close it
                        return;
                    }

                    // Toggle Settings Modal with ESC
                    e.preventDefault();
                    if (this.isOpen) {
                        this.close();
                    } else {
                        this.open('audio');
                    }
                }
            });

            // Bind Title Screen Settings Button
            const titleSettingsBtn = document.getElementById('btn-title-settings');
            if (titleSettingsBtn) {
                titleSettingsBtn.addEventListener('click', () => {
                    this.open('audio');
                });
            }

            // Bind HUD Settings Button (if present)
            const hudSettingsBtn = document.getElementById('btn-settings');
            if (hudSettingsBtn) {
                hudSettingsBtn.addEventListener('click', () => {
                    this.open('audio');
                });
            }
        }
    }

    window.SettingsUI = new SettingsUIClass();

})(window);
