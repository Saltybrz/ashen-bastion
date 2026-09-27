/**
 * ===================================================================
 *  IN SEARCH OF HOPE: THE ASHEN BASTION
 *  EnemyVisualRenderer.js — Data-Driven 2D Canvas Monster Rig & Renderer
 *  Perspective: Top-Down Inclinada (15° a 20° de inclinação)
 *  4 Famílias de Inimigos | 5 Níveis de Ameaça | 3 Primeiros Chefes
 * ===================================================================
 */

(function(global) {
    'use strict';

    // ─── Paleta Canônica do Bastião (Bíblia de Estilo) ───
    const PALETTE = Object.freeze({
        // Dominante (80%)
        DOMINANT_DARK:      '#09080A',
        DOMINANT_CHARCOAL:  '#141215',
        DOMINANT_IRON:      '#1F1C1F',
        // Estrutural (15%)
        STRUCT_BRASS:       '#4A3C28',
        STRUCT_LEATHER:     '#2D231E',
        STRUCT_BONE:        '#7D7569',
        STRUCT_CERAMIC:     '#373435',
        // Acento Vital (3%)
        VITAL_DRIED_BLOOD:  '#4E1111',
        VITAL_CRIMSON:      '#8B1C1C',
        VITAL_EXPOSED_FLESH:'#541212',
        // Acento Arcano / Corrupção (2%)
        ARCANE_EMBER:       '#DF5418',
        ARCANE_EMBER_HOT:   '#FF8A65',
        ARCANE_EMBER_CORE:  '#D84315',
        ARCANE_EMERALD:     '#2B6E4E',
        ARCANE_VOID:        '#4B1E6D',
        ARCANE_VOID_DARK:   '#0D0B12',
        ARCANE_VOID_DEEP:   '#221E28',
        ARCANE_VOID_MEMBR:  '#311B92',
        ARCANE_VOID_BRIGHT: '#B388FF',
        ARCANE_VOID_EYE:    '#7B1FA2',
        // Peste
        BLIGHT_PUSTULE:     '#827717',
        BLIGHT_BILE:        '#A49826',
        BLIGHT_FUR:         '#3A342B',
        // Metais & Ferragens
        IRON_STAPLE:        '#C0C0C8',
        OXIDIZED_BRONZE:    '#4A3C28',
        OLD_GOLD:           '#735C32',
        GOLD_INCANDESCENT:  '#C5A059',
    });

    // ─── Definição das 4 Famílias de Inimigos ───
    const ENEMY_FAMILIES = Object.freeze({
        THE_FLAYED:     'the_flayed',       // Família I: Os Esfolados
        ASHEN_COVEN:    'ashen_coven',      // Família II: A Congregação das Cinzas
        VOID_SPAWN:     'void_spawn',       // Família III: As Crias do Vácuo
        BLIGHTED_BROOD: 'blighted_brood',   // Família IV: As Bestas da Peste
    });

    // ─── Níveis de Variante Hierárquica ───
    const VARIANT_TIERS = Object.freeze({
        COMMON:   'common',   // Escala 1.0x
        VETERAN:  'veteran',  // Escala 1.05x, marcas de guerra, capacete rústico
        ELITE:    'elite',    // Escala 1.15x, espigões dorsais, correntes, olhos fumegantes
        CHAMPION: 'champion', // Escala 1.25x, crucifixos/estandartes nas costas, aura rúnica
        BOSS:     'boss',     // Escala 1.4x a 3.0x, anatomia monumental, arena dedicada
    });

    /**
     * Motor Gráfico Especializado de Inimigos e Chefes para Canvas 2D
     */
    class EnemyVisualRenderer {

        /**
         * Ponto de entrada universal para renderizar qualquer inimigo.
         * Respeita:
         * 1. Inversão horizontal se virado para a esquerda (ctx.scale(-1, 1))
         * 2. Sombra projetada elíptica (rgba(5, 4, 6, 0.65))
         * 3. Animação de caminhada/respiração dependendo do estado
         * 4. 4 Famílias anatômicas com texturização de ruído
         * 5. 5 Níveis de Variante com adereços de dorso, auras e correntes
         * 6. Chefes monumentais com fases visuais
         * 7. Shader de dano (Flash branco de 80ms)
         */
        static drawEnemy(ctx, enemy, dt = 0.016) {
            if (!enemy || enemy.state === 'STATE_DEAD') return;

            const now = performance.now();
            const ex = Math.round(enemy.x);
            const ey = Math.round(enemy.y);

            // Determina família e tier do inimigo
            const family = enemy.familyId || this._resolveFamilyFromEnemy(enemy);
            const tier = enemy.variantTier || this._resolveTierFromEnemy(enemy);
            const isBoss = enemy.isBoss || tier === VARIANT_TIERS.BOSS;
            const isCharging = enemy.isCharging || false;

            // Determina escala pelo tier
            let scaleMult = 1.0;
            switch (tier) {
                case VARIANT_TIERS.VETERAN:  scaleMult = 1.05; break;
                case VARIANT_TIERS.ELITE:    scaleMult = 1.15; break;
                case VARIANT_TIERS.CHAMPION: scaleMult = 1.25; break;
                case VARIANT_TIERS.BOSS:     scaleMult = enemy.bossScale || (enemy.archetype === 'boss' ? 2.8 : 1.4); break;
                default: scaleMult = 1.0; break;
            }

            // Direção de olhada (Facing)
            const facingX = (enemy.facing && typeof enemy.facing.x === 'number') ? enemy.facing.x : 0;
            const facingY = (enemy.facing && typeof enemy.facing.y === 'number') ? enemy.facing.y : 1;
            const isFacingLeft = facingX < -0.15;
            const isFacingNorth = facingY < -0.45;

            // Animação de passo / respiração
            const isMoving = (enemy.vx * enemy.vx + enemy.vy * enemy.vy) > 1 || enemy.state === 'STATE_CHASE';
            const animSpeed = isMoving ? 9 : 4;
            const animCycle = Math.sin((now / 1000) * animSpeed);
            const walkBob = isMoving ? Math.abs(animCycle) * 3 : Math.sin(now / 500) * 1.2;
            const walkSway = isMoving ? animCycle * 2 : 0;

            // ─── 1. AURA DE CHÃO PARA CAMPEÕES E CHEFES ───
            if (tier === VARIANT_TIERS.CHAMPION || isBoss) {
                this._drawGroundAura(ctx, ex, ey, tier, isBoss, enemy.phase || 1, now);
            }

            // ─── 2. SOMBRA PROJETADA ELÍPTICA ───
            this._drawShadow(ctx, ex, ey, enemy.radius || 14, scaleMult);

            // ─── SALVA MATRIZ PARA RENDERIZAÇÃO DA ENTIDADE ───
            ctx.save();
            ctx.translate(ex, ey);

            // Espelhamento horizontal se virado para a esquerda
            if (isFacingLeft) {
                ctx.scale(-1, 1);
            }

            // Escala geométrica do tier
            ctx.scale(scaleMult, scaleMult);

            // ─── 3. DISPATCHER VISUAL POR CHEFE OU FAMÍLIA ───
            if (isBoss) {
                this._drawBoss(ctx, enemy, isFacingNorth, walkBob, walkSway, now, dt);
            } else {
                // Desenha adereços de dorso para Elites/Campeões (Z-inferior ou Z-superior)
                if (isFacingNorth) {
                    this._drawDorsalAccessories(ctx, family, tier, now);
                }

                // Desenha corpo da família
                switch (family) {
                    case ENEMY_FAMILIES.THE_FLAYED:
                        this._drawTheFlayed(ctx, enemy, tier, isFacingNorth, walkBob, walkSway, now);
                        break;
                    case ENEMY_FAMILIES.ASHEN_COVEN:
                        this._drawAshenCoven(ctx, enemy, tier, isFacingNorth, walkBob, walkSway, now);
                        break;
                    case ENEMY_FAMILIES.VOID_SPAWN:
                        this._drawVoidSpawn(ctx, enemy, tier, isFacingNorth, walkBob, walkSway, now);
                        break;
                    case ENEMY_FAMILIES.BLIGHTED_BROOD:
                    default:
                        this._drawBlightedBrood(ctx, enemy, tier, isFacingNorth, walkBob, walkSway, now);
                        break;
                }

                // Se olhando para o Sul/Leste, os adereços de dorso ficam atrás ou sobrepostos
                if (!isFacingNorth) {
                    this._drawDorsalAccessories(ctx, family, tier, now);
                }
            }

            // ─── 4. SHADER DE DANO (FLASH BRANCO DE 80MS) ───
            if (enemy.hitFlash || (enemy.hitFlashTimer && enemy.hitFlashTimer > 0)) {
                ctx.save();
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
                ctx.fillRect(-enemy.radius * 2, -enemy.radius * 3, enemy.radius * 4, enemy.radius * 4);
                ctx.restore();
            }

            ctx.restore(); // Restaura transformação matricial

            // ─── 5. EMISSÃO SUTIL DE PARTÍCULAS AMBIENTAIS ───
            this._emitAmbientParticles(enemy, family, tier, ex, ey, isMoving);

            // ─── 6. BARRA DE VIDA GÓTICA DO BASTIÃO ───
            this._drawHealthBar(ctx, enemy, ex, ey, scaleMult, tier, isBoss);
        }

        /**
         * Resolve a família do monstro a partir do arquétipo ou nome
         */
        static _resolveFamilyFromEnemy(enemy) {
            const arch = (enemy.archetype || '').toLowerCase();
            const name = (enemy.name || '').toLowerCase();

            if (arch === 'crawler' || name.includes('rastejante') || name.includes('vácuo') || name.includes('void')) {
                return ENEMY_FAMILIES.VOID_SPAWN;
            }
            if (arch === 'phlebotomist' || name.includes('flebotomista') || name.includes('esfolado') || name.includes('flayed')) {
                return ENEMY_FAMILIES.THE_FLAYED;
            }
            if (arch === 'automaton' || name.includes('autômato') || name.includes('cinza') || name.includes('coven')) {
                return ENEMY_FAMILIES.ASHEN_COVEN;
            }
            if (name.includes('peste') || name.includes('hound') || name.includes('cão') || name.includes('brood')) {
                return ENEMY_FAMILIES.BLIGHTED_BROOD;
            }
            return ENEMY_FAMILIES.THE_FLAYED;
        }

        /**
         * Resolve o tier de perigo a partir das flags da entidade
         */
        static _resolveTierFromEnemy(enemy) {
            if (enemy.isBoss || enemy.archetype === 'boss') return VARIANT_TIERS.BOSS;
            if (enemy.isChampion) return VARIANT_TIERS.CHAMPION;
            if (enemy.isElite) return VARIANT_TIERS.ELITE;
            if (enemy.isVeteran) return VARIANT_TIERS.VETERAN;
            return VARIANT_TIERS.COMMON;
        }

        // ═══════════════════════════════════════════════════════════
        //  SOMBRA E AURAS DE CHÃO
        // ═══════════════════════════════════════════════════════════

        static _drawShadow(ctx, ex, ey, radius, scale) {
            ctx.save();
            ctx.beginPath();
            const rx = radius * 1.15 * scale;
            const ry = radius * 0.45 * scale;
            ctx.ellipse(ex, ey + (radius * 0.65 * scale), rx, ry, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(5, 4, 6, 0.68)';
            ctx.fill();
            ctx.restore();
        }

        static _drawGroundAura(ctx, ex, ey, tier, isBoss, phase, now) {
            ctx.save();
            const pulse = Math.sin(now / 350) * 0.15 + 0.85;

            if (isBoss) {
                // Aura monumental de brasa e sangue do chefe
                const bossR = (phase === 2 ? 65 : 52) * pulse;
                ctx.beginPath();
                ctx.arc(ex, ey, bossR, 0, Math.PI * 2);
                ctx.strokeStyle = phase === 2 ? 'rgba(223, 84, 24, 0.75)' : 'rgba(139, 28, 28, 0.6)';
                ctx.lineWidth = phase === 2 ? 3 : 2;
                ctx.setLineDash([8, 6]);
                ctx.stroke();
                ctx.setLineDash([]);

                // Fagulhas e runas concêntricas
                const rot = (now / 2500) % (Math.PI * 2);
                ctx.save();
                ctx.translate(ex, ey);
                ctx.rotate(rot);
                ctx.beginPath();
                ctx.arc(0, 0, bossR - 10, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(78, 17, 17, 0.4)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();

            } else if (tier === VARIANT_TIERS.CHAMPION) {
                // Aura circular rúnica de Campeão
                const auraR = 30 * pulse;
                ctx.beginPath();
                ctx.arc(ex, ey, auraR, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(197, 160, 89, 0.55)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.restore();
        }

        // ═══════════════════════════════════════════════════════════
        //  ADEREÇOS DE DORSO (ELITE & CAMPEÃO)
        // ═══════════════════════════════════════════════════════════

        static _drawDorsalAccessories(ctx, family, tier, now) {
            if (tier !== VARIANT_TIERS.ELITE && tier !== VARIANT_TIERS.CHAMPION) return;

            ctx.save();

            if (tier === VARIANT_TIERS.ELITE) {
                // Espigões ósseos e pontas de ferro brotando das costas
                ctx.fillStyle = PALETTE.STRUCT_BONE;
                ctx.strokeStyle = PALETTE.DOMINANT_DARK;
                ctx.lineWidth = 1;

                // Espigão Esquerdo
                ctx.beginPath();
                ctx.moveTo(-7, -10);
                ctx.lineTo(-14, -24);
                ctx.lineTo(-4, -13);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Espigão Direito
                ctx.beginPath();
                ctx.moveTo(7, -10);
                ctx.lineTo(14, -24);
                ctx.lineTo(4, -13);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Correntes soltas arrastando
                ctx.strokeStyle = PALETTE.DOMINANT_IRON;
                ctx.lineWidth = 1.5;
                const swayL = Math.sin(now / 300) * 3;
                const swayR = Math.cos(now / 300) * 3;
                ctx.beginPath();
                ctx.moveTo(-6, -6);
                ctx.quadraticCurveTo(-10, 4, -8 + swayL, 12);
                ctx.moveTo(6, -6);
                ctx.quadraticCurveTo(10, 4, 8 + swayR, 12);
                ctx.stroke();

            } else if (tier === VARIANT_TIERS.CHAMPION) {
                // Estandarte ou crucifixo de ferro nodular cravado nas costas
                ctx.strokeStyle = PALETTE.DOMINANT_IRON;
                ctx.lineWidth = 2.5;

                // Haste vertical
                ctx.beginPath();
                ctx.moveTo(0, -5);
                ctx.lineTo(0, -38);
                ctx.stroke();

                // Braço horizontal do crucifixo
                ctx.beginPath();
                ctx.moveTo(-10, -28);
                ctx.lineTo(10, -28);
                ctx.stroke();

                // Trapos de estandarte desfiados pendurados
                const flap = Math.sin(now / 200) * 4;
                ctx.fillStyle = PALETTE.VITAL_DRIED_BLOOD;
                ctx.beginPath();
                ctx.moveTo(-8, -26);
                ctx.lineTo(8, -26);
                ctx.lineTo(4 + flap, -8);
                ctx.lineTo(-6 + flap, -8);
                ctx.closePath();
                ctx.fill();

                // Runa de latão oxidado na haste
                ctx.fillStyle = PALETTE.GOLD_INCANDESCENT;
                ctx.beginPath();
                ctx.arc(0, -38, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }

        // ═══════════════════════════════════════════════════════════
        //  FAMÍLIA I: OS ESFOLADOS (THE FLAYED PENITENTS)
        // ═══════════════════════════════════════════════════════════
        /**
         * Fibras musculares vermelhas expostas (#541212), hastes de ferro
         * parafusadas, grampos cirúrgicos (#C0C0C8), postura espasmódica.
         */
        static _drawTheFlayed(ctx, enemy, tier, isFacingNorth, bob, sway, now) {
            const twitch = (Math.random() < 0.08) ? (Math.random() - 0.5) * 3 : 0;

            // 1. Pernas esqueléticas com ligaduras e hastes de ferro
            ctx.fillStyle = PALETTE.VITAL_EXPOSED_FLESH;
            ctx.strokeStyle = PALETTE.DOMINANT_DARK;
            ctx.lineWidth = 1;

            // Perna Esquerda
            ctx.beginPath();
            ctx.rect(-8 + sway * 0.5, 4, 5, 14);
            ctx.fill();
            ctx.stroke();

            // Perna Direita
            ctx.beginPath();
            ctx.rect(3 - sway * 0.5, 4, 5, 14);
            ctx.fill();
            ctx.stroke();

            // Hastes de ferro aparafusadas ao osso
            ctx.strokeStyle = PALETTE.DOMINANT_IRON;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, 4); ctx.lineTo(-10, 18);
            ctx.moveTo(10, 4);  ctx.lineTo(10, 18);
            ctx.stroke();

            // Parafusos prateados nas hastes
            ctx.fillStyle = PALETTE.IRON_STAPLE;
            ctx.fillRect(-11, 6, 2, 2);
            ctx.fillRect(-11, 14, 2, 2);
            ctx.fillRect(9, 6, 2, 2);
            ctx.fillRect(9, 14, 2, 2);

            // 2. Torso de Músculo Exposto e Costelas
            ctx.fillStyle = PALETTE.VITAL_EXPOSED_FLESH;
            ctx.beginPath();
            ctx.moveTo(-10 + twitch, -14 + bob);
            ctx.lineTo(10 + twitch, -14 + bob);
            ctx.lineTo(8, 4);
            ctx.lineTo(-8, 4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Fibras musculares secas e estrias escuras
            ctx.strokeStyle = PALETTE.VITAL_DRIED_BLOOD;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-6, -10 + bob); ctx.lineTo(-4, 2);
            ctx.moveTo(0, -12 + bob);  ctx.lineTo(0, 3);
            ctx.moveTo(6, -10 + bob);  ctx.lineTo(4, 2);
            ctx.stroke();

            // Grampos cirúrgicos brilhantes (#C0C0C8) fechando feridas
            ctx.strokeStyle = PALETTE.IRON_STAPLE;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(-5, -6 + bob); ctx.lineTo(-1, -6 + bob);
            ctx.moveTo(2, -3 + bob);  ctx.lineTo(6, -3 + bob);
            ctx.moveTo(-4, 0 + bob);  ctx.lineTo(1, 0 + bob);
            ctx.stroke();

            // 3. Cabeça Esfolada com Máscara de Ferro ou Venda Rústica
            ctx.fillStyle = PALETTE.VITAL_EXPOSED_FLESH;
            ctx.beginPath();
            ctx.ellipse(0 + twitch, -22 + bob, 7, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            if (isFacingNorth) {
                // Costuras na nuca
                ctx.strokeStyle = PALETTE.DOMINANT_DARK;
                ctx.beginPath();
                ctx.moveTo(0, -28 + bob);
                ctx.lineTo(0, -16 + bob);
                ctx.stroke();
            } else {
                // Máscara cirúrgica de ferro batido perfurada
                ctx.fillStyle = PALETTE.DOMINANT_IRON;
                ctx.fillRect(-5, -24 + bob, 10, 6);
                ctx.strokeStyle = PALETTE.DOMINANT_DARK;
                ctx.strokeRect(-5, -24 + bob, 10, 6);

                // Orifícios oculares com fagulhas de loucura
                ctx.fillStyle = (tier === VARIANT_TIERS.ELITE || tier === VARIANT_TIERS.CHAMPION) ? PALETTE.ARCANE_EMBER : '#ffffff';
                ctx.fillRect(-3, -22 + bob, 2, 2);
                ctx.fillRect(2, -22 + bob, 2, 2);
            }

            // 4. Braços e Armamento (Cutelo Pesado ou Foice Curva)
            ctx.save();
            ctx.translate(10, -10 + bob);
            ctx.rotate(0.35 + (enemy.state === 'STATE_ATTACK' ? -0.8 : 0));

            // Braço esfolado
            ctx.fillStyle = PALETTE.VITAL_EXPOSED_FLESH;
            ctx.fillRect(0, 0, 5, 12);
            ctx.strokeRect(0, 0, 5, 12);

            // Cutelo de ossuário dentado e oxidado
            ctx.fillStyle = PALETTE.DOMINANT_IRON;
            ctx.beginPath();
            ctx.moveTo(2, 10);
            ctx.lineTo(16, 12);
            ctx.lineTo(14, 26);
            ctx.lineTo(2, 22);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = PALETTE.STRUCT_BRASS;
            ctx.stroke();

            // Fio com sangue ressecado
            ctx.strokeStyle = PALETTE.VITAL_CRIMSON;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(16, 12);
            ctx.lineTo(14, 26);
            ctx.stroke();

            ctx.restore();
        }

        // ═══════════════════════════════════════════════════════════
        //  FAMÍLIA II: A CONGREGAÇÃO DAS CINZAS (THE ASHEN COVEN)
        // ═══════════════════════════════════════════════════════════
        /**
         * Cerâmica/gesso fúnebre cinza rachado (#373435), juntas de fuligem
         * vertendo fumaça, brasas internas (#D84315), postura monolítica.
         */
        static _drawAshenCoven(ctx, enemy, tier, isFacingNorth, bob, sway, now) {
            // 1. Pernas de estátua de cerâmica rachada
            ctx.fillStyle = PALETTE.STRUCT_CERAMIC;
            ctx.strokeStyle = PALETTE.DOMINANT_DARK;
            ctx.lineWidth = 1.2;

            ctx.beginPath();
            ctx.rect(-9, 5, 7, 13);
            ctx.rect(2, 5, 7, 13);
            ctx.fill();
            ctx.stroke();

            // 2. Torso Monolítico Rígido
            ctx.fillStyle = PALETTE.STRUCT_CERAMIC;
            ctx.beginPath();
            ctx.moveTo(-13, -15 + bob);
            ctx.lineTo(13, -15 + bob);
            ctx.lineTo(10, 5);
            ctx.lineTo(-10, 5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Fissuras profundas emitindo brilho de brasa viva (#D84315)
            const emberPulse = Math.sin(now / 250) * 0.2 + 0.8;
            ctx.strokeStyle = PALETTE.ARCANE_EMBER_CORE;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = PALETTE.ARCANE_EMBER;
            ctx.shadowBlur = 6 * emberPulse;

            ctx.beginPath();
            ctx.moveTo(-6, -11 + bob);
            ctx.lineTo(-2, -3 + bob);
            ctx.lineTo(4, 0 + bob);
            ctx.moveTo(5, -12 + bob);
            ctx.lineTo(2, -7 + bob);
            ctx.stroke();

            ctx.shadowBlur = 0; // Desativa glow

            // Juntas de fuligem nas axilas e cintura
            ctx.fillStyle = PALETTE.DOMINANT_DARK;
            ctx.beginPath();
            ctx.arc(-11, -12 + bob, 3, 0, Math.PI * 2);
            ctx.arc(11, -12 + bob, 3, 0, Math.PI * 2);
            ctx.fill();

            // 3. Cabeça de Ícone Fúnebre Monástico
            ctx.fillStyle = PALETTE.STRUCT_CERAMIC;
            ctx.beginPath();
            ctx.ellipse(0, -23 + bob, 8, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = PALETTE.DOMINANT_DARK;
            ctx.stroke();

            if (!isFacingNorth) {
                // Olhos e boca ocos como fendas de fornalha
                ctx.fillStyle = PALETTE.ARCANE_EMBER;
                ctx.fillRect(-4, -24 + bob, 2.5, 2.5);
                ctx.fillRect(2, -24 + bob, 2.5, 2.5);
                ctx.fillRect(-2, -18 + bob, 4, 1.5);
            }

            // 4. Cruz Monumental de Ferro Fundido Fundida ao Braço
            ctx.save();
            ctx.translate(13, -8 + bob);
            const slamAngle = enemy.slamTelegraph ? 0.9 : 0.2;
            ctx.rotate(slamAngle);

            // Braço pétreo
            ctx.fillStyle = PALETTE.STRUCT_CERAMIC;
            ctx.fillRect(0, 0, 6, 14);
            ctx.strokeRect(0, 0, 6, 14);

            // Cruz de Ferro
            ctx.fillStyle = PALETTE.DOMINANT_IRON;
            ctx.strokeStyle = PALETTE.DOMINANT_DARK;
            ctx.lineWidth = 1.2;

            // Haste longa
            ctx.fillRect(1, -18, 5, 38);
            ctx.strokeRect(1, -18, 5, 38);
            // Braço transversal
            ctx.fillRect(-7, -8, 21, 5);
            ctx.strokeRect(-7, -8, 21, 5);

            ctx.restore();
        }

        // ═══════════════════════════════════════════════════════════
        //  FAMÍLIA III: AS CRIAS DO VÁCUO (THE VOID SPAWN)
        // ═══════════════════════════════════════════════════════════
        /**
         * Carapaça quitinosa preta polida (#080709), membranas violeta profundo
         * (#311B92), olhos sem pálpebras piscando (#B388FF), pernas de agulha.
         */
        static _drawVoidSpawn(ctx, enemy, tier, isFacingNorth, bob, sway, now) {
            // Efeito de tremor/distorção de refração nas bordas
            const jitterX = (Math.sin(now / 80) * 0.8);
            const jitterY = (Math.cos(now / 90) * 0.8);

            // 1. Pernas de Agulha Aracnídeas Articuladas (6 a 8 patas)
            ctx.strokeStyle = PALETTE.DOMINANT_DARK;
            ctx.lineWidth = 1.8;

            const legPhase = (now / 150);
            for (let i = 0; i < 3; i++) {
                const offY = (i * 6) - 4;
                const legAnimL = Math.sin(legPhase + i * 1.5) * 4;
                const legAnimR = Math.cos(legPhase + i * 1.5) * 4;

                // Pata Esquerda
                ctx.beginPath();
                ctx.moveTo(-8, offY + bob);
                ctx.lineTo(-18, offY - 4 + legAnimL + bob);
                ctx.lineTo(-22, offY + 12 + legAnimL);
                ctx.stroke();

                // Pata Direita
                ctx.beginPath();
                ctx.moveTo(8, offY + bob);
                ctx.lineTo(18, offY - 4 + legAnimR + bob);
                ctx.lineTo(22, offY + 12 + legAnimR);
                ctx.stroke();
            }

            // 2. Abdômen / Membrana Gelatinosa Translúcida Violeta
            ctx.fillStyle = PALETTE.ARCANE_VOID_MEMBR;
            ctx.beginPath();
            ctx.ellipse(0, 6 + bob, 11 + jitterX, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = PALETTE.ARCANE_VOID;
            ctx.stroke();

            // 3. Carapaça Quitinosa Segmentada de Obsidiana
            ctx.fillStyle = PALETTE.DOMINANT_DARK;
            ctx.strokeStyle = PALETTE.ARCANE_VOID_DARK;
            ctx.lineWidth = 1.2;

            // Placa cefalotorácica
            ctx.beginPath();
            ctx.moveTo(-11, -14 + bob);
            ctx.lineTo(11, -14 + bob);
            ctx.lineTo(9, 2 + bob);
            ctx.lineTo(-9, 2 + bob);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Placa triangular frontal
            ctx.beginPath();
            ctx.moveTo(-8, -14 + bob);
            ctx.lineTo(8, -14 + bob);
            ctx.lineTo(0, -22 + bob);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 4. Aglomerado de Olhos sem Pálpebras (Blinking assíncrono)
            if (!isFacingNorth) {
                const eyePulse1 = (Math.sin(now / 400) > 0.1) ? 1 : 0;
                const eyePulse2 = (Math.sin(now / 300 + 1.2) > 0.2) ? 1 : 0;
                const eyePulse3 = (Math.sin(now / 500 + 2.4) > 0.0) ? 1 : 0;

                ctx.fillStyle = PALETTE.ARCANE_VOID_BRIGHT;
                if (eyePulse1) {
                    ctx.beginPath(); ctx.arc(-4, -18 + bob, 1.8, 0, Math.PI * 2); ctx.fill();
                }
                if (eyePulse2) {
                    ctx.beginPath(); ctx.arc(4, -18 + bob, 1.8, 0, Math.PI * 2); ctx.fill();
                }
                if (eyePulse3) {
                    ctx.beginPath(); ctx.arc(0, -20 + bob, 1.4, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(-2, -15 + bob, 1.2, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(3, -15 + bob, 1.2, 0, Math.PI * 2); ctx.fill();
                }
            }
        }

        // ═══════════════════════════════════════════════════════════
        //  FAMÍLIA IV: AS BESTAS DA PESTE (THE BLIGHTED BROOD)
        // ═══════════════════════════════════════════════════════════
        /**
         * Quadrúpede baixo, corcunda, pelagem sarnenta (#3A342B), pústulas
         * amarelas pulsantes (#827717), presas hipertrofiadas, espinhas dorsais.
         */
        static _drawBlightedBrood(ctx, enemy, tier, isFacingNorth, bob, sway, now) {
            // 1. Quatro Patas Baixas Precatórias
            ctx.fillStyle = PALETTE.DOMINANT_DARK;
            ctx.strokeStyle = PALETTE.BLIGHT_FUR;
            ctx.lineWidth = 1;

            // Patas Traseiras
            ctx.fillRect(-11, 4, 5, 10);
            ctx.fillRect(7, 4, 5, 10);

            // Patas Dianteiras
            ctx.fillRect(-8 + sway, 8, 4, 9);
            ctx.fillRect(4 - sway, 8, 4, 9);

            // 2. Dorso Corcunda com Pelagem Sarnenta
            ctx.fillStyle = PALETTE.BLIGHT_FUR;
            ctx.strokeStyle = PALETTE.DOMINANT_DARK;
            ctx.lineWidth = 1.2;

            ctx.beginPath();
            ctx.ellipse(0, 0 + bob, 14, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Espinhas dorsais pontiagudas rasgando a carne
            ctx.fillStyle = PALETTE.STRUCT_BONE;
            for (let i = -8; i <= 8; i += 4) {
                ctx.beginPath();
                ctx.moveTo(i - 2, -6 + bob);
                ctx.lineTo(i, -14 + bob);
                ctx.lineTo(i + 2, -6 + bob);
                ctx.closePath();
                ctx.fill();
            }

            // Pústulas e bubões amarelos pulsantes (#827717)
            const pustulePulse = Math.sin(now / 300) * 0.8 + 2.5;
            ctx.fillStyle = PALETTE.BLIGHT_PUSTULE;
            ctx.strokeStyle = PALETTE.BLIGHT_BILE;
            ctx.lineWidth = 0.8;

            ctx.beginPath();
            ctx.arc(-6, -2 + bob, pustulePulse, 0, Math.PI * 2);
            ctx.arc(5, 2 + bob, pustulePulse * 0.8, 0, Math.PI * 2);
            ctx.arc(2, -4 + bob, pustulePulse * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 3. Cabeça Bestial com Mandíbula Hipertrofiada
            ctx.fillStyle = PALETTE.DOMINANT_CHARCOAL;
            ctx.beginPath();
            ctx.ellipse(0, -12 + bob, 8, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            if (!isFacingNorth) {
                // Presas pontiagudas rasgando a bochecha para fora
                ctx.fillStyle = PALETTE.STRUCT_BONE;
                ctx.beginPath();
                ctx.moveTo(-6, -11 + bob); ctx.lineTo(-10, -17 + bob); ctx.lineTo(-4, -13 + bob);
                ctx.moveTo(6, -11 + bob);  ctx.lineTo(10, -17 + bob);  ctx.lineTo(4, -13 + bob);
                ctx.fill();

                // Olhos doentios vidrados
                ctx.fillStyle = PALETTE.BLIGHT_BILE;
                ctx.fillRect(-4, -14 + bob, 2, 2);
                ctx.fillRect(2, -14 + bob, 2, 2);
            }
        }

        // ═══════════════════════════════════════════════════════════
        //  ETAPA 8: OS TRÊS PRIMEIROS CHEFES
        // ═══════════════════════════════════════════════════════════

        static _drawBoss(ctx, boss, isFacingNorth, bob, sway, now, dt) {
            const bossType = boss.bossType || 'iron_executioner';

            switch (bossType) {
                case 'blind_weft_matriarch':
                    this._drawBlindWeftMatriarch(ctx, boss, isFacingNorth, bob, sway, now);
                    break;
                case 'shattered_gazer':
                    this._drawShatteredGazer(ctx, boss, isFacingNorth, bob, sway, now);
                    break;
                case 'iron_executioner':
                default:
                    this._drawIronExecutioner(ctx, boss, isFacingNorth, bob, sway, now);
                    break;
            }
        }

        /**
         * Chefe 1: O Carrasco de Ferro Negro (The Ironbound Executioner)
         * Escala 3x, Sino Fúnebre como elmo, fornalha corpórea com fogo real,
         * cutelo guilhotina de 2m, Fase 2: fornalha aberta e postura de carga.
         */
        static _drawIronExecutioner(ctx, boss, isFacingNorth, bob, sway, now) {
            const isPhase2 = (boss.phase === 2) || (boss.hp <= boss.maxHp * 0.5);
            const isCharging = boss.isCharging || false;

            // 1. Pernas de Ferro Fundido Nodular Maciças
            ctx.fillStyle = PALETTE.DOMINANT_IRON;
            ctx.strokeStyle = PALETTE.DOMINANT_DARK;
            ctx.lineWidth = 2.5;

            // Grevas de chapas sobrepostas
            ctx.beginPath();
            ctx.rect(-16, 8, 12, 22);
            ctx.rect(4, 8, 12, 22);
            ctx.fill();
            ctx.stroke();

            // 2. Peitoral / Fornalha Corpórea de Ferro Fundido
            ctx.fillStyle = PALETTE.DOMINANT_CHARCOAL;
            ctx.beginPath();
            ctx.rect(-24, -26 + bob, 48, 36);
            ctx.fill();
            ctx.stroke();

            // Ombreiras brutais gigantescas (Trapézio descendente)
            ctx.fillStyle = PALETTE.DOMINANT_IRON;
            ctx.fillRect(-32, -32 + bob, 14, 20);
            ctx.strokeRect(-32, -32 + bob, 14, 20);
            ctx.fillRect(18, -32 + bob, 14, 20);
            ctx.strokeRect(18, -32 + bob, 14, 20);

            // Grade da Fornalha no Peito
            if (!isFacingNorth) {
                const firePulse = Math.sin(now / 150) * 0.2 + 0.8;

                if (!isPhase2) {
                    // Fase 1: Grade de ferro fechada com fogo vivo pulsando
                    ctx.fillStyle = PALETTE.ARCANE_EMBER_CORE;
                    ctx.shadowColor = PALETTE.ARCANE_EMBER;
                    ctx.shadowBlur = 14 * firePulse;
                    ctx.fillRect(-12, -18 + bob, 24, 18);
                    ctx.shadowBlur = 0;

                    // Barras de ferro da grade
                    ctx.strokeStyle = PALETTE.DOMINANT_IRON;
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    for (let bx = -9; bx <= 9; bx += 6) {
                        ctx.moveTo(bx, -18 + bob);
                        ctx.lineTo(bx, 0 + bob);
                    }
                    ctx.stroke();

                } else {
                    // Fase 2: Fornalha arrebentada escancarada vomitando lava e chamas
                    ctx.fillStyle = PALETTE.ARCANE_EMBER_HOT;
                    ctx.shadowColor = PALETTE.ARCANE_EMBER;
                    ctx.shadowBlur = 24 * firePulse;
                    ctx.beginPath();
                    ctx.ellipse(0, -9 + bob, 16, 12, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;

                    // Correntes arrebentadas penduradas
                    ctx.strokeStyle = PALETTE.DOMINANT_IRON;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(-16, -10 + bob); ctx.lineTo(-24, 6 + bob);
                    ctx.moveTo(16, -10 + bob);  ctx.lineTo(24, 6 + bob);
                    ctx.stroke();
                }
            }

            // 3. Cabeça: SINO FÚNEBRE DE BRONZE ENEGRECIDO
            ctx.fillStyle = PALETTE.OXIDIZED_BRONZE;
            ctx.strokeStyle = PALETTE.DOMINANT_DARK;
            ctx.lineWidth = 2;

            // Formato de sino gótico
            ctx.beginPath();
            ctx.moveTo(-10, -32 + bob);
            ctx.lineTo(10, -32 + bob);
            ctx.lineTo(14, -50 + bob);
            ctx.lineTo(-14, -50 + bob);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Borda larga inferior do sino com rebites
            ctx.fillStyle = PALETTE.STRUCT_BRASS;
            ctx.fillRect(-14, -34 + bob, 28, 5);
            ctx.strokeRect(-14, -34 + bob, 28, 5);

            // Anel superior de montagem e parafusos
            ctx.strokeStyle = PALETTE.DOMINANT_IRON;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, -52 + bob, 5, 0, Math.PI * 2);
            ctx.stroke();

            // 4. Armamento: CUTELO DE GUILHOTINA COLOSSAL DE 2 METROS
            ctx.save();
            ctx.translate(26, -12 + bob);

            // Rotação de ataque / arrasto no chão
            const isAttacking = boss.state === 'STATE_ATTACK' || isCharging;
            const bladeAngle = isAttacking ? 0.75 : 0.25;
            ctx.rotate(bladeAngle);

            // Braço de ferro fundido com manopla
            ctx.fillStyle = PALETTE.DOMINANT_IRON;
            ctx.fillRect(-3, 0, 10, 24);
            ctx.strokeRect(-3, 0, 10, 24);

            // Cabo de ferro forjado
            ctx.strokeStyle = PALETTE.DOMINANT_DARK;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(2, 10);
            ctx.lineTo(2, 42);
            ctx.stroke();

            // Lâmina-Bloco de Guilhotina (Slab Blade)
            ctx.fillStyle = PALETTE.DOMINANT_IRON;
            ctx.beginPath();
            ctx.moveTo(-6, 36);
            ctx.lineTo(24, 38);
            ctx.lineTo(20, 78);
            ctx.lineTo(-6, 72);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = PALETTE.STRUCT_BRASS;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Fio de corte com dentes e desgaste mecânico
            ctx.strokeStyle = '#e0d8c8';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(24, 38);
            ctx.lineTo(20, 78);
            ctx.stroke();

            // Sulco sangrento de fuligem no centro da lâmina
            ctx.strokeStyle = PALETTE.VITAL_DRIED_BLOOD;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(8, 44);
            ctx.lineTo(6, 68);
            ctx.stroke();

            ctx.restore();
        }

        /**
         * Chefe 2: A Matriarca dos Tecidos Cegos (The Blind Weft Matriarch)
         * Tronco esguio em hábito fúnebre, 8 fusos de tear de osso/ferro,
         * máscara de cera preta, fios de aço e serras circulares na Fase 2.
         */
        static _drawBlindWeftMatriarch(ctx, boss, isFacingNorth, bob, sway, now) {
            const isPhase2 = (boss.phase === 2) || (boss.hp <= boss.maxHp * 0.4);

            // 1. Oito Fusos de Tear Articulados (Spindles) sustentando-a no ar
            ctx.strokeStyle = PALETTE.DOMINANT_IRON;
            ctx.lineWidth = 2.5;

            const spindleLegCount = 4; // 4 de cada lado
            for (let i = 0; i < spindleLegCount; i++) {
                const angleOffset = (i * 0.35) - 0.55;
                const animSpeed = isPhase2 ? 18 : 6;
                const spindleWave = Math.sin((now / 1000) * animSpeed + i * 1.2) * 8;

                // Lado Esquerdo
                ctx.beginPath();
                ctx.moveTo(-12, -18 + bob);
                ctx.lineTo(-32 - i * 6, -28 + angleOffset * 20 + spindleWave);
                ctx.lineTo(-42 - i * 8, 16 + spindleWave);
                ctx.stroke();

                // Ponta de agulha afiada de osso
                ctx.fillStyle = PALETTE.STRUCT_BONE;
                ctx.fillRect(-44 - i * 8, 14 + spindleWave, 4, 8);

                // Lado Direito
                ctx.beginPath();
                ctx.moveTo(12, -18 + bob);
                ctx.lineTo(32 + i * 6, -28 + angleOffset * 20 - spindleWave);
                ctx.lineTo(42 + i * 8, 16 - spindleWave);
                ctx.stroke();

                ctx.fillRect(40 + i * 8, 14 - spindleWave, 4, 8);
            }

            // 2. Cauda Longa e Hábito de Veludo Apodrecido
            ctx.fillStyle = '#1A1016';
            ctx.strokeStyle = PALETTE.DOMINANT_DARK;
            ctx.lineWidth = 1.5;

            ctx.beginPath();
            ctx.moveTo(-10, -18 + bob);
            ctx.lineTo(10, -18 + bob);
            ctx.lineTo(16, 26);
            ctx.lineTo(-16, 26);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 3. Tronco Humano Feminino Esguio
            ctx.fillStyle = '#2A1820';
            ctx.beginPath();
            ctx.moveTo(-8, -32 + bob);
            ctx.lineTo(8, -32 + bob);
            ctx.lineTo(6, -18 + bob);
            ctx.lineTo(-6, -18 + bob);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 4. Cabeça: Máscara de Cera de Abelha Preta e Coroa de Espinhos
            ctx.fillStyle = PALETTE.DOMINANT_DARK;
            ctx.beginPath();
            ctx.ellipse(0, -42 + bob, 7, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            if (!isPhase2) {
                // Máscara lisa com coroa de espinhos
                ctx.strokeStyle = PALETTE.DOMINANT_IRON;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(0, -48 + bob, 9, Math.PI * 0.8, Math.PI * 2.2);
                ctx.stroke();
            } else {
                // Fase 2: Máscara arrancada com poços de alcatrão do Vácuo
                ctx.fillStyle = PALETTE.ARCANE_VOID_BRIGHT;
                for (let ey = -46; ey <= -38; ey += 4) {
                    ctx.fillRect(-3, ey + bob, 2, 2);
                    ctx.fillRect(2, ey + bob, 2, 2);
                }
            }
        }

        /**
         * Chefe 3: O Observador da Fenda Estilhaçada (The Shattered Gazer)
         * Monólito vertical flutuante de obsidiana, fenda ultravioleta pulsante,
         * 7 lâminas orbitais de vidro escuro. Fase 2: fragmentação trina.
         */
        static _drawShatteredGazer(ctx, boss, isFacingNorth, bob, sway, now) {
            const isPhase2 = (boss.phase === 2) || (boss.hp <= boss.maxHp * 0.6);
            const floatBob = Math.sin(now / 450) * 6;

            // 1. Auréola de 7 Lâminas Orbitais Voadoras de Vidro Escuro
            const bladeCount = 7;
            const orbitRadius = 48 + Math.sin(now / 350) * 4;
            const orbitSpeed = (now / 1200);

            for (let i = 0; i < bladeCount; i++) {
                const angle = orbitSpeed + (i * Math.PI * 2) / bladeCount;
                const bx = Math.cos(angle) * orbitRadius;
                const by = Math.sin(angle) * (orbitRadius * 0.45) + floatBob - 18;

                ctx.save();
                ctx.translate(bx, by);
                ctx.rotate(angle + Math.PI / 2);

                // Lâmina de vidro escuro afiada
                ctx.fillStyle = PALETTE.DOMINANT_DARK;
                ctx.strokeStyle = PALETTE.ARCANE_VOID_BRIGHT;
                ctx.lineWidth = 1.2;

                ctx.beginPath();
                ctx.moveTo(0, -14);
                ctx.lineTo(4, 4);
                ctx.lineTo(0, 14);
                ctx.lineTo(-4, 4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.restore();
            }

            // 2. Monólito Rúnico de Obsidiana Vertical
            ctx.save();
            ctx.translate(0, floatBob - 18);

            if (!isPhase2) {
                // Monólito Inteiro com Fenda Ultravioleta Central
                ctx.fillStyle = PALETTE.DOMINANT_DARK;
                ctx.strokeStyle = PALETTE.ARCANE_VOID;
                ctx.lineWidth = 2;

                ctx.beginPath();
                ctx.moveTo(-16, -42);
                ctx.lineTo(16, -42);
                ctx.lineTo(20, 24);
                ctx.lineTo(-20, 24);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Fenda central ultravioleta pulsante (#7B1FA2 / #B388FF)
                const voidPulse = Math.sin(now / 200) * 0.25 + 0.75;
                ctx.strokeStyle = PALETTE.ARCANE_VOID_BRIGHT;
                ctx.lineWidth = 2.5;
                ctx.shadowColor = PALETTE.ARCANE_VOID_EYE;
                ctx.shadowBlur = 18 * voidPulse;

                ctx.beginPath();
                ctx.moveTo(0, -38);
                ctx.lineTo(-2, -18);
                ctx.lineTo(2, 2);
                ctx.lineTo(0, 20);
                ctx.stroke();
                ctx.shadowBlur = 0;

            } else {
                // Fase 2: 3 Fragmentos Menores Orbitando Entre Si
                for (let f = 0; f < 3; f++) {
                    const fAngle = (now / 600) + (f * Math.PI * 2) / 3;
                    const fx = Math.cos(fAngle) * 16;
                    const fy = Math.sin(fAngle) * 12;

                    ctx.save();
                    ctx.translate(fx, fy);
                    ctx.fillStyle = PALETTE.DOMINANT_DARK;
                    ctx.strokeStyle = PALETTE.ARCANE_VOID_BRIGHT;
                    ctx.lineWidth = 1.8;
                    ctx.fillRect(-8, -12, 16, 24);
                    ctx.strokeRect(-8, -12, 16, 24);
                    ctx.restore();
                }
            }

            ctx.restore();
        }

        // ═══════════════════════════════════════════════════════════
        //  BARRA DE VIDA GÓTICA DO INIMIGO
        // ═══════════════════════════════════════════════════════════

        static _drawHealthBar(ctx, enemy, ex, ey, scale, tier, isBoss) {
            const maxHp = enemy.maxHp || 30;
            const hp = Math.max(0, Math.min(maxHp, enemy.hp || 0));
            const hpPct = hp / maxHp;

            // Obedece configuração de visibilidade de barra de vida
            const hpSetting = (window.SettingsManager ? window.SettingsManager.get('gameplay.enemyHealthBars', 'combat') : 'combat');
            if (hpSetting === 'hidden' && !isBoss) return;
            if (hpSetting === 'combat' && hpPct >= 0.999 && !isBoss && tier === VARIANT_TIERS.COMMON) return;

            const barW = isBoss ? 72 : (tier === VARIANT_TIERS.CHAMPION ? 44 : (tier === VARIANT_TIERS.ELITE ? 36 : 28));
            const barH = isBoss ? 5 : 4;
            const barX = ex - barW / 2;
            const barY = ey - (enemy.radius || 14) * scale - (isBoss ? 26 : 14);

            ctx.save();

            // 1. Fundo de Pedra Escura (#121113)
            ctx.fillStyle = '#121113';
            ctx.fillRect(barX, barY, barW, barH);

            // 2. Preenchimento de Sangue Oxidado (#8B1C1C)
            ctx.fillStyle = isBoss ? PALETTE.ARCANE_EMBER_CORE : PALETTE.VITAL_CRIMSON;
            ctx.fillRect(barX, barY, barW * hpPct, barH);

            // 3. Moldura de Ferro Oxidado
            ctx.strokeStyle = isBoss ? PALETTE.OXIDIZED_BRONZE : (tier === VARIANT_TIERS.CHAMPION ? PALETTE.GOLD_INCANDESCENT : '#2A2220');
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barW, barH);

            // 4. Nome / Título do Inimigo para Elites e Chefes
            if (isBoss || tier === VARIANT_TIERS.CHAMPION || tier === VARIANT_TIERS.ELITE) {
                ctx.font = (isBoss ? 'bold 10px' : '9px') + ' "Cinzel", serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = isBoss ? '#fca5a5' : (tier === VARIANT_TIERS.CHAMPION ? '#fceecb' : '#c5a059');
                ctx.shadowColor = '#000000';
                ctx.shadowBlur = 4;
                ctx.fillText(enemy.name || 'Monstro da Fenda', ex, barY - 4);
                ctx.shadowBlur = 0;
            }

            ctx.restore();
        }

        // ═══════════════════════════════════════════════════════════
        //  PARTÍCULAS AMBIENTAIS POR FAMÍLIA
        // ═══════════════════════════════════════════════════════════

        static _emitAmbientParticles(enemy, family, tier, ex, ey, isMoving) {
            const now = performance.now();
            if (enemy._lastEnemyParticleTick && (now - enemy._lastEnemyParticleTick) < 160) return;
            enemy._lastEnemyParticleTick = now;

            const engine = global.dungeonEngine;
            if (!engine || !engine.particles) return;

            // Congregação das Cinzas / Boss 1: cinzas e brasas caindo
            if ((family === ENEMY_FAMILIES.ASHEN_COVEN || enemy.isBoss) && Math.random() < 0.5) {
                engine.particles.push({
                    x: ex + (Math.random() - 0.5) * 16,
                    y: ey - 10,
                    vx: (Math.random() - 0.5) * 10,
                    vy: -Math.random() * 20 - 5,
                    lifetime: 0.5, maxLife: 0.5,
                    size: Math.random() * 2 + 1,
                    color: Math.random() < 0.4 ? PALETTE.ARCANE_EMBER : PALETTE.STRUCT_CERAMIC,
                    type: 'circle',
                });
            }
            // Crias do Vácuo: gotas de alcatrão que evaporam para cima
            else if (family === ENEMY_FAMILIES.VOID_SPAWN && Math.random() < 0.4) {
                engine.particles.push({
                    x: ex + (Math.random() - 0.5) * 14,
                    y: ey - 8,
                    vx: (Math.random() - 0.5) * 6,
                    vy: -Math.random() * 25 - 10,
                    lifetime: 0.55, maxLife: 0.55,
                    size: Math.random() * 2.5 + 1,
                    color: PALETTE.ARCANE_VOID_EYE,
                    type: 'circle',
                });
            }
            // Bestas da Peste: bile viscosa amarela gotejando
            else if (family === ENEMY_FAMILIES.BLIGHTED_BROOD && Math.random() < 0.3) {
                engine.particles.push({
                    x: ex + (Math.random() - 0.5) * 12,
                    y: ey + 4,
                    vx: (Math.random() - 0.5) * 4,
                    vy: Math.random() * 15 + 5,
                    lifetime: 0.4, maxLife: 0.4,
                    size: Math.random() * 2 + 1,
                    color: PALETTE.BLIGHT_PUSTULE,
                    type: 'circle',
                });
            }
        }
    }

    // Exportação Global
    global.ENEMY_FAMILIES = ENEMY_FAMILIES;
    global.VARIANT_TIERS = VARIANT_TIERS;
    global.EnemyVisualRenderer = EnemyVisualRenderer;

    console.log('[EnemyVisualRenderer] Loaded successfully: 4 Families, 5 Tiers & 3 Bosses.');

})(typeof window !== 'undefined' ? window : this);
