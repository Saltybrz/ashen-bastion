/**
 * ============================================================================
 * ENTITY RENDERER - In Search of Hope: The Ashen Bastion
 * ============================================================================
 * High-performance 2D Sprite Renderer with Spatial Anchoring, Depth Sorting,
 * Projected Foot Shadows, Kinetic Kinematics, and Unified Pipeline Architecture.
 * 
 * Inviolable Rules:
 * 1. Definitive PNG/Canvas Rendering:
 *    Always renders official 2D textures. Never falls back to legacy geometric
 *    markers unless an asset is actively missing or corrupted.
 * 2. Spatial Anchoring & Depth:
 *    Foot pivot at exact (X, Y) coordinates with elliptical projected shadow.
 * 3. Horizontal Inversion:
 *    Flips smoothly when looking left (scale -1, 1).
 * 4. Micro-animations:
 *    2px sinusoidal idle breathing, 5-degree run tilt, 80ms white hit flash.
 * 5. Dimension Guarantees:
 *    Boss (The Ironbound Executioner): 180x180 px.
 *    Elites / Brutes: 80x80 px.
 *    Hero & Common Enemies: 50-64 px.
 * ============================================================================
 */

(function(window) {
    'use strict';

    class EntityRendererSystem {
        constructor() {
            this.name = 'EntityRenderer';
            this.vfxFrameTime = 0;
            this._warnedAssets = new Set();
        }

        /**
         * Resolve the sprite asset key for a given character class.
         * @param {Object} character 
         * @returns {string}
         */
        getPlayerSpriteKey(character) {
            if (!character) return 'base_mannequin';
            const cId = (character.classId || '').toLowerCase();

            if (cId === 'barbarian' || cId === 'warmaster' || cId === 'warrior') {
                return 'class_warmaster';
            }
            if (cId === 'rogue' || cId === 'flagellant' || cId === 'stalker') {
                return 'class_flagellant';
            }
            if (cId === 'paladin' || cId === 'hierophant' || cId === 'priest') {
                return 'class_hierophant';
            }
            if (cId === 'mage' || cId === 'heretic' || cId === 'necromancer') {
                return 'class_heretic';
            }
            return 'base_mannequin';
        }

        /**
         * Resolve the sprite asset key for a given enemy entity.
         * @param {Object} enemy 
         * @returns {string}
         */
        getEnemySpriteKey(enemy) {
            if (!enemy) return 'ashen_monk';

            // 1. Boss: O Carrasco de Ferro Negro
            if (enemy.isBoss || enemy.archetype === 'boss' || enemy.name?.includes('Carrasco') || enemy.bossType === 'iron_executioner') {
                return 'ironbound_executioner';
            }

            // 2. Rastejante / Criaturas Rápidas
            const name = (enemy.name || '').toLowerCase();
            const family = (enemy.familyId || '').toLowerCase();
            const arch = (enemy.archetype || '').toLowerCase();

            if (family === 'void_spawn' || arch === 'crawler' || name.includes('rastejante') || name.includes('crawler') || name.includes('skitterer')) {
                return 'void_skitterer';
            }

            // 3. Brutos / Elites
            if (enemy.isElite || enemy.isChampion || family === 'the_flayed' || arch === 'brute' || name.includes('bruto') || name.includes('flayed') || name.includes('cleaver')) {
                return 'flayed_brute';
            }

            // 4. Infanteria / Médios
            return 'ashen_monk';
        }

        /**
         * Single-warning notification for offline / loading assets.
         */
        renderFallbackWarning(ctx, screenX, screenY, entity) {
            const key = entity.spriteKey || entity.name || 'unknown';
            if (!this._warnedAssets.has(key)) {
                this._warnedAssets.add(key);
                console.warn(`[EntityRenderer] Fallback temporário ativo para ${key}: asset não encontrado ou em carregamento.`);
            }
        }

        /**
         * Render spatial elliptical shadow at entity feet anchor (X, Y).
         * @param {CanvasRenderingContext2D} ctx 
         * @param {Object} entity 
         */
        drawShadow(ctx, entity) {
            ctx.save();
            ctx.fillStyle = "rgba(5, 4, 6, 0.65)";
            ctx.beginPath();

            const isBoss = entity.isBoss || entity.archetype === 'boss' || entity.name?.includes('Carrasco');
            const isElite = entity.isElite || entity.isChampion;
            const baseRad = entity.radius || (entity.w ? entity.w / 2 : 22);

            let rx, ry;
            if (isBoss) {
                rx = 70;
                ry = 28;
            } else if (isElite) {
                rx = Math.max(28, baseRad * 1.3);
                ry = Math.max(12, baseRad * 0.55);
            } else {
                rx = Math.max(20, baseRad * 1.1);
                ry = Math.max(9, baseRad * 0.45);
            }

            ctx.ellipse(entity.x, entity.y, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        /**
         * Unified Entity Render Pipeline (Standard contract matching Engine & UI).
         * @param {CanvasRenderingContext2D} ctx 
         * @param {Object} entity 
         * @param {Object|null} camera 
         */
        drawEntity(ctx, entity, camera = null) {
            const screenX = entity.x - (camera ? camera.x : 0);
            const screenY = entity.y - (camera ? camera.y : 0);
            const spriteKey = entity.spriteKey || (entity.isEnemy ? this.getEnemySpriteKey(entity) : this.getPlayerSpriteKey(entity));
            const img = entity.sprite || (typeof AssetManager !== 'undefined' ? AssetManager.get(spriteKey) : null);

            ctx.save();

            // 1. Sombra Projetada na Base (Ancoragem Espacial)
            ctx.fillStyle = "rgba(5, 4, 6, 0.6)";
            ctx.beginPath();
            ctx.ellipse(screenX, screenY, entity.radius || 24, (entity.radius || 24) * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();

            // 2. Renderização do Asset Real
            const isLoaded = img && (img.complete === true || img instanceof HTMLCanvasElement) && 
                            ((img.naturalWidth > 0) || (img.width > 0));

            if (isLoaded) {
                const isBoss = entity.isBoss || entity.archetype === 'boss' || entity.name?.includes('Carrasco');
                const isBrute = entity.isElite || entity.name?.includes('Bruto') || entity.spriteKey === 'flayed_brute';
                const isSkitterer = entity.spriteKey === 'void_skitterer';

                let drawH = entity.height || (isBoss ? 180 : (isBrute ? 80 : (isSkitterer ? 50 : 64)));
                let drawW = entity.width || (isBoss ? 180 : (isBrute ? 80 : (isSkitterer ? 50 : 64)));

                const imgW = img.naturalWidth || img.width;
                const imgH = img.naturalHeight || img.height;
                if (imgW && imgH && !isBoss) {
                    drawW = drawH * (imgW / imgH);
                }

                const drawX = screenX - drawW / 2;
                const drawY = screenY - drawH * 0.85; // Alinha os pés ao pivô

                const facingLeft = entity.facing === 'left' || 
                                   (entity.facing && entity.facing.x < -0.05) || 
                                   (entity.vx && entity.vx < -0.1);

                if (facingLeft) {
                    ctx.translate(screenX, screenY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(img, -drawW / 2, -drawH * 0.85, drawW, drawH);
                } else {
                    ctx.drawImage(img, drawX, drawY, drawW, drawH);
                }
                if (typeof AssetManager !== 'undefined' && AssetManager.markDrawn) {
                    AssetManager.markDrawn(spriteKey);
                }
            } else {
                // 3. Fallback Estritamente Temporário com Aviso de Log Único
                this.renderFallbackWarning(ctx, screenX, screenY, entity);
                this._drawProceduralFallback(ctx, entity, entity.isBoss ? '#cf3a3a' : '#c5a059', entity.icon || 'ᛏ');
            }

            ctx.restore();
        }

        /**
         * Render the Player Hero Entity.
         * @param {CanvasRenderingContext2D} ctx 
         * @param {Object} player 
         * @param {Object} character 
         * @param {number} dt 
         */
        drawPlayer(ctx, player, character, dt = 0.016) {
            const spriteKey = player.spriteKey || this.getPlayerSpriteKey(character);
            const rawAsset = player.sprite || (typeof AssetManager !== 'undefined' ? AssetManager.get(spriteKey) : null);
            const img = (rawAsset && (rawAsset.canvas || rawAsset.image || rawAsset.source)) ? (rawAsset.canvas || rawAsset.image || rawAsset.source) : rawAsset;

            const isLoaded = img && (img.complete === true || img instanceof HTMLCanvasElement) && 
                            ((img.naturalWidth > 0) || (img.width > 0));

            // Fallback only if asset is truly unavailable
            if (!isLoaded) {
                this.renderFallbackWarning(ctx, player.x, player.y, player);
                if (typeof PaperdollSystem !== 'undefined' && PaperdollSystem.drawCharacter) {
                    PaperdollSystem.drawCharacter(ctx, player, character, dt);
                } else {
                    this._drawProceduralFallback(ctx, player, '#c5a059', character?.classIcon || 'ᛏ');
                }
                return;
            }

            const now = performance.now();
            const isMoving = Math.hypot(player.vx || 0, player.vy || 0) > 0.1 || player.isDashing;

            // 1. Invulnerability flash (i-frames blink)
            if (player.iFrames > 0 && Math.floor(player.iFrames * 25) % 2 === 0) {
                return;
            }

            // 2. Dash trail
            if (player.isDashing) {
                ctx.save();
                ctx.globalAlpha = 0.35;
                ctx.fillStyle = '#8b1e1e';
                ctx.beginPath();
                ctx.ellipse(player.x - (player.dashDirX || 0) * 18, player.y - (player.dashDirY || 0) * 18, 22, 10, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // 3. Projected Shadow at Feet (Spatial Anchor)
            this.drawShadow(ctx, player);

            // 4. Direction & Horizontal Flip
            const fx = player.facing ? player.facing.x : (player.vx || 1);
            const facingLeft = fx < -0.05;

            // 5. Kinematics: 2px Sinusoidal Idle Breathing vs 5° Run Tilt
            const idleBob = isMoving ? 0 : Math.sin(now / 320) * 2;
            const runTilt = isMoving ? (5 * Math.PI / 180) : 0;

            // Scaled dimensions: Target height ~64px
            const targetH = player.height || 64;
            const imgW = img.naturalWidth || img.width || 64;
            const imgH = img.naturalHeight || img.height || 64;
            const aspect = imgW / imgH;
            const targetW = targetH * aspect;

            ctx.save();
            ctx.translate(player.x, player.y + idleBob);

            // Horizontal flip if facing left
            if (facingLeft) {
                ctx.scale(-1, 1);
            }

            // Run tilt (in direction of movement)
            if (isMoving) {
                ctx.rotate(runTilt);
            }

            // Hit Flash (80ms bright white filter)
            const playerFlashActive = (!window.SettingsManager || window.SettingsManager.get('visual.hitFlashEnabled') !== false);
            if (player.hitFlashTimer > 0 && playerFlashActive) {
                ctx.filter = "brightness(2.5)";
            }

            // Draw Sprite: Base aligned at feet pivot (-targetH * 0.85)
            ctx.drawImage(img, -targetW / 2, -targetH * 0.85, targetW, targetH);
            if (typeof AssetManager !== 'undefined' && AssetManager.markDrawn) {
                AssetManager.markDrawn(spriteKey);
            }

            ctx.restore();
        }

        /**
         * Render an Enemy Entity (Creep, Elite, or Boss).
         * @param {CanvasRenderingContext2D} ctx 
         * @param {Object} enemy 
         * @param {number} dt 
         */
        drawEnemy(ctx, enemy, dt = 0.016) {
            const spriteKey = enemy.spriteKey || this.getEnemySpriteKey(enemy);
            const rawAsset = enemy.sprite || (typeof AssetManager !== 'undefined' ? AssetManager.get(spriteKey) : null);
            const img = (rawAsset && (rawAsset.canvas || rawAsset.image || rawAsset.source)) ? (rawAsset.canvas || rawAsset.image || rawAsset.source) : rawAsset;

            const isLoaded = img && (img.complete === true || img instanceof HTMLCanvasElement) && 
                            ((img.naturalWidth > 0) || (img.width > 0));

            // Fallback only if asset is truly unavailable
            if (!isLoaded) {
                this.renderFallbackWarning(ctx, enemy.x, enemy.y, enemy);
                if (typeof EnemyVisualRenderer !== 'undefined' && EnemyVisualRenderer.drawEnemy) {
                    EnemyVisualRenderer.drawEnemy(ctx, enemy, dt);
                } else {
                    this._drawProceduralFallback(ctx, enemy, enemy.isBoss ? '#cf3a3a' : '#991b1b', enemy.icon || 'ᛟ');
                }
                return;
            }

            const now = performance.now();
            const isBoss = enemy.isBoss || enemy.archetype === 'boss' || enemy.name?.includes('Carrasco');
            const isElite = enemy.isElite || enemy.isChampion;
            const isSkitterer = (spriteKey === 'void_skitterer');
            const isBrute = (spriteKey === 'flayed_brute');
            const isDying = enemy.isDying || (enemy.state === 'STATE_DEAD');

            // 1. Attack Telegraph (Flayed Brute Cleaver warning or Boss Telegraph)
            if (isBrute && (enemy.windUpTimer > 0 || enemy.slamTelegraph)) {
                this._drawBruteCleaverTelegraph(ctx, enemy);
            }

            // 2. Projected Shadow at Feet (Spatial Anchor)
            this.drawShadow(ctx, enemy);

            // 3. Facing Direction & Inversion
            let facingLeft = false;
            if (enemy.vx !== undefined && Math.abs(enemy.vx) > 1) {
                facingLeft = enemy.vx < 0;
            } else if (enemy.facing && enemy.facing.x !== undefined) {
                facingLeft = enemy.facing.x < 0;
            }

            // 4. Micro-kinetics
            let animBob = 0;
            let animTilt = 0;

            if (isBoss) {
                if (isDying) {
                    // Boss death stagger: staggers and drops to knees
                    const deathProg = enemy.deathDuration ? Math.min(1, (enemy.deathDuration - (enemy.deathTimer || 0)) / enemy.deathDuration) : 0.5;
                    animBob = deathProg * 22; // Knees buckling
                    animTilt = (facingLeft ? 1 : -1) * (0.15 + deathProg * 0.15); // Staggering forward lean
                } else if (enemy.isCharging) {
                    animTilt = (facingLeft ? 1 : -1) * 0.22; // Aggressive forward charge lean
                    animBob = Math.sin(now / 70) * 3;
                } else if (enemy.phase === 2) {
                    animBob = Math.sin(now / 280) * 3.5; // Rapid furious breathing
                    animTilt = Math.sin(now / 350) * 0.04;
                } else {
                    animBob = Math.sin(now / 500) * 2.5; // Slow heavy breathing
                }
            } else if (isSkitterer) {
                animBob = Math.sin(now / 80) * 1.5; // Rapid skittering jitter
                animTilt = Math.sin(now / 120) * 0.08;
            } else {
                animBob = Math.sin(now / 350) * 1.8;
            }

            // 5. Dimension Scaling: Exact rule requirements
            let targetH = 58;
            let targetW = 58;

            if (isBoss) {
                // Rule 4.3: Dimensões de desenho: 180x180 px (Chefe O Carrasco de Ferro Negro)
                targetH = 180;
                targetW = 180;
            } else if (isBrute) {
                // Brutos / Elites: 80 px
                targetH = 80;
                targetW = 80;
            } else if (isSkitterer) {
                targetH = 50;
                targetW = 50;
            }

            const imgW = img.naturalWidth || img.width || 64;
            const imgH = img.naturalHeight || img.height || 64;
            if (!isBoss && imgW && imgH) {
                targetW = targetH * (imgW / imgH);
            }

            ctx.save();
            ctx.translate(enemy.x, enemy.y + animBob);

            if (facingLeft) {
                ctx.scale(-1, 1);
            }

            if (animTilt !== 0) {
                ctx.rotate(animTilt);
            }

            // Hit Flash: 80ms white flash
            const enemyFlashActive = (!window.SettingsManager || window.SettingsManager.get('visual.hitFlashEnabled') !== false);
            if ((enemy.hitFlashTimer > 0 || enemy.hitFlash) && enemyFlashActive) {
                ctx.filter = "brightness(2.5)";
            }

            // Death sequence fading
            if (isBoss && isDying) {
                const deathProg = enemy.deathDuration ? Math.min(1, (enemy.deathDuration - (enemy.deathTimer || 0)) / enemy.deathDuration) : 0.5;
                ctx.globalAlpha = Math.max(0.2, 1 - deathProg * 0.7);
            }

            // Draw Sprite: Base aligned with feet pivot (-targetH * 0.85)
            ctx.drawImage(img, -targetW / 2, -targetH * 0.85, targetW, targetH);
            if (typeof AssetManager !== 'undefined' && AssetManager.markDrawn) {
                AssetManager.markDrawn(spriteKey);
            }

            // Boss Phase 2 Furnace Chest Glow & Ember Aura
            if (isBoss && enemy.phase === 2 && !isDying) {
                ctx.save();
                const furnacePulse = Math.sin(now / 150) * 0.2 + 0.8;
                const furnaceY = -targetH * 0.45;
                const fGrad = ctx.createRadialGradient(0, furnaceY, 4, 0, furnaceY, 32 * furnacePulse);
                fGrad.addColorStop(0, 'rgba(251, 146, 60, 0.95)');
                fGrad.addColorStop(0.4, 'rgba(239, 68, 68, 0.6)');
                fGrad.addColorStop(1, 'rgba(185, 28, 28, 0)');
                ctx.fillStyle = fGrad;
                ctx.beginPath();
                ctx.arc(0, furnaceY, 32 * furnacePulse, 0, Math.PI * 2);
                ctx.fill();

                // Cracked Bell Bronze Crown Glow
                const bellGrad = ctx.createRadialGradient(0, -targetH * 0.75, 2, 0, -targetH * 0.75, 18);
                bellGrad.addColorStop(0, 'rgba(253, 224, 71, 0.6)');
                bellGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
                ctx.fillStyle = bellGrad;
                ctx.beginPath();
                ctx.arc(0, -targetH * 0.75, 18, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            ctx.restore();

            // 6. Overhead Health Bar for enemies (respects SettingsManager enemyHealthBars)
            const hpSetting = (window.SettingsManager ? window.SettingsManager.get('gameplay.enemyHealthBars', 'combat') : 'combat');
            const showHp = (hpSetting === 'always') || (hpSetting === 'combat' && enemy.hp < enemy.maxHp);
            if (!isBoss && enemy.hp > 0 && showHp && hpSetting !== 'hidden') {
                this._drawOverheadHp(ctx, enemy, targetH);
            }
        }

        /**
         * Crimson attack telegraph line on ground for Flayed Brute cleaver attacks.
         */
        _drawBruteCleaverTelegraph(ctx, enemy) {
            ctx.save();
            const angle = enemy.attackAngle || (enemy.facing ? Math.atan2(enemy.facing.y, enemy.facing.x) : 0);
            const reach = 85;
            const width = 24;

            ctx.translate(enemy.x, enemy.y);
            ctx.rotate(angle);

            // Warning red zone
            ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
            ctx.fillRect(0, -width / 2, reach, width);

            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(0, -width / 2, reach, width);

            // Cleaver danger centerline
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(reach, 0);
            ctx.strokeStyle = '#f87171';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.restore();
        }

        /**
         * Subtle overhead HP bar for wounded regular and elite enemies.
         */
        _drawOverheadHp(ctx, enemy, spriteH) {
            const barW = Math.max(34, (enemy.w || 24) * 1.2);
            const barH = 4;
            const barX = enemy.x - barW / 2;
            const barY = enemy.y - spriteH - 8;
            const pct = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));

            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

            ctx.fillStyle = enemy.isElite ? '#f59e0b' : '#dc2626';
            ctx.fillRect(barX, barY, barW * pct, barH);
            ctx.restore();
        }

        /**
         * Render dynamic combat VFX from combat_vfx.png using Additive Mode ('screen').
         * Pure black background vanishes mathematically!
         * 
         * @param {CanvasRenderingContext2D} ctx 
         * @param {Object} vfx - { x, y, type, size, progress, angle, color }
         */
        drawCombatVFX(ctx, vfx) {
            const vfxImg = (typeof AssetManager !== 'undefined') ? AssetManager.getVfxImage() : null;
            if (!vfxImg || (!vfxImg.complete && !(vfxImg instanceof HTMLCanvasElement))) return;

            const x = vfx.x;
            const y = vfx.y;
            const progress = vfx.progress || 0; // 0 (start) to 1 (end)
            const alpha = Math.max(0, 1 - progress);
            const size = vfx.size || 60;
            const angle = vfx.angle || 0;

            // Quadrant regions in 1024x1024 combat_vfx.png:
            let sx = 120, sy = 80, sw = 380, sh = 380;
            if (vfx.vfxType === 'fire' || vfx.vfxType === 'pyre') {
                sx = 512; sy = 100; sw = 400; sh = 400;
            } else if (vfx.vfxType === 'void') {
                sx = 100; sy = 512; sw = 400; sh = 400;
            } else if (vfx.vfxType === 'impact' || vfx.vfxType === 'hit') {
                sx = 520; sy = 520; sw = 380; sh = 380;
            }

            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = alpha;

            ctx.translate(x, y);
            ctx.rotate(angle);

            const currentSize = size * (0.8 + progress * 0.4);
            ctx.drawImage(vfxImg, sx, sy, sw, sh, -currentSize / 2, -currentSize / 2, currentSize, currentSize);

            ctx.globalCompositeOperation = 'source-over';
            ctx.restore();
        }

        /**
         * Minimal procedural fallback if asset is completely offline.
         */
        _drawProceduralFallback(ctx, entity, color, glyph) {
            this.drawShadow(ctx, entity);

            const r = entity.radius || 18;
            ctx.save();
            ctx.beginPath();
            ctx.arc(entity.x, entity.y - r, r, 0, Math.PI * 2);
            ctx.fillStyle = '#181619';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.font = 'bold 15px "Cinzel", serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#e8d8b0';
            ctx.fillText(glyph, entity.x, entity.y - r);
            ctx.restore();
        }
    }

    // Expose singleton to window
    window.EntityRenderer = new EntityRendererSystem();

})(typeof window !== 'undefined' ? window : this);
