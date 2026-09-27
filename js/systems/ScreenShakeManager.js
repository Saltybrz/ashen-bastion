/**
 * ============================================================================
 * ScreenShakeManager.js
 * Centralized Screen Shake Architecture for In Search of Hope: The Ashen Bastion
 * Provides global kinetic impact shakes with smooth damping, settings multiplier,
 * safety watchdog to prevent permanent vibration, and semantic presets.
 * ============================================================================
 */

(function (window) {
    'use strict';

    class ScreenShakeManagerClass {
        constructor() {
            this.timer = 0;
            this.maxDuration = 0.120;
            this.intensity = 0;
            this.offsetX = 0;
            this.offsetY = 0;
            this.maxSafetyDuration = 1.0; // Watchdog: never shake longer than 1.0s continuously
        }

        /**
         * Trigger a custom screen shake.
         * @param {number} intensity - Amplitude in pixels (e.g., 3-15)
         * @param {number} duration - Time in seconds (e.g., 0.08 - 0.5)
         */
        shake(intensity = 5.0, duration = 0.120) {
            // Respect settings
            const settingsMult = (window.SettingsManager ? window.SettingsManager.get('visual.screenShakeIntensity', 1.0) : 1.0);
            if (settingsMult <= 0.01) {
                this.stop();
                return;
            }

            // Cap duration for safety (never permanent)
            const safeDuration = Math.min(Math.max(0.02, duration), this.maxSafetyDuration);

            // If a higher intensity shake is already running, take the max intensity
            this.intensity = Math.max(this.intensity * 0.5, intensity);
            this.timer = safeDuration;
            this.maxDuration = safeDuration;

            // Sync with active DungeonEngine if running
            if (window.dungeonEngine && typeof window.dungeonEngine.triggerScreenShake === 'function') {
                window.dungeonEngine.triggerScreenShake(this.intensity, safeDuration);
            }
        }

        /**
         * Semantic preset: Normal melee attack impact.
         */
        normal() {
            this.shake(3.5, 0.090);
        }

        /**
         * Semantic preset: Critical strike impact.
         */
        crit() {
            this.shake(7.0, 0.150);
        }

        /**
         * Semantic preset: Heavy attack or execution strike.
         */
        heavy() {
            this.shake(9.0, 0.220);
        }

        /**
         * Semantic preset: Boss entrance, phase change, funeral toll, or ground slam.
         */
        boss() {
            this.shake(14.0, 0.450);
        }

        /**
         * Semantic preset: Player receiving damage.
         */
        playerHurt() {
            this.shake(5.5, 0.130);
        }

        /**
         * Stop shake immediately.
         */
        stop() {
            this.timer = 0;
            this.intensity = 0;
            this.offsetX = 0;
            this.offsetY = 0;
            if (window.dungeonEngine) {
                window.dungeonEngine.screenShakeTimer = 0;
                window.dungeonEngine.screenShakeIntensity = 0;
            }
        }

        /**
         * Frame update for standalone renderers.
         * @param {number} dt - delta time in seconds
         */
        update(dt) {
            if (this.timer > 0) {
                this.timer -= dt;
                if (this.timer <= 0) {
                    this.stop();
                    return;
                }
                const settingsMult = (window.SettingsManager ? window.SettingsManager.get('visual.screenShakeIntensity', 1.0) : 1.0);
                const damp = Math.max(0, this.timer / (this.maxDuration || 0.12));
                const currentAmp = this.intensity * settingsMult * damp;
                this.offsetX = (Math.random() - 0.5) * currentAmp * 2;
                this.offsetY = (Math.random() - 0.5) * currentAmp * 2;
            } else {
                this.offsetX = 0;
                this.offsetY = 0;
            }
        }

        /**
         * Get current frame offsets for canvas translation.
         * @returns {{x: number, y: number}}
         */
        getOffset() {
            return { x: this.offsetX, y: this.offsetY };
        }
    }

    window.ScreenShakeManager = new ScreenShakeManagerClass();
    console.log('[ScreenShakeManager] Initialized central screen shake controller.');

})(window);
