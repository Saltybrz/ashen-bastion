/**
 * ============================================================================
 * SettingsManager.js
 * Centralized Settings and Persistence Manager for In Search of Hope: The Ashen Bastion
 * Centralizes User Settings, LocalStorage persistence, and live engine propagation.
 * ============================================================================
 */

(function (window) {
    'use strict';

    const STORAGE_KEY = 'ashen_bastion_settings';

    const DEFAULT_SETTINGS = {
        audio: {
            masterVolume: 0.8,
            musicVolume: 0.7,
            sfxVolume: 0.9,
            ambienceVolume: 0.8,
            muteOnBlur: true
        },
        visual: {
            screenShakeIntensity: 1.0, // 0.0 to 1.0
            hitFlashEnabled: true,
            emberDensity: 'high',     // 'low', 'medium', 'high'
            brightness: 1.0,          // 0.8 to 1.4 (80% to 140%)
            fullscreen: false
        },
        gameplay: {
            showDamageNumbers: true,
            enemyHealthBars: 'combat', // 'always', 'combat', 'hidden'
            attackAim: 'mouse',        // 'mouse', 'movement'
            pauseOnModals: false,
            confirmAscension: true
        },
        controls: {
            moveUp: 'KeyW',
            moveDown: 'KeyS',
            moveLeft: 'KeyA',
            moveRight: 'KeyD',
            attack: 'Mouse0',
            heavyAttack: 'Mouse2',
            dodge: 'ShiftLeft',
            skill1: 'KeyQ',
            skill2: 'Digit3',
            skill3: 'KeyR',
            skill4: 'KeyF',
            potion1: 'Digit1',
            potion2: 'Digit2',
            interact: 'KeyE',
            inventory: 'KeyI',
            characterSheet: 'KeyC',
            skillsMenu: 'KeyK'
        }
    };

    const ACTION_LABELS = {
        moveUp: 'Mover para Cima',
        moveDown: 'Mover para Baixo',
        moveLeft: 'Mover para Esquerda',
        moveRight: 'Mover para Direita',
        attack: 'Ataque Primário',
        heavyAttack: 'Ataque Pesado / Especial',
        dodge: 'Esquiva Tática (Dash)',
        skill1: 'Habilidade Grimório 1',
        skill2: 'Habilidade Grimório 2',
        skill3: 'Habilidade Grimório 3',
        skill4: 'Habilidade Grimório 4',
        potion1: 'Tônico Alquímico 1',
        potion2: 'Tônico Alquímico 2',
        interact: 'Interagir / Extração',
        inventory: 'Abrir Inventário',
        characterSheet: 'Ficha de Atributos',
        skillsMenu: 'Grimório de Habilidades'
    };

    class SettingsManagerClass {
        constructor() {
            this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            this._listeners = [];
            this.isInitialized = false;
        }

        /**
         * Initialize settings by loading from localStorage.
         */
        init() {
            if (this.isInitialized) return;
            this.load();
            this.apply();
            this.isInitialized = true;
            console.log('[SettingsManager] Initialized with unified settings.');
        }

        /**
         * Load settings from localStorage and deeply merge with defaults.
         */
        load() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    this.settings = this._deepMerge(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), parsed);
                } else {
                    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
                }
            } catch (err) {
                console.warn('[SettingsManager] Failed to load settings from localStorage, using defaults.', err);
                this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            }
            return this.settings;
        }

        /**
         * Save current settings to localStorage and apply them.
         */
        save(newSettings = null) {
            if (newSettings) {
                this.settings = this._deepMerge(this.settings, newSettings);
            }
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
            } catch (err) {
                console.error('[SettingsManager] Could not save to localStorage.', err);
            }
            this.apply();
            this._emitChange();
            return this.settings;
        }

        /**
         * Restore all default settings.
         */
        resetDefaults() {
            this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            this.save();
            return this.settings;
        }

        /**
         * Apply settings across running subsystems (Audio, Engine, Canvas, Fullscreen).
         */
        apply() {
            // 1. Audio Manager
            if (window.AudioManager && typeof window.AudioManager.updateVolumes === 'function') {
                window.AudioManager.updateVolumes(this.settings.audio);
            }

            // 2. Fullscreen State Sync
            if (typeof document !== 'undefined') {
                const isCurrentlyFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
                if (this.settings.visual.fullscreen && !isCurrentlyFullscreen) {
                    if (document.documentElement.requestFullscreen) {
                        document.documentElement.requestFullscreen().catch(() => {});
                    }
                } else if (!this.settings.visual.fullscreen && isCurrentlyFullscreen) {
                    if (document.exitFullscreen) {
                        document.exitFullscreen().catch(() => {});
                    }
                }
            }

            // 3. Brightness / Dark Gamma Filter
            if (typeof document !== 'undefined') {
                const appRoot = document.getElementById('app') || document.body;
                if (appRoot) {
                    const b = this.settings.visual.brightness || 1.0;
                    // Apply subtle contrast boost when brightening dark corners
                    const contrast = 1.0 + (b - 1.0) * 0.25;
                    appRoot.style.filter = (b === 1.0) ? 'none' : `brightness(${b}) contrast(${contrast})`;
                }
            }

            // 4. Ember Density in TitleScreenFX
            if (window.TitleScreenFX && typeof window.TitleScreenFX.setDensity === 'function') {
                window.TitleScreenFX.setDensity(this.settings.visual.emberDensity);
            }

            // 5. DungeonEngine dynamic adjustment
            if (window.dungeonEngine) {
                if (typeof window.dungeonEngine.syncSettings === 'function') {
                    window.dungeonEngine.syncSettings(this.settings);
                }
            }

            this._emitChange();
        }

        /**
         * Get a setting by dot-separated path (e.g. 'audio.masterVolume').
         */
        get(path, fallback = undefined) {
            const keys = path.split('.');
            let curr = this.settings;
            for (let i = 0; i < keys.length; i++) {
                if (curr === undefined || curr === null) return fallback;
                curr = curr[keys[i]];
            }
            return curr !== undefined ? curr : fallback;
        }

        /**
         * Set a setting by dot-separated path.
         */
        set(path, value) {
            const keys = path.split('.');
            let curr = this.settings;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!curr[keys[i]] || typeof curr[keys[i]] !== 'object') {
                    curr[keys[i]] = {};
                }
                curr = curr[keys[i]];
            }
            curr[keys[keys.length - 1]] = value;
        }

        /**
         * Check if an in-game action is currently triggered given key/mouse states.
         * @param {string} action - action key name in controls
         * @param {Object} keys - map of pressed keys { [key/code]: boolean }
         * @param {Object} mouse - optional { buttons: number, left: boolean, right: boolean }
         */
        isActionActive(action, keys = {}, mouse = null) {
            const boundKey = this.get(`controls.${action}`);
            if (!boundKey) return false;

            // Mouse button checks
            if (boundKey.startsWith('Mouse')) {
                if (!mouse) return false;
                const btnNum = parseInt(boundKey.replace('Mouse', ''), 10);
                if (btnNum === 0) return !!(mouse.left || mouse.mouseDown || mouse.button === 0);
                if (btnNum === 2) return !!(mouse.right || mouse.rightMouseDown || mouse.button === 2);
                if (btnNum === 1) return !!(mouse.middle || mouse.button === 1);
                return false;
            }

            // Keyboard checks: supports e.code ('KeyW'), lower-case characters ('w'), and special codes
            if (keys[boundKey]) return true;
            if (keys[boundKey.toLowerCase()]) return true;

            const friendlyChar = this._codeToChar(boundKey);
            if (friendlyChar && keys[friendlyChar]) return true;

            // Fallbacks for Movement (Arrow Keys)
            if (action === 'moveUp' && (keys['arrowup'] || keys['ArrowUp'])) return true;
            if (action === 'moveDown' && (keys['arrowdown'] || keys['ArrowDown'])) return true;
            if (action === 'moveLeft' && (keys['arrowleft'] || keys['ArrowLeft'])) return true;
            if (action === 'moveRight' && (keys['arrowright'] || keys['ArrowRight'])) return true;

            // Fallback for Dash (Shift / Space)
            if (action === 'dodge' && (keys['shift'] || keys['ShiftLeft'] || keys['ShiftRight'] || keys[' '])) return true;

            // Fallback for Interact (E / Space)
            if (action === 'interact' && (keys['e'] || keys['KeyE'])) return true;

            return false;
        }

        /**
         * Resolve conflict when remapping: if another action uses this code, swap or update.
         */
        remapKey(targetAction, newCode) {
            let conflictAction = null;
            const currentCode = this.get(`controls.${targetAction}`);

            // Find if any other action uses newCode
            for (const [action, code] of Object.entries(this.settings.controls)) {
                if (action !== targetAction && code === newCode) {
                    conflictAction = action;
                    break;
                }
            }

            if (conflictAction) {
                // Auto-swap keys between conflicting actions
                this.set(`controls.${conflictAction}`, currentCode);
            }
            this.set(`controls.${targetAction}`, newCode);

            return {
                swapped: !!conflictAction,
                conflictAction: conflictAction,
                conflictLabel: conflictAction ? ACTION_LABELS[conflictAction] : null,
                previousCode: currentCode
            };
        }

        /**
         * Human-readable label for action.
         */
        getActionLabel(action) {
            return ACTION_LABELS[action] || action;
        }

        /**
         * Human-readable display text for a key code.
         */
        getKeyDisplay(code) {
            if (!code) return 'Nenhuma';
            if (code === 'Mouse0') return 'Mouse 1 (Esq)';
            if (code === 'Mouse1') return 'Mouse 3 (Meio)';
            if (code === 'Mouse2') return 'Mouse 2 (Dir)';
            if (code === 'Space') return 'Espaço';
            if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
            if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
            if (code === 'AltLeft' || code === 'AltRight') return 'Alt';
            if (code.startsWith('Key')) return code.replace('Key', '');
            if (code.startsWith('Digit')) return code.replace('Digit', '');
            if (code.startsWith('Numpad')) return 'Num ' + code.replace('Numpad', '');
            if (code === 'ArrowUp') return '↑ Cima';
            if (code === 'ArrowDown') return '↓ Baixo';
            if (code === 'ArrowLeft') return '← Esquerda';
            if (code === 'ArrowRight') return '→ Direita';
            return code;
        }

        _codeToChar(code) {
            if (code.startsWith('Key')) return code.replace('Key', '').toLowerCase();
            if (code.startsWith('Digit')) return code.replace('Digit', '');
            if (code === 'Space') return ' ';
            return null;
        }

        _deepMerge(target, source) {
            if (!source || typeof source !== 'object') return target;
            const output = Object.assign({}, target);
            for (const key of Object.keys(source)) {
                if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this._deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            }
            return output;
        }

        onChange(callback) {
            if (typeof callback === 'function') {
                this._listeners.push(callback);
            }
        }

        _emitChange() {
            for (let i = 0; i < this._listeners.length; i++) {
                try {
                    this._listeners[i](this.settings);
                } catch (e) {
                    console.error('[SettingsManager] Listener error:', e);
                }
            }
        }
    }

    window.SettingsManager = new SettingsManagerClass();
    window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;

})(window);
