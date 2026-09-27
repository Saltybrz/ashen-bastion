/**
 * ============================================================================
 * AudioManager.js
 * Comprehensive Audio & Music Engine for In Search of Hope: The Ashen Bastion
 * Implements real-time multi-channel audio synthesis (Master, Music, SFX, Ambience)
 * with dedicated dual-track background music (General Theme & Dungeon Theme),
 * smooth crossfading, Web Audio routing with resilient HTML5 Audio fallback,
 * and immediate reactivity to SettingsManager sliders and muteOnBlur.
 * ============================================================================
 */

(function (window) {
    'use strict';

    class AudioManagerClass {
        constructor() {
            this.ctx = null;
            this.masterGain = null;
            this.musicGain = null;
            this.sfxGain = null;
            this.ambienceGain = null;
            this.isMutedByBlur = false;
            this.ambienceRunning = false;
            this.ambienceNodes = [];
            this.initialized = false;

            // ─── Dual-Track Music System ───
            // Dungeon: Chrome_Capture_2026-09-27_17-44-27.mp3 (assets/audio/dungeon_theme.mp3)
            // General: Chrome_Capture_2026-09-27_17-48-18.mp3 (assets/audio/general_theme.mp3)
            this.tracks = {
                dungeon: [
                    'assets/audio/dungeon_theme.mp3',
                    'Chrome_Capture_2026-09-27_17-44-27.mp3'
                ],
                general: [
                    'assets/audio/general_theme.mp3',
                    'Chrome_Capture_2026-09-27_17-48-18.mp3'
                ]
            };

            this.audioPlayers = {};   // { dungeon: HTMLAudioElement, general: HTMLAudioElement }
            this.mediaSources = {};   // { dungeon: MediaElementAudioSourceNode, ... }
            this.trackGains = {};     // { dungeon: GainNode, general: GainNode }
            this.currentTrack = null; // 'general' | 'dungeon' | null
            this.pendingTrack = null; // queued if browser autoplay is blocked
            this.fadeIntervals = {};

            this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
            this._handleWindowBlur = this._handleWindowBlur.bind(this);
            this._handleWindowFocus = this._handleWindowFocus.bind(this);

            // Pre-initialize player instances lazily
            this._initTrackPlayers();
        }

        /**
         * Initialize player elements and event listeners.
         */
        _initTrackPlayers() {
            for (const trackKey of Object.keys(this.tracks)) {
                this._createAudioPlayer(trackKey);
            }
        }

        /**
         * Create and configure an HTMLAudioElement for a specific track.
         */
        _createAudioPlayer(trackKey) {
            if (this.audioPlayers[trackKey]) return this.audioPlayers[trackKey];

            const sources = this.tracks[trackKey];
            if (!sources || sources.length === 0) return null;

            const audio = new Audio();
            audio.loop = true;
            audio.preload = 'auto';
            audio.volume = 0; // starts silent, raised by playMusic / updateVolumes

            let currentSrcIndex = 0;
            audio.src = sources[currentSrcIndex];

            // Robust fallback if primary path is not found
            audio.addEventListener('error', () => {
                currentSrcIndex++;
                if (currentSrcIndex < sources.length) {
                    console.warn(`[AudioManager] Track "${trackKey}" primary failed. Falling back to: ${sources[currentSrcIndex]}`);
                    audio.src = sources[currentSrcIndex];
                    if (this.currentTrack === trackKey) {
                        audio.play().catch(() => {});
                    }
                }
            });

            this.audioPlayers[trackKey] = audio;
            return audio;
        }

        /**
         * Initialize AudioContext upon first user interaction (browser autoplay policy compliance).
         */
        ensureContext() {
            if (this.ctx && this.ctx.state !== 'closed') {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                }
                this._checkPendingTrack();
                return this.ctx;
            }

            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) {
                    console.warn('[AudioManager] Web Audio API is not supported in this browser.');
                    this._checkPendingTrack();
                    return null;
                }

                this.ctx = new AudioCtx();

                // Master channel
                this.masterGain = this.ctx.createGain();
                this.masterGain.connect(this.ctx.destination);

                // Music channel
                this.musicGain = this.ctx.createGain();
                this.musicGain.connect(this.masterGain);

                // SFX channel
                this.sfxGain = this.ctx.createGain();
                this.sfxGain.connect(this.masterGain);

                // Ambience channel
                this.ambienceGain = this.ctx.createGain();
                this.ambienceGain.connect(this.masterGain);

                // Setup individual track gains and media element sources
                this._wireTrackNodes();

                // Pull initial volumes from SettingsManager if available
                if (window.SettingsManager) {
                    this.updateVolumes(window.SettingsManager.get('audio'));
                } else {
                    this.updateVolumes({ masterVolume: 0.8, musicVolume: 0.7, sfxVolume: 0.9, ambienceVolume: 0.8, muteOnBlur: true });
                }

                // Setup blur/focus listeners for muteOnBlur
                window.addEventListener('blur', this._handleWindowBlur);
                window.addEventListener('focus', this._handleWindowFocus);
                document.addEventListener('visibilitychange', this._handleVisibilityChange);

                // Start ambient background soundscape
                this._startAmbience();

                this.initialized = true;
                console.log('[AudioManager] AudioContext, channels, and music nodes initialized.');
            } catch (err) {
                console.warn('[AudioManager] Failed to initialize AudioContext:', err);
            }

            this._checkPendingTrack();
            return this.ctx;
        }

        /**
         * Connect HTMLAudio elements into the Web Audio graph via MediaElementAudioSourceNode.
         */
        _wireTrackNodes() {
            if (!this.ctx || !this.musicGain) return;

            for (const trackKey of Object.keys(this.tracks)) {
                const audio = this.audioPlayers[trackKey] || this._createAudioPlayer(trackKey);
                if (!audio) continue;

                // Create dedicated GainNode for each track to enable silky smooth crossfading
                if (!this.trackGains[trackKey]) {
                    const trackGain = this.ctx.createGain();
                    // Initial gain is 0 unless it's already the current active track
                    trackGain.gain.setValueAtTime(this.currentTrack === trackKey ? 1.0 : 0.0, this.ctx.currentTime);
                    trackGain.connect(this.musicGain);
                    this.trackGains[trackKey] = trackGain;
                }

                // Connect audio element into trackGain
                if (!this.mediaSources[trackKey]) {
                    try {
                        const source = this.ctx.createMediaElementSource(audio);
                        source.connect(this.trackGains[trackKey]);
                        this.mediaSources[trackKey] = source;
                    } catch (e) {
                        // Some environments with file:// may restrict MediaElementSource; fallback cleanly
                        console.log(`[AudioManager] Note: Direct audio volume control used for ${trackKey}.`);
                    }
                }
            }
        }

        /**
         * If a track playback was requested before user interaction unlocked AudioContext,
         * play it as soon as the context is active.
         */
        _checkPendingTrack() {
            if (this.pendingTrack) {
                const trackToPlay = this.pendingTrack;
                this.pendingTrack = null;
                this.playMusic(trackToPlay, 0.8);
            } else if (this.currentTrack) {
                const audio = this.audioPlayers[this.currentTrack];
                if (audio && audio.paused) {
                    audio.play().catch(() => {});
                }
            }
        }

        // ══════════════════════════════════════════════════════════════
        //  BACKGROUND MUSIC MANAGEMENT (CROSSFADE & DUAL-TRACK)
        // ══════════════════════════════════════════════════════════════

        /**
         * Play background music with automatic crossfading.
         * @param {'general'|'dungeon'} trackKey
         * @param {number} [fadeDuration=1.2]
         */
        playMusic(trackKey, fadeDuration = 1.2) {
            if (!this.tracks[trackKey]) {
                console.warn(`[AudioManager] Unknown track "${trackKey}". Available: "general", "dungeon".`);
                return;
            }

            // Already playing this track
            if (this.currentTrack === trackKey) {
                const currentAudio = this.audioPlayers[trackKey];
                if (currentAudio && currentAudio.paused) {
                    currentAudio.play().catch(() => {
                        this.pendingTrack = trackKey;
                    });
                }
                return;
            }

            const prevTrack = this.currentTrack;
            this.currentTrack = trackKey;

            // Make sure player exists
            const nextAudio = this.audioPlayers[trackKey] || this._createAudioPlayer(trackKey);
            if (!nextAudio) return;

            // Wire Web Audio nodes if context was recently started
            if (this.ctx && (!this.trackGains[trackKey] || !this.mediaSources[trackKey])) {
                this._wireTrackNodes();
            }

            const targetVolume = this._getTargetVolume();
            const now = this.ctx ? this.ctx.currentTime : 0;

            // 1. Crossfade OUT previous track
            if (prevTrack && this.audioPlayers[prevTrack]) {
                const prevAudio = this.audioPlayers[prevTrack];
                const prevGain = this.trackGains[prevTrack];

                if (prevGain && this.ctx) {
                    // Web Audio crossfade out
                    prevGain.gain.cancelScheduledValues(now);
                    prevGain.gain.setValueAtTime(prevGain.gain.value, now);
                    prevGain.gain.linearRampToValueAtTime(0.0001, now + fadeDuration);
                    setTimeout(() => {
                        if (this.currentTrack !== prevTrack) {
                            prevAudio.pause();
                        }
                    }, fadeDuration * 1000 + 50);
                } else {
                    // HTML5 Audio volume fade out
                    this._fadeAudioElementVolume(prevAudio, 0, fadeDuration, () => {
                        if (this.currentTrack !== prevTrack) {
                            prevAudio.pause();
                        }
                    });
                }
            }

            // 2. Crossfade IN next track
            const nextGain = this.trackGains[trackKey];
            if (nextGain && this.ctx) {
                // With Web Audio node attached, audio.volume can be 1.0 (gain node controls it)
                nextAudio.volume = 1.0;
                nextGain.gain.cancelScheduledValues(now);
                nextGain.gain.setValueAtTime(0.0001, now);
                nextGain.gain.linearRampToValueAtTime(1.0, now + fadeDuration);
            } else {
                // Direct volume control fallback
                nextAudio.volume = 0;
                this._fadeAudioElementVolume(nextAudio, targetVolume, fadeDuration);
            }

            // Start playback with catch for browser autoplay protection
            const playPromise = nextAudio.play();
            if (playPromise !== undefined) {
                playPromise.catch((err) => {
                    console.log(`[AudioManager] Autoplay blocked for "${trackKey}". Will play on first player interaction.`);
                    this.pendingTrack = trackKey;
                });
            }
        }

        /**
         * Stop all background music with smooth fade out.
         * @param {number} [fadeDuration=0.8]
         */
        stopMusic(fadeDuration = 0.8) {
            const track = this.currentTrack;
            if (!track || !this.audioPlayers[track]) return;

            const audio = this.audioPlayers[track];
            const gain = this.trackGains[track];
            const now = this.ctx ? this.ctx.currentTime : 0;

            if (gain && this.ctx) {
                gain.gain.cancelScheduledValues(now);
                gain.gain.setValueAtTime(gain.gain.value, now);
                gain.gain.linearRampToValueAtTime(0.0001, now + fadeDuration);
                setTimeout(() => {
                    audio.pause();
                    this.currentTrack = null;
                }, fadeDuration * 1000 + 50);
            } else {
                this._fadeAudioElementVolume(audio, 0, fadeDuration, () => {
                    audio.pause();
                    this.currentTrack = null;
                });
            }
        }

        /**
         * Pause current music without resetting position.
         */
        pauseMusic() {
            if (this.currentTrack && this.audioPlayers[this.currentTrack]) {
                this.audioPlayers[this.currentTrack].pause();
            }
        }

        /**
         * Resume current music.
         */
        resumeMusic() {
            if (this.currentTrack && this.audioPlayers[this.currentTrack]) {
                this.audioPlayers[this.currentTrack].play().catch(() => {});
            }
        }

        /**
         * Get the name of the currently active music track.
         * @returns {'general'|'dungeon'|null}
         */
        getCurrentTrack() {
            return this.currentTrack;
        }

        /**
         * Helper to calculate target direct volume (master * music).
         */
        _getTargetVolume() {
            const master = window.SettingsManager ? window.SettingsManager.get('audio.masterVolume', 0.8) : 0.8;
            const music = window.SettingsManager ? window.SettingsManager.get('audio.musicVolume', 0.7) : 0.7;
            return Math.max(0, Math.min(1, master * music));
        }

        /**
         * Smoothly step audio element volume for fallback mode.
         */
        _fadeAudioElementVolume(audio, targetVol, durationSec, onComplete) {
            if (!audio) return;
            const startVol = audio.volume;
            const steps = 25;
            const stepInterval = (durationSec * 1000) / steps;
            let currentStep = 0;

            if (this.fadeIntervals[audio.src]) {
                clearInterval(this.fadeIntervals[audio.src]);
            }

            this.fadeIntervals[audio.src] = setInterval(() => {
                currentStep++;
                const progress = currentStep / steps;
                audio.volume = Math.max(0, Math.min(1, startVol + (targetVol - startVol) * progress));

                if (currentStep >= steps) {
                    clearInterval(this.fadeIntervals[audio.src]);
                    delete this.fadeIntervals[audio.src];
                    audio.volume = targetVol;
                    if (typeof onComplete === 'function') onComplete();
                }
            }, stepInterval);
        }

        /**
         * Update channel gains based on SettingsManager audio settings.
         */
        updateVolumes(audioSettings) {
            if (!audioSettings) return;
            const now = this.ctx ? this.ctx.currentTime : 0;
            const rampTime = 0.05;

            const master = audioSettings.masterVolume !== undefined ? audioSettings.masterVolume : 0.8;
            const music = audioSettings.musicVolume !== undefined ? audioSettings.musicVolume : 0.7;
            const sfx = audioSettings.sfxVolume !== undefined ? audioSettings.sfxVolume : 0.9;
            const ambience = audioSettings.ambienceVolume !== undefined ? audioSettings.ambienceVolume : 0.8;

            if (this.masterGain && this.ctx && !this.isMutedByBlur) {
                this.masterGain.gain.cancelScheduledValues(now);
                this.masterGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, master)), now + rampTime);
            }
            if (this.musicGain && this.ctx) {
                this.musicGain.gain.cancelScheduledValues(now);
                this.musicGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, music)), now + rampTime);
            }
            if (this.sfxGain && this.ctx) {
                this.sfxGain.gain.cancelScheduledValues(now);
                this.sfxGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, sfx)), now + rampTime);
            }
            if (this.ambienceGain && this.ctx) {
                this.ambienceGain.gain.cancelScheduledValues(now);
                this.ambienceGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, ambience * 0.4)), now + rampTime);
            }

            // Sync HTMLAudio elements for direct fallback
            const targetVolume = Math.max(0, Math.min(1, master * music));
            for (const trackKey of Object.keys(this.audioPlayers)) {
                const audio = this.audioPlayers[trackKey];
                if (audio) {
                    if (this.mediaSources[trackKey]) {
                        // Web Audio handles gain via musicGain & trackGain
                        audio.volume = 1.0;
                    } else if (this.currentTrack === trackKey && !this.isMutedByBlur) {
                        audio.volume = targetVolume;
                    }
                }
            }
        }

        _handleWindowBlur() {
            if (window.SettingsManager && window.SettingsManager.get('audio.muteOnBlur') === false) return;
            this._mute();
        }

        _handleWindowFocus() {
            this._unmute();
        }

        _handleVisibilityChange() {
            if (document.hidden) {
                if (window.SettingsManager && window.SettingsManager.get('audio.muteOnBlur') === false) return;
                this._mute();
            } else {
                this._unmute();
            }
        }

        _mute() {
            if (this.isMutedByBlur) return;
            this.isMutedByBlur = true;

            if (this.ctx && this.masterGain) {
                const now = this.ctx.currentTime;
                this.masterGain.gain.cancelScheduledValues(now);
                this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.08);
            }

            // Also mute any standalone HTML5 audio elements
            for (const key of Object.keys(this.audioPlayers)) {
                const audio = this.audioPlayers[key];
                if (audio && !this.mediaSources[key]) {
                    audio.dataset.unmuteVolume = audio.volume;
                    audio.volume = 0;
                }
            }
        }

        _unmute() {
            if (!this.isMutedByBlur) return;
            this.isMutedByBlur = false;

            const master = window.SettingsManager ? window.SettingsManager.get('audio.masterVolume', 0.8) : 0.8;
            if (this.ctx && this.masterGain) {
                const now = this.ctx.currentTime;
                this.masterGain.gain.cancelScheduledValues(now);
                this.masterGain.gain.linearRampToValueAtTime(master, now + 0.08);
            }

            // Restore standalone HTML5 audio elements
            const music = window.SettingsManager ? window.SettingsManager.get('audio.musicVolume', 0.7) : 0.7;
            for (const key of Object.keys(this.audioPlayers)) {
                const audio = this.audioPlayers[key];
                if (audio && !this.mediaSources[key] && this.currentTrack === key) {
                    audio.volume = Math.max(0, Math.min(1, master * music));
                }
            }
        }

        // ══════════════════════════════════════════════════════════════
        //  PROCEDURAL AMBIENT SOUNDSCAPE (Wind, Crypt Hum, Embers)
        // ══════════════════════════════════════════════════════════════
        _startAmbience() {
            if (this.ambienceRunning || !this.ctx || !this.ambienceGain) return;
            this.ambienceRunning = true;

            try {
                // Low cavern drone
                const osc1 = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const droneGain = this.ctx.createGain();

                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A1
                osc2.type = 'triangle';
                osc2.frequency.setValueAtTime(82.4, this.ctx.currentTime); // E2 fifth

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(140, this.ctx.currentTime);

                droneGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

                osc1.connect(filter);
                osc2.connect(filter);
                filter.connect(droneGain);
                droneGain.connect(this.ambienceGain);

                osc1.start();
                osc2.start();

                this.ambienceNodes.push(osc1, osc2, filter, droneGain);

                // Start gentle randomized ember crackles
                this._scheduleEmberCrackle();
            } catch (err) {
                console.warn('[AudioManager] Ambience start failed:', err);
            }
        }

        _scheduleEmberCrackle() {
            if (!this.ambienceRunning || !this.ctx) return;
            const delay = 1200 + Math.random() * 2800;
            setTimeout(() => {
                if (this.ambienceRunning) {
                    this._playEmberCrackle();
                    this._scheduleEmberCrackle();
                }
            }, delay);
        }

        _playEmberCrackle() {
            if (!this.ctx || !this.ambienceGain || this.isMutedByBlur) return;
            try {
                const now = this.ctx.currentTime;
                const bufferSize = this.ctx.sampleRate * 0.04;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
                }

                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.setValueAtTime(1800 + Math.random() * 1200, now);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.08 + Math.random() * 0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.ambienceGain);

                noise.start(now);
            } catch (e) {}
        }

        // ══════════════════════════════════════════════════════════════
        //  SYNTHESIZED SOUND EFFECTS (SFX)
        // ══════════════════════════════════════════════════════════════

        /**
         * UI Brass Button Click / Select sound.
         */
        playClick(freq = 750) {
            this.ensureContext();
            if (!this.ctx || !this.sfxGain) return;
            try {
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now);
                osc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + 0.045);

                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

                osc.connect(gain);
                gain.connect(this.sfxGain);

                osc.start(now);
                osc.stop(now + 0.05);
            } catch (e) {}
        }

        /**
         * Metallic Blade Clash / Combat Impact.
         */
        playClash(isCrit = false) {
            this.ensureContext();
            if (!this.ctx || !this.sfxGain) return;
            try {
                const now = this.ctx.currentTime;

                // 1. High Metallic Tonal Ring
                const osc = this.ctx.createOscillator();
                const oscGain = this.ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(isCrit ? 980 : 640, now);
                osc.frequency.exponentialRampToValueAtTime(isCrit ? 320 : 180, now + 0.12);

                oscGain.gain.setValueAtTime(isCrit ? 0.35 : 0.22, now);
                oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

                osc.connect(oscGain);
                oscGain.connect(this.sfxGain);

                osc.start(now);
                osc.stop(now + 0.15);

                // 2. White Noise Impact Burst
                const bufferSize = Math.floor(this.ctx.sampleRate * 0.08);
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
                }

                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(isCrit ? 2200 : 1400, now);
                filter.Q.setValueAtTime(2.0, now);

                const noiseGain = this.ctx.createGain();
                noiseGain.gain.setValueAtTime(isCrit ? 0.4 : 0.25, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

                noise.connect(filter);
                filter.connect(noiseGain);
                noiseGain.connect(this.sfxGain);

                noise.start(now);
            } catch (e) {}
        }

        /**
         * Tactical Dodge / Dash Swoosh.
         */
        playDash() {
            this.ensureContext();
            if (!this.ctx || !this.sfxGain) return;
            try {
                const now = this.ctx.currentTime;
                const bufferSize = Math.floor(this.ctx.sampleRate * 0.16);
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(400, now);
                filter.frequency.linearRampToValueAtTime(1400, now + 0.08);
                filter.frequency.exponentialRampToValueAtTime(200, now + 0.16);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.02, now);
                gain.gain.linearRampToValueAtTime(0.28, now + 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.sfxGain);

                noise.start(now);
            } catch (e) {}
        }

        /**
         * Potion Consumption (Alchemical Cork & Gulp).
         */
        playPotion() {
            this.ensureContext();
            if (!this.ctx || !this.sfxGain) return;
            try {
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(320, now);
                osc.frequency.exponentialRampToValueAtTime(640, now + 0.08);
                osc.frequency.exponentialRampToValueAtTime(440, now + 0.18);

                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

                osc.connect(gain);
                gain.connect(this.sfxGain);

                osc.start(now);
                osc.stop(now + 0.22);
            } catch (e) {}
        }

        /**
         * Mystic Level Up / Ascension Runic Chime.
         */
        playLevelUp() {
            this.ensureContext();
            if (!this.ctx || !this.sfxGain) return;
            try {
                const notes = [220, 277.18, 329.63, 440, 554.37]; // A major / mystical ascension chord
                notes.forEach((freq, idx) => {
                    const start = this.ctx.currentTime + idx * 0.07;
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();

                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, start);

                    gain.gain.setValueAtTime(0.18, start);
                    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);

                    osc.connect(gain);
                    gain.connect(this.sfxGain);

                    osc.start(start);
                    osc.stop(start + 0.65);
                });
            } catch (e) {}
        }
    }

    window.AudioManager = new AudioManagerClass();

    // Auto-resume AudioContext and trigger general theme on first click or key anywhere on page
    const autoUnlock = () => {
        if (window.AudioManager) {
            window.AudioManager.ensureContext();
            // If no track is currently playing, start the general theme
            if (!window.AudioManager.getCurrentTrack()) {
                window.AudioManager.playMusic('general');
            }
        }
    };
    window.addEventListener('pointerdown', autoUnlock);
    window.addEventListener('keydown', autoUnlock);
    window.addEventListener('click', autoUnlock);

})(window);
