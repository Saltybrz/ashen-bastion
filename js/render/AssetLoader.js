/**
 * ============================================================================
 * ASSET MANAGER & 2D SPRITE PIPELINE - In Search of Hope: The Ashen Bastion
 * ============================================================================
 * Centralized, asynchronous 2D asset pipeline with rigid promises, automatic
 * dual-extension resolution (.png / .jpg), and graceful chroma-key transparency.
 * 
 * Inviolable Rules:
 * 1. Single Source of Truth:
 *    AssetManager stores HTMLImageElement / processed canvas objects indexed by
 *    canonical entity keys.
 * 2. Complete Asset Guarantee:
 *    Any asset returned by AssetManager.get(key) satisfies:
 *    (img.complete === true && img.naturalWidth > 0)
 * 3. Dual Extension Fallback:
 *    Tries primary format (.png) and automatically resolves to alternative (.jpg)
 *    preventing 404s on case-sensitive or extension-divergent filesystems.
 * 4. Zero-Crash Fallback:
 *    If CORS or file:// prevents canvas pixel manipulation, retains the raw
 *    HTMLImageElement so drawImage() renders the official asset directly.
 * ============================================================================
 */

(function(window) {
    'use strict';

    const SPRITE_MANIFEST = {
        // Characters
        'base_mannequin': { src: './assets/sprites/characters/base_mannequin.png', mode: 'chroma-white' },
        'class_warmaster': { src: './assets/sprites/characters/class_warmaster.png', mode: 'chroma-white' },
        'class_flagellant': { src: './assets/sprites/characters/class_flagellant.png', mode: 'chroma-white' },
        'class_hierophant': { src: './assets/sprites/characters/class_hierophant.png', mode: 'chroma-white' },
        'class_heretic': { src: './assets/sprites/characters/class_heretic.png', mode: 'chroma-white' },

        // Enemies
        'flayed_brute': { src: './assets/sprites/enemies/flayed_brute.png', mode: 'chroma-white' },
        'ashen_monk': { src: './assets/sprites/enemies/ashen_monk.png', mode: 'chroma-white' },
        'void_skitterer': { src: './assets/sprites/enemies/void_skitterer.png', mode: 'chroma-white' },

        // Bosses
        'ironbound_executioner': { src: './assets/sprites/bosses/ironbound_executioner.png', mode: 'chroma-white' },

        // Visual Effects
        'combat_vfx': { src: './assets/sprites/vfx/combat_vfx.png', mode: 'chroma-black' },

        // Maps
        'hub_courtyard': { src: './assets/maps/hub_courtyard.jpg', mode: 'alpha' },
        'dungeon_level_1': { src: './assets/maps/dungeon_level_1.jpg', mode: 'alpha' }
    };

    class AssetManager {
        static cache = new Map();
        static statusMap = new Map();
        static readyAssets = new Set();
        static failedAssets = new Set();
        static loadPromise = null;
        static isInitialized = false;
        static isLoading = false;

        /**
         * Initialize status tracking for an asset.
         */
        static _getOrCreateStatus(key, src, mode = 'alpha') {
            if (!this.statusMap.has(key)) {
                this.statusMap.set(key, {
                    key: key,
                    src: src,
                    resolvedPath: src,
                    transparencyMode: mode,
                    loaded: false,
                    failed: false,
                    width: 0,
                    height: 0,
                    naturalWidth: 0,
                    naturalHeight: 0,
                    cachedType: null,
                    rendererAttached: false,
                    drawImageActive: false,
                    lastDrawnTimestamp: 0,
                    fallbackActive: false,
                    error: null,
                    attempts: 0
                });
            }
            return this.statusMap.get(key);
        }

        /**
         * Load a single image asset by key and source path with rigid promise.
         * @param {string} key 
         * @param {string|Object} srcOrConfig 
         * @param {Object} [options]
         * @returns {Promise<HTMLImageElement|HTMLCanvasElement|null>}
         */
        static load(key, srcOrConfig, options = {}) {
            let src = typeof srcOrConfig === 'string' ? srcOrConfig : (srcOrConfig.src || '');
            let mode = (typeof srcOrConfig === 'object' && srcOrConfig.mode) ? srcOrConfig.mode : (options.mode || 'alpha');

            // Default mode from manifest if present
            if (SPRITE_MANIFEST[key] && typeof SPRITE_MANIFEST[key] === 'object') {
                if (!mode || mode === 'alpha') {
                    mode = SPRITE_MANIFEST[key].mode || 'alpha';
                }
                if (!src) {
                    src = SPRITE_MANIFEST[key].src;
                }
            }

            const status = this._getOrCreateStatus(key, src, mode);

            return new Promise((resolve) => {
                const img = new Image();
                if (typeof window !== 'undefined' && window.location && window.location.protocol !== 'file:') {
                    img.crossOrigin = 'anonymous';
                }

                let attempts = 0;
                const tryLoad = (url) => {
                    attempts++;
                    status.attempts = attempts;
                    status.resolvedPath = url;

                    img.onload = () => {
                        console.log(`[AssetManager] Carregado com sucesso: ${key} (${img.naturalWidth}x${img.naturalHeight}) de ${url} [mode: ${mode}]`);

                        status.loaded = true;
                        status.failed = false;
                        status.naturalWidth = img.naturalWidth;
                        status.naturalHeight = img.naturalHeight;
                        status.rendererAttached = true;
                        status.fallbackActive = false;

                        let drawable = img;

                        // Edge-aware contour flood fill for chroma-white
                        if (mode === 'chroma-white' || mode === 'chroma-black') {
                            try {
                                const w = img.naturalWidth || img.width;
                                const h = img.naturalHeight || img.height;
                                if (w > 0 && h > 0) {
                                    const offscreen = document.createElement('canvas');
                                    offscreen.width = w;
                                    offscreen.height = h;
                                    const ctx = offscreen.getContext('2d', { willReadFrequently: true });
                                    ctx.drawImage(img, 0, 0, w, h);

                                    const imgData = ctx.getImageData(0, 0, w, h);
                                    const data = imgData.data;
                                    const totalPixels = w * h;

                                    // 1. Check if the image ALREADY has real alpha channel
                                    let hasNativeAlpha = false;
                                    for (let i = 3; i < totalPixels * 4; i += 16) {
                                        if (data[i] < 220) {
                                            hasNativeAlpha = true;
                                            break;
                                        }
                                    }

                                    if (hasNativeAlpha && mode === 'chroma-white') {
                                        console.log(`[AssetManager] ${key} possui alpha real nativo. Ignorando chroma-key.`);
                                        status.transparencyMode = 'alpha';
                                    } else if (mode === 'chroma-white') {
                                        // 2. Border-connected flood-fill:
                                        // Start ONLY from outer borders (x=0, x=w-1, y=0, y=h-1).
                                        // Any white connected to the outside border is background.
                                        // Internal whites (eyes, teeth, skulls, weapon glints) are NOT connected to borders,
                                        // so they remain 100% intact and opaque!
                                        const visited = new Uint8Array(totalPixels);
                                        const queue = [];

                                        const isWhite = (px, py) => {
                                            const idx = (py * w + px) * 4;
                                            return data[idx] > 220 && data[idx + 1] > 220 && data[idx + 2] > 220;
                                        };

                                        // Seed top and bottom borders
                                        for (let x = 0; x < w; x++) {
                                            if (isWhite(x, 0)) {
                                                const p0 = x;
                                                visited[p0] = 1;
                                                queue.push(p0);
                                            }
                                            if (isWhite(x, h - 1)) {
                                                const p1 = (h - 1) * w + x;
                                                visited[p1] = 1;
                                                queue.push(p1);
                                            }
                                        }

                                        // Seed left and right borders
                                        for (let y = 0; y < h; y++) {
                                            if (isWhite(0, y)) {
                                                const p0 = y * w;
                                                if (!visited[p0]) {
                                                    visited[p0] = 1;
                                                    queue.push(p0);
                                                }
                                            }
                                            if (isWhite(w - 1, y)) {
                                                const p1 = y * w + (w - 1);
                                                if (!visited[p1]) {
                                                    visited[p1] = 1;
                                                    queue.push(p1);
                                                }
                                            }
                                        }

                                        // BFS Flood-fill outer background
                                        let head = 0;
                                        while (head < queue.length) {
                                            const curr = queue[head++];
                                            const cx = curr % w;
                                            const cy = Math.floor(curr / w);

                                            // Neighbors (Up, Down, Left, Right)
                                            if (cx > 0) {
                                                const left = curr - 1;
                                                if (!visited[left] && isWhite(cx - 1, cy)) {
                                                    visited[left] = 1;
                                                    queue.push(left);
                                                }
                                            }
                                            if (cx < w - 1) {
                                                const right = curr + 1;
                                                if (!visited[right] && isWhite(cx + 1, cy)) {
                                                    visited[right] = 1;
                                                    queue.push(right);
                                                }
                                            }
                                            if (cy > 0) {
                                                const up = curr - w;
                                                if (!visited[up] && isWhite(cx, cy - 1)) {
                                                    visited[up] = 1;
                                                    queue.push(up);
                                                }
                                            }
                                            if (cy < h - 1) {
                                                const down = curr + w;
                                                if (!visited[down] && isWhite(cx, cy + 1)) {
                                                    visited[down] = 1;
                                                    queue.push(down);
                                                }
                                            }
                                        }

                                        // Apply transparency ONLY to visited outer background pixels
                                        for (let i = 0; i < totalPixels; i++) {
                                            if (visited[i] === 1) {
                                                data[i * 4 + 3] = 0;
                                            }
                                        }
                                    } else if (mode === 'chroma-black') {
                                        // For black background textures
                                        for (let i = 0; i < totalPixels; i++) {
                                            const idx = i * 4;
                                            if (data[idx] < 20 && data[idx + 1] < 20 && data[idx + 2] < 20) {
                                                data[idx + 3] = 0;
                                            }
                                        }
                                    }

                                    ctx.putImageData(imgData, 0, 0);

                                    // Calculate tight bounding box of visible content
                                    let minX = w, minY = h, maxX = 0, maxY = 0;
                                    for (let i = 0; i < totalPixels; i++) {
                                        if (data[i * 4 + 3] > 15) {
                                            const px = i % w;
                                            const py = Math.floor(i / w);
                                            if (px < minX) minX = px;
                                            if (px > maxX) maxX = px;
                                            if (py < minY) minY = py;
                                            if (py > maxY) maxY = py;
                                        }
                                    }

                                    if (minX <= maxX && minY <= maxY) {
                                        const bboxW = Math.max(1, maxX - minX + 1);
                                        const bboxH = Math.max(1, maxY - minY + 1);
                                        const cropCanvas = document.createElement('canvas');
                                        cropCanvas.width = bboxW;
                                        cropCanvas.height = bboxH;
                                        const cropCtx = cropCanvas.getContext('2d');
                                        cropCtx.drawImage(offscreen, minX, minY, bboxW, bboxH, 0, 0, bboxW, bboxH);

                                        // Uniform image interface
                                        Object.defineProperty(cropCanvas, 'complete', { value: true, writable: false });
                                        Object.defineProperty(cropCanvas, 'naturalWidth', { get() { return this.width; } });
                                        Object.defineProperty(cropCanvas, 'naturalHeight', { get() { return this.height; } });
                                        cropCanvas.source = img;
                                        cropCanvas.image = img;
                                        cropCanvas.canvas = cropCanvas;
                                        cropCanvas.bbox = { x: minX, y: minY, w: bboxW, h: bboxH };

                                        img.canvas = cropCanvas;
                                        img.bbox = cropCanvas.bbox;
                                        drawable = cropCanvas;
                                        status.cachedType = 'HTMLCanvasElement';
                                        status.width = bboxW;
                                        status.height = bboxH;
                                    } else {
                                        drawable = offscreen;
                                        status.cachedType = 'HTMLCanvasElement';
                                        status.width = w;
                                        status.height = h;
                                    }
                                }
                            } catch (e) {
                                console.warn(`[AssetManager] Processamento contornado para ${key} (${e.message}). Mantendo HTMLImageElement.`);
                                status.cachedType = 'HTMLImageElement';
                                status.width = img.naturalWidth;
                                status.height = img.naturalHeight;
                            }
                        } else {
                            status.cachedType = 'HTMLImageElement';
                            status.width = img.naturalWidth;
                            status.height = img.naturalHeight;
                        }

                        // Attach cross-references to img
                        img.source = img;
                        img.image = img;
                        if (!img.canvas) img.canvas = drawable;

                        this.cache.set(key, drawable);
                        this.readyAssets.add(key);
                        resolve(drawable);
                    };

                    img.onerror = (err) => {
                        if (attempts === 1) {
                            let altUrl = null;
                            if (url.endsWith('.png')) altUrl = url.replace(/\.png$/, '.jpg');
                            else if (url.endsWith('.jpg')) altUrl = url.replace(/\.jpg$/, '.png');

                            if (altUrl) {
                                console.log(`[AssetManager] Tentando formato alternativo para ${key}: ${altUrl}`);
                                tryLoad(altUrl);
                                return;
                            }
                        }

                        console.error(`[AssetManager] FALHA CRÍTICA ao carregar asset: ${key} em ${src}`, err);
                        status.loaded = false;
                        status.failed = true;
                        status.error = `HTTP/FILE ERROR ao acessar ${url}`;
                        status.fallbackActive = true;
                        this.failedAssets.add(key);
                        resolve(null);
                    };

                    img.src = url;
                };

                tryLoad(src);
            });
        }

        /**
         * Retrieve a cached asset by canonical key.
         * @param {string} key 
         * @returns {HTMLImageElement|HTMLCanvasElement|null}
         */
        static get(key) {
            return this.cache.get(key) || null;
        }

        /**
         * Check if asset is cached.
         * @param {string} key 
         * @returns {boolean}
         */
        static has(key) {
            return this.cache.has(key);
        }

        /**
         * Notify AssetManager that drawImage() has rendered this asset.
         * @param {string} key 
         */
        static markDrawn(key) {
            const st = this.statusMap.get(key);
            if (st) {
                st.drawImageActive = true;
                st.lastDrawnTimestamp = performance.now();
            }
        }

        /**
         * Detailed status diagnostic for an asset or all assets.
         * @param {string} [key] 
         * @returns {Object}
         */
        static status(key = null) {
            if (key) {
                return this.statusMap.get(key) || {
                    key: key,
                    loaded: false,
                    failed: true,
                    error: 'Asset não registrado no manifesto',
                    fallbackActive: true
                };
            }
            const out = {};
            for (const [k, v] of this.statusMap.entries()) {
                out[k] = { ...v };
            }
            return out;
        }

        /**
         * Verify if asset is completely loaded with valid dimensions.
         * If key is omitted, returns true if AssetManager has loaded assets and cache is populated.
         * @param {string} [key] 
         * @returns {boolean}
         */
        static isReady(key = null) {
            if (key) {
                const asset = this.cache.get(key);
                if (!asset) return false;
                return (asset.complete === true || asset instanceof HTMLCanvasElement) && 
                       ((asset.naturalWidth > 0) || (asset.width > 0));
            }
            return this.cache.size > 0 && this.readyAssets.size > 0;
        }

        /**
         * Get VFX texture image for additive blending ('screen' / 'lighter').
         */
        static getVfxImage() {
            const item = this.get('combat_vfx');
            if (!item) return null;
            this.markDrawn('combat_vfx');
            return item.source || item.image || item;
        }

        /**
         * Pre-load all registered sprites in manifest with rigid promises and 2s fail-safe.
         * @returns {Promise<Map>}
         */
        static loadAll() {
            if (this.loadPromise) return this.loadPromise;

            this.isLoading = true;
            console.log('[AssetManager] Iniciando carregamento centralizado com rigid promises...');

            const loadTasks = Object.entries(SPRITE_MANIFEST).map(([key, config]) => {
                const src = typeof config === 'string' ? config : config.src;
                const mode = typeof config === 'object' ? config.mode : 'alpha';
                return this.load(key, src, { mode });
            });

            const timeoutPromise = new Promise((resolve) => {
                setTimeout(() => {
                    console.warn(`[AssetManager] Fail-safe timer (1.8s) expirado. Assets carregados: ${this.readyAssets.size}/${Object.keys(SPRITE_MANIFEST).length}`);
                    resolve(this.cache);
                }, 1800);
            });

            this.loadPromise = Promise.race([
                Promise.all(loadTasks),
                timeoutPromise
            ]).then(() => {
                this.isLoading = false;
                this.isInitialized = true;
                console.log(`[AssetManager] Pipeline consolidada. Ativos no cache: ${this.readyAssets.size}`);
                return this.cache;
            }).catch(err => {
                console.warn('[AssetManager] Erro no carregamento consolidado, usando fallbacks:', err);
                this.isLoading = false;
                this.isInitialized = true;
                return this.cache;
            });

            return this.loadPromise;
        }

        /**
         * Draw in-game Asset Debug Overlay (F3).
         * @param {CanvasRenderingContext2D} ctx 
         * @param {number} canvasW 
         * @param {number} canvasH 
         */
        static drawDebugOverlay(ctx, canvasW, canvasH) {
            if (!window.ASHEN_ASSET_DEBUG) return;

            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Screen space reset

            const panelW = 390;
            const panelX = canvasW - panelW - 16;
            const panelY = 16;

            const manifestKeys = Object.keys(SPRITE_MANIFEST);
            const totalItems = manifestKeys.length;
            const panelH = Math.min(canvasH - 32, 54 + totalItems * 52);

            // Dark semi-transparent gothic backdrop
            ctx.fillStyle = 'rgba(8, 7, 10, 0.92)';
            ctx.fillRect(panelX, panelY, panelW, panelH);
            ctx.strokeStyle = '#c5a059';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(panelX, panelY, panelW, panelH);

            // Header
            ctx.font = 'bold 13px "Cinzel", serif';
            ctx.fillStyle = '#e5c07b';
            ctx.fillText('⚡ ASHEN ASSET DEBUG [F3] ⚡', panelX + 14, panelY + 24);

            ctx.font = '10px monospace';
            ctx.fillStyle = '#8e8c89';
            ctx.fillText(`Cache: ${this.readyAssets.size}/${totalItems} | Failures: ${this.failedAssets.size}`, panelX + 14, panelY + 40);

            // Divider
            ctx.strokeStyle = 'rgba(197, 160, 89, 0.3)';
            ctx.beginPath();
            ctx.moveTo(panelX + 10, panelY + 46);
            ctx.lineTo(panelX + panelW - 10, panelY + 46);
            ctx.stroke();

            // List assets
            let lineY = panelY + 62;
            for (const key of manifestKeys) {
                const st = this.status(key);
                const isOk = st.loaded && !st.failed;

                // Status icon & key name
                ctx.font = 'bold 11px monospace';
                if (isOk) {
                    ctx.fillStyle = '#4ade80'; // Green check
                    ctx.fillText('✓', panelX + 14, lineY);
                    ctx.fillStyle = '#f3f4f6';
                    ctx.fillText(key.toUpperCase(), panelX + 28, lineY);
                } else {
                    ctx.fillStyle = '#ef4444'; // Red cross
                    ctx.fillText('✗', panelX + 14, lineY);
                    ctx.fillStyle = '#fca5a5';
                    ctx.fillText(`${key.toUpperCase()} (FALHA)`, panelX + 28, lineY);
                }

                // Details line
                ctx.font = '9px monospace';
                if (isOk) {
                    ctx.fillStyle = '#9ca3af';
                    const dim = `${st.width}x${st.height}`;
                    const nat = st.naturalWidth ? `(orig: ${st.naturalWidth}x${st.naturalHeight})` : '';
                    const drawn = st.drawImageActive ? '• drawImage: OK' : '• drawImage: IDLE';
                    ctx.fillText(`${dim} ${nat} ${drawn}`, panelX + 28, lineY + 12);
                    ctx.fillStyle = st.drawImageActive ? '#60a5fa' : '#6b7280';
                    ctx.fillText(`type: ${st.cachedType || 'Image'} | mode: ${st.transparencyMode}`, panelX + 28, lineY + 23);
                } else {
                    ctx.fillStyle = '#f87171';
                    ctx.fillText(st.error || 'HTTP/FILE ERROR • FALLBACK ACTIVE', panelX + 28, lineY + 12);
                    ctx.fillText(`caminho: ${st.resolvedPath || st.src}`, panelX + 28, lineY + 23);
                }

                lineY += 46;
                if (lineY > panelY + panelH - 20) break;
            }

            ctx.restore();
        }

        // Backwards compatibility alias
        static init() {
            return this.loadAll();
        }
    }

    // Toggle asset debug mode via F3
    if (typeof window !== 'undefined') {
        window.ASHEN_ASSET_DEBUG = false;
        window.toggleAssetDebug = function() {
            window.ASHEN_ASSET_DEBUG = !window.ASHEN_ASSET_DEBUG;
            console.log(`[Ashen Asset Debug] ${window.ASHEN_ASSET_DEBUG ? 'ATIVADO [F3]' : 'DESATIVADO [F3]'}`);
        };

        window.addEventListener('keydown', (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                window.toggleAssetDebug();
            }
        });
    }

    // Expose both AssetManager and AssetLoader
    window.AssetManager = AssetManager;
    window.AssetLoader = AssetManager;

    // Immediately trigger background preload
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => AssetManager.loadAll());
    } else {
        AssetManager.loadAll();
    }

})(typeof window !== 'undefined' ? window : this);
