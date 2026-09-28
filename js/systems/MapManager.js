/**
 * ============================================================================
 * MapManager.js
 * In Search of Hope: The Ashen Bastion
 *
 * Centralizes world maps, map configuration, preloading, camera scaling,
 * aspect-ratio preservation, and memory sanitization across all environments.
 * ============================================================================
 */

(function (window) {
    'use strict';

    /**
     * @typedef {Object} MapDefinition
     * @property {string} id
     * @property {'safe'|'combat'} type
     * @property {string} name
     * @property {string} subtitle
     * @property {string} src
     * @property {number} width
     * @property {number} height
     * @property {{ x: number, y: number }} spawn Normalized spawn coordinates (0.0 to 1.0)
     * @property {number} [bossRoomY] Normalized Y coordinate where boss arena starts
     * @property {number} [levelReq] Minimum character level recommended
     * @property {string} [themeMusic] Theme music track identifier
     */

    /** @type {Record<string, MapDefinition>} */
    const WORLD_MAPS = {
        HUB_VILLAGE: {
            id: 'HUB_VILLAGE',
            type: 'safe',
            name: 'Pátio do Bastião',
            subtitle: 'O Último Refúgio nas Cinzas',
            src: './assets/maps/hub_courtyard.jpg',
            fallbackSrc: './VILA UM CERTA.jpg',
            width: 1376,
            height: 768,
            spawn: { x: 0.5, y: 0.5 },
            themeMusic: 'general'
        },
        HUB_CATHEDRAL: {
            id: 'HUB_CATHEDRAL',
            type: 'safe',
            name: 'Catedral dos Ecos',
            subtitle: 'Santuário Sagrado de Servos e Sábios',
            src: './assets/maps/hub_cathedral_annex.jpg',
            fallbackSrc: null,
            width: 1344,
            height: 768,
            spawn: { x: 0.5, y: 0.88 },
            themeMusic: 'general'
        },
        DUNGEON_RIFT: {
            id: 'DUNGEON_RIFT',
            type: 'combat',
            name: 'A Fenda Abissal',
            subtitle: 'Catacumbas Criptografadas dos Penitentes',
            src: './assets/maps/dungeon_level_1.jpg',
            fallbackSrc: null,
            width: 2752,
            height: 1536,
            spawn: { x: 0.5, y: 0.92 },
            bossRoomY: 0.28,
            levelReq: 1,
            themeMusic: 'dungeon'
        },
        DUNGEON_FORGES: {
            id: 'DUNGEON_FORGES',
            type: 'combat',
            name: 'As Forjas Mortas',
            subtitle: 'Fundição Industrial Esquecida do Bastião',
            src: './assets/maps/dungeon_dead_forges.jpg',
            fallbackSrc: null,
            width: 1376,
            height: 768,
            spawn: { x: 0.5, y: 0.92 },
            bossRoomY: 0.26,
            levelReq: 8,
            themeMusic: 'dungeon'
        },
        DUNGEON_VOID: {
            id: 'DUNGEON_VOID',
            type: 'combat',
            name: 'O Trono do Vazio',
            subtitle: 'Arena Cósmica sobre o Abismo Infinito',
            src: './assets/maps/dungeon_void_throne.jpg',
            fallbackSrc: null,
            width: 3584,
            height: 2016,
            spawn: { x: 0.5, y: 0.95 },
            bossRoomY: 0.18,
            levelReq: 25,
            themeMusic: 'dungeon'
        }
    };

    class MapManagerClass {
        static get WORLD_MAPS() {
            return WORLD_MAPS;
        }

        constructor() {
            this.WORLD_MAPS = WORLD_MAPS;
            /** @type {Record<string, HTMLImageElement>} */
            this.imageCache = {};
            /** @type {Record<string, boolean>} */
            this.loadedStatus = {};
            this.activeDungeonMapId = 'DUNGEON_RIFT';
            this.activeHubMapId = 'HUB_VILLAGE';
        }

        /**
         * Returns map definition by ID.
         * @param {string} mapId
         * @returns {MapDefinition|null}
         */
        getMap(mapId) {
            return WORLD_MAPS[mapId] || null;
        }

        /**
         * Returns all maps dictionary.
         * @returns {Record<string, MapDefinition>}
         */
        getAllMaps() {
            return WORLD_MAPS;
        }

        /**
         * Preloads an image asset with resilient timeout.
         * @param {string} mapId
         * @param {number} [timeoutMs=2000]
         * @returns {Promise<{ img: HTMLImageElement|null, loaded: boolean }>}
         */
        loadMapAsset(mapId, timeoutMs = 2000) {
            const def = this.getMap(mapId);
            if (!def) {
                return Promise.resolve({ img: null, loaded: false });
            }

            if (this.imageCache[mapId] && this.loadedStatus[mapId]) {
                return Promise.resolve({ img: this.imageCache[mapId], loaded: true });
            }

            return new Promise((resolve) => {
                let settled = false;
                const settle = (result) => {
                    if (!settled) {
                        settled = true;
                        this.loadedStatus[mapId] = result.loaded;
                        if (result.loaded) this.imageCache[mapId] = result.img;
                        resolve(result);
                    }
                };

                const img = new Image();
                img.onload = () => settle({ img, loaded: true });
                img.onerror = () => {
                    if (def.fallbackSrc) {
                        console.warn(`[MapManager] ${def.src} falhou, tentando fallback: ${def.fallbackSrc}`);
                        const fb = new Image();
                        fb.onload = () => settle({ img: fb, loaded: true });
                        fb.onerror = () => settle({ img: null, loaded: false });
                        fb.src = def.fallbackSrc;
                    } else {
                        settle({ img: null, loaded: false });
                    }
                };
                img.src = def.src;

                setTimeout(() => {
                    if (!settled) {
                        console.warn(`[MapManager] Timeout no carregamento do mapa ${mapId}.`);
                        settle({ img: null, loaded: false });
                    }
                }, timeoutMs);
            });
        }

        /**
         * Preloads all maps asynchronously.
         * @returns {Promise<void>}
         */
        async preloadAll() {
            const keys = Object.keys(WORLD_MAPS);
            await Promise.allSettled(keys.map(k => this.loadMapAsset(k, 2500)));
            console.log('[MapManager] Todos os mapas foram pré-processados na pipeline.');
        }

        /**
         * Computes uniform camera scaling factor preserving original aspect ratio.
         * @param {number} canvasW
         * @param {number} canvasH
         * @param {number} mapW
         * @param {number} mapH
         * @returns {{ scale: number, offsetX: number, offsetY: number }}
         */
        calculateAspectFit(canvasW, canvasH, mapW, mapH) {
            const mapAspect = mapW / mapH;
            const canvasAspect = canvasW / canvasH;

            let renderW, renderH, scale;
            if (canvasAspect > mapAspect) {
                renderH = canvasH;
                renderW = canvasH * mapAspect;
                scale = canvasH / mapH;
            } else {
                renderW = canvasW;
                renderH = canvasW / mapAspect;
                scale = canvasW / mapW;
            }

            const offsetX = (canvasW - renderW) / 2;
            const offsetY = (canvasH - renderH) / 2;

            return {
                scale,
                offsetX,
                offsetY,
                renderW,
                renderH,
                width: renderW,
                height: renderH
            };
        }

        /**
         * Clamps camera coordinates within world boundary accounting for viewport & zoom.
         * @param {{ x: number, y: number }} camera
         * @param {number} mapW
         * @param {number} mapH
         * @param {number} viewW
         * @param {number} viewH
         * @param {number} zoom
         * @returns {{ x: number, y: number }}
         */
        clampCamera(camera, mapW, mapH, viewW, viewH, zoom = 1.0) {
            const halfViewW = (viewW / 2) / zoom;
            const halfViewH = (viewH / 2) / zoom;

            let clampedX = camera.x;
            let clampedY = camera.y;

            if (mapW > halfViewW * 2) {
                clampedX = Math.max(halfViewW, Math.min(mapW - halfViewW, camera.x));
            } else {
                clampedX = mapW / 2;
            }

            if (mapH > halfViewH * 2) {
                clampedY = Math.max(halfViewH, Math.min(mapH - halfViewH, camera.y));
            } else {
                clampedY = mapH / 2;
            }

            return { x: clampedX, y: clampedY };
        }

        /**
         * Limpeza de Memória: esvazia arrays de monstros, partículas, projéteis e
         * decais para garantir estabilidade de 60 FPS ao transitar de cena.
         * @param {any} engine DungeonEngine ou HubUI
         */
        cleanupMemory(engine) {
            if (!engine) return;

            try {
                if (Array.isArray(engine.enemies)) engine.enemies.length = 0;
                if (Array.isArray(engine.particles)) engine.particles.length = 0;
                if (Array.isArray(engine.projectiles)) engine.projectiles.length = 0;
                if (Array.isArray(engine.lootDrops)) engine.lootDrops.length = 0;
                if (Array.isArray(engine.corpses)) engine.corpses.length = 0;
                if (Array.isArray(engine.shockwaves)) engine.shockwaves.length = 0;
                if (Array.isArray(engine.bloodDecals)) engine.bloodDecals.length = 0;
                if (engine.combat) {
                    if (Array.isArray(engine.combat.hitboxes)) engine.combat.hitboxes.length = 0;
                    if (Array.isArray(engine.combat.groundEffects)) engine.combat.groundEffects.length = 0;
                }
                engine.boss = null;
                engine.bossFightActive = false;
                engine.fogGateActive = false;
                engine.extractionMonolith = null;
                console.log('[MapManager] Limpeza profunda de memória executada com sucesso.');
            } catch (err) {
                console.warn('[MapManager] Erro durante a limpeza de memória:', err);
            }
        }
    }

    // Exposição Global
    window.WORLD_MAPS = WORLD_MAPS;
    window.MapManager = new MapManagerClass();

})(window);
