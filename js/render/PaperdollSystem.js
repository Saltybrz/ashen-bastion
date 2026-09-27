/**
 * ===================================================================
 *  IN SEARCH OF HOPE: THE ASHEN BASTION
 *  PaperdollSystem.js — Modular 2D Canvas Character Rig & Renderer
 *  Perspective: Top-Down Inclinada (15° a 20° de inclinação)
 *  Proporção: 1:6 (6 cabeças de altura, mãos e antebraços +20%)
 * ===================================================================
 */

(function(global) {
    'use strict';

    // ─── Tabela Canônica de Sockets (Caixa 96x96 px, Pivô X: 48, Y: 82) ───
    const SOCKETS = Object.freeze({
        HEAD:       { id: 'HEAD_SOCKET',       x: 48, y: 18 },
        SHOULDER_L: { id: 'SHOULDER_L',        x: 34, y: 30 },
        SHOULDER_R: { id: 'SHOULDER_R',        x: 62, y: 30 },
        CHEST:      { id: 'CHEST_SOCKET',      x: 48, y: 36 },
        MAIN_HAND:  { id: 'MAIN_HAND_SOCKET',  x: 26, y: 46 },
        OFF_HAND:   { id: 'OFF_HAND_SOCKET',   x: 70, y: 46 },
        PELVIS:     { id: 'PELVIS_SOCKET',     x: 48, y: 54 },
        FEET:       { id: 'FEET_SOCKET',       x: 48, y: 78 },
        BACK:       { id: 'BACK_SOCKET',       x: 48, y: 28 },
    });

    // ─── Paleta de Estilo Rigorosa (Bíblia de Estilo do Bastião) ───
    const PALETTE = Object.freeze({
        // Dominante (80%)
        DOMINANT_DARK:      '#09080A',
        DOMINANT_CHARCOAL:  '#141215',
        DOMINANT_IRON:      '#1F1C1F',
        // Estrutural (15%)
        STRUCT_BRASS:       '#4A3C28',
        STRUCT_LEATHER:     '#2D231E',
        STRUCT_BONE:        '#7D7569',
        // Acento Vital (3%)
        VITAL_DRIED_BLOOD:  '#4E1111',
        VITAL_CRIMSON:      '#8B1C1C',
        // Acento Arcano (2%)
        ARCANE_EMBER:       '#DF5418',
        ARCANE_EMBER_HOT:   '#FF8A65',
        ARCANE_EMERALD:     '#2B6E4E',
        ARCANE_VOID:        '#4B1E6D',
        ARCANE_VOID_BRIGHT: '#B388FF',
    });

    // ─── Configurações Visuais das 4 Ancestralidades (Lineages) ───
    const LINEAGE_VISUALS = Object.freeze({
        // 1. Filhos da Pira (Ashen-Born)
        children_of_pyre: {
            skinBase:       '#181517',
            skinShadow:     '#100E10',
            creaseGlow:     '#D84315',
            creaseGlowHot:  '#FF8A65',
            eyeGlow:        '#DF5418',
            ambientParticle:'ashes',
            description:    'Pele basáltica, veias de brasa viva nas dobras e olhos de fornalha.',
        },
        ashen_born: {
            skinBase:       '#181517',
            skinShadow:     '#100E10',
            creaseGlow:     '#D84315',
            creaseGlowHot:  '#FF8A65',
            eyeGlow:        '#DF5418',
            ambientParticle:'ashes',
        },

        // 2. Nobreza Decadente (Blighted Aristocracy)
        decaying_nobility: {
            skinBase:       '#D7D0C0',
            skinShadow:     '#B5ACA0',
            eyeBags:        '#2C222B',
            eyeIris:        '#581825',
            veins:          '#3F3239',
            chokerColor:    '#1B191E',
            ambientParticle:'dust',
            description:    'Palidez de cera envelhecida, olheiras profundas e veias arroxeadas.',
        },
        blighted_aristocracy: {
            skinBase:       '#D7D0C0',
            skinShadow:     '#B5ACA0',
            eyeBags:        '#2C222B',
            eyeIris:        '#581825',
            veins:          '#3F3239',
            chokerColor:    '#1B191E',
            ambientParticle:'dust',
        },

        // 3. Marcados pelo Vácuo (Void-Scars)
        void_touched: {
            skinBase:       '#221E28',
            skinShadow:     '#15121A',
            chitinPlate:    '#0D0B12',
            voidEye:        '#7B1FA2',
            voidGlow:       '#B388FF',
            ambientParticle:'void_drops',
            description:    'Pele ardósia com placas quitinosas de obsidiana e luz violeta fraturada.',
        },
        void_scars: {
            skinBase:       '#221E28',
            skinShadow:     '#15121A',
            chitinPlate:    '#0D0B12',
            voidEye:        '#7B1FA2',
            voidGlow:       '#B388FF',
            ambientParticle:'void_drops',
        },

        // 4. Autômato Esfolado (Flayed Automaton)
        flayed_automaton: {
            skinBase:       '#3E2723',
            skinStitch:     '#5D4037',
            metalPlate:     '#455A64',
            stapleColor:    '#B0BEC5',
            lensBrass:      '#C5A059',
            lensAmber:      '#FFB300',
            ambientParticle:'steam',
            description:    'Retalhos de couro costurados a arame, placas de caldeira e olho óptico âmbar.',
        },
    });

    // ─── Configurações Visuais das 4 Classes Iniciais ───
    const CLASS_VISUALS = Object.freeze({
        // 1. Guerreiro da Cinza / Bárbaro (Ashen Warmaster)
        barbarian: {
            id:             'ashen_warmaster',
            name:           'Guerreiro da Cinza',
            silhouette:     'trapezoidal',
            armorWeight:    'heavy',
            pauldronLeftScale: 1.45,  // Garde-faute hiperdimensionado à esquerda
            pauldronRightScale: 1.0,
            helmType:       'beak_visor',
            weaponType:     'slab_greatsword',
            pauldronColor:  '#2a2422',
            plateColor:     '#1b1819',
            accentColor:    '#d84315',
        },
        ashen_warmaster: {
            id:             'ashen_warmaster',
            name:           'Guerreiro da Cinza',
            silhouette:     'trapezoidal',
            armorWeight:    'heavy',
            pauldronLeftScale: 1.45,
            pauldronRightScale: 1.0,
            helmType:       'beak_visor',
            weaponType:     'slab_greatsword',
            pauldronColor:  '#2a2422',
            plateColor:     '#1b1819',
            accentColor:    '#d84315',
        },

        // 2. Flagelante das Sombras / Necromante (Penitent Stalker)
        necromancer: {
            id:             'penitent_stalker',
            name:           'Flagelante das Sombras',
            silhouette:     'triangular',
            armorWeight:    'light_agile',
            helmType:       'pointed_cowl',
            weaponType:     'flensing_scythe',
            waistChain:     true,
            jerkinColor:    '#251d20',
            accentColor:    '#8b1c1c',
        },
        penitent_stalker: {
            id:             'penitent_stalker',
            name:           'Flagelante das Sombras',
            silhouette:     'triangular',
            armorWeight:    'light_agile',
            helmType:       'pointed_cowl',
            weaponType:     'flensing_scythe',
            waistChain:     true,
            jerkinColor:    '#251d20',
            accentColor:    '#8b1c1c',
        },

        // 3. Hierofante da Pira / Paladino (Pyre Hierophant)
        paladin: {
            id:             'pyre_hierophant',
            name:           'Hierofante da Pira',
            silhouette:     'vertical_monolith',
            armorWeight:    'liturgical',
            helmType:       'rigid_mitre',
            weaponType:     'censer_mace',
            vestmentColor:  '#3d1a24', // Vinho eclesiástico manchado de cera
            brassBreastplate:'#4a3c28',
            accentColor:    '#ffa000',
        },
        pyre_hierophant: {
            id:             'pyre_hierophant',
            name:           'Hierofante da Pira',
            silhouette:     'vertical_monolith',
            armorWeight:    'liturgical',
            helmType:       'rigid_mitre',
            weaponType:     'censer_mace',
            vestmentColor:  '#3d1a24',
            brassBreastplate:'#4a3c28',
            accentColor:    '#ffa000',
        },

        // 4. Herege do Vácuo / Feiticeiro (Void Heretic)
        mage: {
            id:             'void_heretic',
            name:           'Herege do Vácuo',
            silhouette:     'asymmetric_fluid',
            armorWeight:    'mystic_coat',
            helmType:       'draped_hood',
            weaponType:     'void_catalyst',
            coatColor:      '#1b1822',
            clawArm:        true,
            accentColor:    '#7b1fa2',
        },
        void_heretic: {
            id:             'void_heretic',
            name:           'Herege do Vácuo',
            silhouette:     'asymmetric_fluid',
            armorWeight:    'mystic_coat',
            helmType:       'draped_hood',
            weaponType:     'void_catalyst',
            coatColor:      '#1b1822',
            clawArm:        true,
            accentColor:    '#7b1fa2',
        },
    });

    /**
     * Sistema Central de Composição e Renderização Modular Paperdoll
     */
    class PaperdollSystem {
        /**
         * Renderiza uma entidade com seu Paperdoll completo na visão top-down 15°-20°.
         * 
         * @param {CanvasRenderingContext2D} ctx 
         * @param {Object} entity - Posição, facing, iFrames, velocidade, hurtFlashTimer
         * @param {Object} charData - Linhagem, classe, equipamentos
         * @param {number} [dt=0.016] 
         * @param {Object} [options={}] - Parâmetros opcionais de renderização
         */
        static drawCharacter(ctx, entity, charData, dt = 0.016, options = {}) {
            if (!ctx || !entity) return;

            const now = performance.now();
            const posX = entity.x;
            const posY = entity.y;
            const facing = entity.facing || { x: 0, y: 1 };
            const isMoving = !!(entity.isMoving || (Math.hypot(entity.vx || 0, entity.vy || 0) > 10));
            const isDashing = !!entity.isDashing;

            // Determinar Direção Angular e Inversão
            const isFacingNorth = facing.y < -0.35;
            const isFacingWest  = facing.x < -0.05;

            // Identificar Linhagem e Classe
            const lineageKey = charData?.lineageId || charData?.bloodlineId || 'children_of_pyre';
            const lineage = LINEAGE_VISUALS[lineageKey] || LINEAGE_VISUALS.children_of_pyre;

            const classKey = charData?.classId || 'barbarian';
            const classVis = CLASS_VISUALS[classKey] || CLASS_VISUALS.barbarian;

            // Animação senoidal de respiração e passada (Walking Bob)
            const bob = isMoving ? Math.sin(now / 110) * 2.2 : (Math.sin(now / 700) * 0.9);
            const walkSwing = isMoving ? Math.sin(now / 110) * 4.5 : 0;

            // Rastreamento de inércia da capa (Z-0)
            if (!entity._capeLag) entity._capeLag = { x: 0, y: 0 };
            const vx = entity.vx || 0;
            const vy = entity.vy || 0;
            entity._capeLag.x += (-vx * 0.05 - entity._capeLag.x) * Math.min(1, dt * 10);
            entity._capeLag.y += (-vy * 0.05 - entity._capeLag.y) * Math.min(1, dt * 10);

            ctx.save();

            // Translação para o pé da entidade (Pivô Universal X: 48, Y: 82 da grade 96x96)
            ctx.translate(posX, posY);

            // Buffer de Sombra Projetada: elipse preta semitransparente na base do solo
            ctx.beginPath();
            ctx.ellipse(0, 2, 18, 8, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(5, 4, 6, 0.65)';
            ctx.fill();

            // Inversão Horizontal Matricial para Direção Oeste
            if (isFacingWest) {
                ctx.scale(-1, 1);
            }

            // Invulnerabilidade ou Dash Trail
            if (isDashing) {
                ctx.globalAlpha = 0.55;
            } else if (entity.iFrames > 0 && Math.floor(entity.iFrames * 22) % 2 === 0) {
                ctx.globalAlpha = 0.4;
            }

            // Offset de pivô: centralizar o manequim de 96x96 no pivô (48, 82)
            const drawOriginX = -48;
            const drawOriginY = -82 + bob;

            // Classificação de Profundidade de Itens (Z-Sort Pass)
            // Se virado para o Norte (Costas), Z-0 (Capa) fica à frente do tronco e Z-9 (Arma) atrás
            const zLayers = isFacingNorth
                ? [9, 2, 3, 4, 5, 6, 7, 8, 0, 1] // Visão Norte
                : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // Visão Padrão Sul / Leste

            for (const zIndex of zLayers) {
                this._renderLayer(ctx, zIndex, drawOriginX, drawOriginY, {
                    lineage,
                    classVis,
                    charData,
                    facing,
                    isFacingNorth,
                    isMoving,
                    walkSwing,
                    capeLag: entity._capeLag,
                    now,
                });
            }

            // Aplicação de Shader de Dano / Flash Branco (80ms em branco puro)
            if (entity.hurtFlashTimer > 0 || entity.hitFlash || entity.hitFlashTimer > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
                ctx.fillRect(-48, -96, 96, 96);
                ctx.restore();
            }

            ctx.restore();

            // Emissão de Partículas Locais nos Sockets (Brasas, Vapor, Vácuo)
            this._emitAmbientSockets(entity, lineage, classVis, posX, posY, isMoving);
        }

        /**
         * Renderização modular individual de cada uma das 10 camadas de Z-Index
         */
        static _renderLayer(ctx, zIndex, ox, oy, env) {
            const { lineage, classVis, isFacingNorth, now } = env;

            switch (zIndex) {
                // ─── [Z-0] Capa / Relicário / Mochila Traseira ───
                case 0:
                    this._drawCloak(ctx, ox, oy, env);
                    break;

                // ─── [Z-1] Arma Secundária / Escudo ───
                case 1:
                    this._drawOffHand(ctx, ox, oy, env);
                    break;

                // ─── [Z-2] Manequim Base (Pele, Anatomia Ancestral, Cabeça) ───
                case 2:
                    this._drawBaseMannequin(ctx, ox, oy, env);
                    break;

                // ─── [Z-3] Grevas / Botas / Pernas ───
                case 3:
                    this._drawBoots(ctx, ox, oy, env);
                    break;

                // ─── [Z-4] Saiote / Cinto / Cobre-Quadris ───
                case 4:
                    this._drawPelvis(ctx, ox, oy, env);
                    break;

                // ─── [Z-5] Antebraços e Luvas ───
                case 5:
                    this._drawForearms(ctx, ox, oy, env);
                    break;

                // ─── [Z-6] Peitoral Superior / Gibão ───
                case 6:
                    this._drawChest(ctx, ox, oy, env);
                    break;

                // ─── [Z-7] Elmo / Máscara / Capuz / Cabelo ───
                case 7:
                    this._drawHeadgear(ctx, ox, oy, env);
                    break;

                // ─── [Z-8] Hombreiras / Dragonas (Sockets SHOULDER_L e SHOULDER_R) ───
                case 8:
                    this._drawPauldrons(ctx, ox, oy, env);
                    break;

                // ─── [Z-9] Arma Principal (Slab Greatsword, Foice, Cetro, Foco) ───
                case 9:
                    this._drawMainWeapon(ctx, ox, oy, env);
                    break;
            }
        }

        // ═════════════════════════════════════════════════════════════════
        //  RENDERIZAÇÃO PROCEDURAL DAS CAMADAS MODULARES (Z-0 a Z-9)
        // ═════════════════════════════════════════════════════════════════

        static _drawCloak(ctx, ox, oy, env) {
            const { capeLag, classVis, isFacingNorth } = env;
            // Capas longas para Hierofante e Herege, ou farrapos para Flagelante
            if (classVis.id === 'ashen_warmaster' && !isFacingNorth) return;

            const sock = SOCKETS.BACK;
            const bx = ox + sock.x;
            const by = oy + sock.y;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(bx - 12, by);
            ctx.lineTo(bx + 12, by);
            // Pontas inferiores com atraso cinético de inércia
            ctx.quadraticCurveTo(bx + 18 + capeLag.x * 0.4, by + 26, bx + 16 + capeLag.x, by + 46);
            ctx.lineTo(bx - 16 + capeLag.x, by + 46);
            ctx.quadraticCurveTo(bx - 18 + capeLag.x * 0.4, by + 26, bx - 12, by);
            ctx.closePath();

            // Gradiente sombrio de tecido encardido e rasgado
            const cloakGrad = ctx.createLinearGradient(bx, by, bx, by + 46);
            cloakGrad.addColorStop(0, classVis.vestmentColor || classVis.coatColor || '#1c181d');
            cloakGrad.addColorStop(0.7, '#120f14');
            cloakGrad.addColorStop(1, '#09080a');
            ctx.fillStyle = cloakGrad;
            ctx.fill();

            ctx.strokeStyle = '#09080a';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Bainha inferior desfiada com fuligem
            ctx.fillStyle = 'rgba(9, 8, 10, 0.85)';
            ctx.fillRect(bx - 17 + capeLag.x, by + 43, 34, 4);

            ctx.restore();
        }

        static _drawBaseMannequin(ctx, ox, oy, env) {
            const { lineage, isFacingNorth, now } = env;
            const headSock = SOCKETS.HEAD;
            const chestSock = SOCKETS.CHEST;
            const hx = ox + headSock.x;
            const hy = oy + headSock.y;
            const cx = ox + chestSock.x;
            const cy = oy + chestSock.y;

            ctx.save();

            // 1. Torso Base (Anatomia atlética pesada)
            ctx.beginPath();
            ctx.ellipse(cx, cy, 14, 16, 0, 0, Math.PI * 2);
            ctx.fillStyle = lineage.skinShadow;
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx, cy - 2, 12, 14, 0, 0, Math.PI * 2);
            ctx.fillStyle = lineage.skinBase;
            ctx.fill();

            // 2. Cabeça (Formato angular inclinado 15°)
            ctx.beginPath();
            ctx.ellipse(hx, hy, 10, 11, 0, 0, Math.PI * 2);
            ctx.fillStyle = lineage.skinBase;
            ctx.fill();
            ctx.strokeStyle = '#09080a';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 3. Detalhes Faciais e Modificadores da Linhagem Ancestral (se olhando de frente)
            if (!isFacingNorth) {
                // Filhos da Pira: Fissuras de brasa pulsante e olhos de fornalha
                if (lineage.creaseGlow) {
                    const pulse = Math.sin(now / 220) * 0.3 + 0.7;
                    ctx.fillStyle = lineage.creaseGlow;
                    // Fissuras no pescoço
                    ctx.fillRect(hx - 5, hy + 7, 10, 2);
                    // Olhos de cavidade de brasa
                    ctx.shadowColor = lineage.creaseGlow;
                    ctx.shadowBlur = 6 * pulse;
                    ctx.fillStyle = lineage.creaseGlowHot;
                    ctx.fillRect(hx - 5, hy - 2, 3, 2);
                    ctx.fillRect(hx + 2, hy - 2, 3, 2);
                    ctx.shadowBlur = 0;
                }
                // Nobreza Decadente: Olheiras de hematoma e gargantilha
                else if (lineage.eyeBags) {
                    ctx.fillStyle = lineage.eyeBags;
                    ctx.fillRect(hx - 6, hy - 1, 4, 3);
                    ctx.fillRect(hx + 2, hy - 1, 4, 3);
                    // Olhos leitosos cor de vinho
                    ctx.fillStyle = lineage.eyeIris;
                    ctx.fillRect(hx - 5, hy - 1, 2, 2);
                    ctx.fillRect(hx + 3, hy - 1, 2, 2);
                    // Gargantilha de veludo
                    ctx.fillStyle = lineage.chokerColor;
                    ctx.fillRect(hx - 6, hy + 6, 12, 2);
                }
                // Marcados pelo Vácuo: Placas quitinosas assimétricas e ponto violeta
                else if (lineage.chitinPlate) {
                    ctx.fillStyle = lineage.chitinPlate;
                    ctx.fillRect(hx - 8, hy - 6, 6, 12);
                    // Ponto de luz violeta fraturada
                    ctx.fillStyle = lineage.voidEye;
                    ctx.shadowColor = lineage.voidGlow;
                    ctx.shadowBlur = 8;
                    ctx.fillRect(hx + 2, hy - 2, 2, 2);
                    ctx.shadowBlur = 0;
                }
                // Autômato Esfolado: Retalhos com grampos e lente de latão âmbar
                else if (lineage.stapleColor) {
                    // Metade esquerda com placa de caldeira
                    ctx.fillStyle = lineage.metalPlate;
                    ctx.fillRect(hx - 8, hy - 7, 7, 14);
                    // Grampos cirúrgicos prateados
                    ctx.fillStyle = lineage.stapleColor;
                    ctx.fillRect(hx - 1, hy - 4, 3, 1);
                    ctx.fillRect(hx - 1, hy + 1, 3, 1);
                    // Olho óptico de latão
                    ctx.fillStyle = lineage.lensBrass;
                    ctx.beginPath();
                    ctx.arc(hx + 3, hy - 1, 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = lineage.lensAmber;
                    ctx.shadowColor = lineage.lensAmber;
                    ctx.shadowBlur = 6;
                    ctx.fillRect(hx + 2, hy - 2, 2, 2);
                    ctx.shadowBlur = 0;
                }
            }

            ctx.restore();
        }

        static _drawBoots(ctx, ox, oy, env) {
            const { classVis, walkSwing } = env;
            const sock = SOCKETS.FEET;
            const fx = ox + sock.x;
            const fy = oy + sock.y;

            ctx.save();
            // Pés alargados para firmeza visual e peso
            const bootColor = classVis.plateColor || '#1d191c';

            // Perna Esquerda
            ctx.fillStyle = bootColor;
            ctx.beginPath();
            ctx.roundRect 
                ? ctx.roundRect(fx - 14, fy - 10 + walkSwing, 10, 16, 2)
                : ctx.rect(fx - 14, fy - 10 + walkSwing, 10, 16);
            ctx.fill();
            ctx.strokeStyle = '#09080a';
            ctx.stroke();

            // Perna Direita
            ctx.beginPath();
            ctx.roundRect 
                ? ctx.roundRect(fx + 4, fy - 10 - walkSwing, 10, 16, 2)
                : ctx.rect(fx + 4, fy - 10 - walkSwing, 10, 16);
            ctx.fill();
            ctx.stroke();

            // Escamas de ferro / presilhas de couro nos calçados
            ctx.fillStyle = '#4a3c28';
            ctx.fillRect(fx - 13, fy - 2 + walkSwing, 8, 2);
            ctx.fillRect(fx + 5, fy - 2 - walkSwing, 8, 2);

            ctx.restore();
        }

        static _drawPelvis(ctx, ox, oy, env) {
            const { classVis } = env;
            const sock = SOCKETS.PELVIS;
            const px = ox + sock.x;
            const py = oy + sock.y;

            ctx.save();
            // Saiote / Faixa / Cilício
            if (classVis.waistChain) {
                // Flagelante: correntes de aço enferrujado como cilício
                ctx.fillStyle = '#2c2220';
                ctx.fillRect(px - 14, py - 4, 28, 8);
                ctx.strokeStyle = '#8c7569';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([3, 3]);
                ctx.strokeRect(px - 14, py - 3, 28, 6);
                ctx.setLineDash([]);
            } else {
                // Guerreiro / Paladino: saiote reforçado com placas sobrepostas
                ctx.fillStyle = '#1c191e';
                ctx.fillRect(px - 15, py - 4, 30, 9);
                ctx.strokeStyle = '#4a3c28';
                ctx.lineWidth = 1;
                ctx.strokeRect(px - 15, py - 4, 30, 9);

                // Fivela de ferro escuro
                ctx.fillStyle = '#4a3c28';
                ctx.fillRect(px - 4, py - 3, 8, 7);
            }
            ctx.restore();
        }

        static _drawForearms(ctx, ox, oy, env) {
            const { classVis, walkSwing } = env;
            const handL = SOCKETS.MAIN_HAND;
            const handR = SOCKETS.OFF_HAND;

            ctx.save();
            // Mãos e antebraços +20% aumentados para leitura tática no Canvas
            const armColor = classVis.plateColor || '#231d22';

            // Braço Esquerdo (Main Hand)
            const alx = ox + handL.x;
            const aly = oy + handL.y - walkSwing;
            ctx.beginPath();
            ctx.roundRect
                ? ctx.roundRect(alx - 6, aly - 10, 12, 15, 3)
                : ctx.rect(alx - 6, aly - 10, 12, 15);
            ctx.fillStyle = armColor;
            ctx.fill();
            ctx.strokeStyle = '#09080a';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Braço Direito (Off Hand)
            const arx = ox + handR.x;
            const ary = oy + handR.y + walkSwing;
            ctx.beginPath();
            ctx.roundRect
                ? ctx.roundRect(arx - 6, ary - 10, 12, 15, 3)
                : ctx.rect(arx - 6, ary - 10, 12, 15);
            ctx.fillStyle = classVis.clawArm ? '#0d0b12' : armColor;
            ctx.fill();
            ctx.stroke();

            // Herege do Vácuo: Garra de osso vítreo translúcida na mão inábil
            if (classVis.clawArm) {
                ctx.fillStyle = '#7b1fa2';
                ctx.shadowColor = '#b388ff';
                ctx.shadowBlur = 8;
                ctx.fillRect(arx - 4, ary + 3, 8, 6);
                ctx.shadowBlur = 0;
            }

            ctx.restore();
        }

        static _drawChest(ctx, ox, oy, env) {
            const { classVis } = env;
            const sock = SOCKETS.CHEST;
            const cx = ox + sock.x;
            const cy = oy + sock.y;

            ctx.save();
            // Silhueta trapezoidal pesada nos ombros
            ctx.beginPath();
            ctx.moveTo(cx - 18, cy - 8);
            ctx.lineTo(cx + 18, cy - 8);
            ctx.lineTo(cx + 14, cy + 12);
            ctx.lineTo(cx - 14, cy + 12);
            ctx.closePath();

            const chestGrad = ctx.createLinearGradient(cx, cy - 8, cx, cy + 12);
            chestGrad.addColorStop(0, classVis.plateColor || classVis.jerkinColor || '#231e24');
            chestGrad.addColorStop(1, '#0e0c10');
            ctx.fillStyle = chestGrad;
            ctx.fill();

            ctx.strokeStyle = '#09080a';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Guerreiro da Cinza: marcas de martelo e sulcos de fuligem
            if (classVis.id === 'ashen_warmaster') {
                ctx.strokeStyle = '#4a3c28';
                ctx.lineWidth = 1;
                ctx.strokeRect(cx - 12, cy - 5, 24, 12);
            }
            // Hierofante: placa de latão oxidado com baixo relevo de braseiro
            else if (classVis.id === 'pyre_hierophant') {
                ctx.fillStyle = '#4a3c28';
                ctx.fillRect(cx - 8, cy - 4, 16, 10);
                ctx.fillStyle = '#ffa000';
                ctx.fillRect(cx - 2, cy - 1, 4, 4);
            }

            ctx.restore();
        }

        static _drawHeadgear(ctx, ox, oy, env) {
            const { classVis, isFacingNorth } = env;
            const sock = SOCKETS.HEAD;
            const hx = ox + sock.x;
            const hy = oy + sock.y;

            ctx.save();

            switch (classVis.helmType) {
                // 1. Guerreiro: Barbote e elmo bico-de-passarinho gótico
                case 'beak_visor':
                    ctx.beginPath();
                    ctx.moveTo(hx - 11, hy - 11);
                    ctx.lineTo(hx + 11, hy - 11);
                    ctx.lineTo(hx + 13, hy + 4);
                    ctx.lineTo(hx, hy + 9); // Bico protuberante frontal
                    ctx.lineTo(hx - 13, hy + 4);
                    ctx.closePath();
                    ctx.fillStyle = '#1e1a1c';
                    ctx.fill();
                    ctx.strokeStyle = '#09080a';
                    ctx.lineWidth = 1.2;
                    ctx.stroke();

                    // Fenda de visão microscópica com reflexo avermelhado
                    if (!isFacingNorth) {
                        ctx.fillStyle = '#df5418';
                        ctx.shadowColor = '#df5418';
                        ctx.shadowBlur = 4;
                        ctx.fillRect(hx - 6, hy - 1, 12, 1.5);
                        ctx.shadowBlur = 0;
                    }
                    break;

                // 2. Flagelante: Capuz pontiagudo rígido e máscara
                case 'pointed_cowl':
                    ctx.beginPath();
                    ctx.moveTo(hx, hy - 18); // Ponta rígida do capuz
                    ctx.lineTo(hx + 12, hy + 6);
                    ctx.lineTo(hx - 12, hy + 6);
                    ctx.closePath();
                    ctx.fillStyle = '#1c1518';
                    ctx.fill();
                    ctx.strokeStyle = '#09080a';
                    ctx.stroke();

                    if (!isFacingNorth) {
                        // Máscara com orifícios mínimos de couro escuro
                        ctx.fillStyle = '#09080a';
                        ctx.fillRect(hx - 6, hy, 12, 5);
                        ctx.fillStyle = '#8b1c1c';
                        ctx.fillRect(hx - 4, hy + 1, 2, 2);
                        ctx.fillRect(hx + 2, hy + 1, 2, 2);
                    }
                    break;

                // 3. Hierofante: Mitra eclesiástica alta com auréola de ferro
                case 'rigid_mitre':
                    // Auréola de ferro pregada à mitra
                    ctx.beginPath();
                    ctx.arc(hx, hy - 10, 16, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(197, 160, 89, 0.55)';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    // Mitra vertical alta
                    ctx.beginPath();
                    ctx.moveTo(hx, hy - 24);
                    ctx.lineTo(hx + 9, hy - 4);
                    ctx.lineTo(hx + 8, hy + 6);
                    ctx.lineTo(hx - 8, hy + 6);
                    ctx.lineTo(hx - 9, hy - 4);
                    ctx.closePath();
                    ctx.fillStyle = '#3a1922';
                    ctx.fill();
                    ctx.strokeStyle = '#09080a';
                    ctx.stroke();

                    // Máscara de madeira negra
                    if (!isFacingNorth) {
                        ctx.fillStyle = '#120f12';
                        ctx.fillRect(hx - 6, hy - 2, 12, 8);
                    }
                    break;

                // 4. Herege: Capuz largo desabado
                case 'draped_hood':
                default:
                    ctx.beginPath();
                    ctx.ellipse(hx, hy - 3, 13, 13, 0, 0, Math.PI * 2);
                    ctx.fillStyle = '#141118';
                    ctx.fill();
                    ctx.strokeStyle = '#09080a';
                    ctx.stroke();

                    if (!isFacingNorth) {
                        // Profunda escuridão interior com único ponto violeta
                        ctx.fillStyle = '#050406';
                        ctx.beginPath();
                        ctx.ellipse(hx, hy + 1, 9, 7, 0, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = '#b388ff';
                        ctx.shadowColor = '#b388ff';
                        ctx.shadowBlur = 6;
                        ctx.fillRect(hx + 1, hy, 2, 2);
                        ctx.shadowBlur = 0;
                    }
                    break;
            }

            ctx.restore();
        }

        static _drawPauldrons(ctx, ox, oy, env) {
            const { classVis } = env;
            const sockL = SOCKETS.SHOULDER_L;
            const sockR = SOCKETS.SHOULDER_R;
            const lx = ox + sockL.x;
            const ly = oy + sockL.y;
            const rx = ox + sockR.x;
            const ry = oy + sockR.y;

            ctx.save();
            const scaleL = classVis.pauldronLeftScale || 1.0;
            const scaleR = classVis.pauldronRightScale || 1.0;

            // Dragonas / Hombreira Esquerda (Assimetria Funcional)
            ctx.save();
            ctx.translate(lx, ly);
            ctx.scale(scaleL, scaleL);
            ctx.beginPath();
            ctx.moveTo(-7, -8);
            ctx.lineTo(7, -8);
            ctx.lineTo(8, 6);
            ctx.lineTo(-6, 8);
            ctx.closePath();
            ctx.fillStyle = classVis.pauldronColor || '#2c2528';
            ctx.fill();
            ctx.strokeStyle = '#09080a';
            ctx.lineWidth = 1;
            ctx.stroke();
            // Garde-faute alto para Guerreiro
            if (scaleL > 1.2) {
                ctx.fillStyle = '#4a3c28';
                ctx.fillRect(-6, -11, 4, 3);
            }
            ctx.restore();

            // Hombreira Direita
            ctx.save();
            ctx.translate(rx, ry);
            ctx.scale(scaleR, scaleR);
            ctx.beginPath();
            ctx.moveTo(-6, -7);
            ctx.lineTo(6, -7);
            ctx.lineTo(7, 5);
            ctx.lineTo(-5, 7);
            ctx.closePath();
            ctx.fillStyle = classVis.pauldronColor || '#231e21';
            ctx.fill();
            ctx.strokeStyle = '#09080a';
            ctx.stroke();
            ctx.restore();

            ctx.restore();
        }

        static _drawOffHand(ctx, ox, oy, env) {
            const { classVis, walkSwing } = env;
            const sock = SOCKETS.OFF_HAND;
            const x = ox + sock.x;
            const y = oy + sock.y + walkSwing;

            ctx.save();
            // Tomo acorrentado para Hierofante
            if (classVis.id === 'pyre_hierophant') {
                ctx.fillStyle = '#2d231e';
                ctx.fillRect(x - 6, y - 6, 12, 15);
                ctx.strokeStyle = '#4a3c28';
                ctx.lineWidth = 1.2;
                ctx.strokeRect(x - 6, y - 6, 12, 15);
                // Runa de ferro central
                ctx.fillStyle = '#ffa000';
                ctx.fillRect(x - 2, y, 4, 4);
            }
            // Broquel com espigões para Guerreiro
            else if (classVis.id === 'ashen_warmaster') {
                ctx.beginPath();
                ctx.arc(x, y, 9, 0, Math.PI * 2);
                ctx.fillStyle = '#1e1a1c';
                ctx.fill();
                ctx.strokeStyle = '#4a3c28';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                // Espigão central
                ctx.fillStyle = '#7d7569';
                ctx.beginPath();
                ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        static _drawMainWeapon(ctx, ox, oy, env) {
            const { classVis, walkSwing, now } = env;
            const sock = SOCKETS.MAIN_HAND;
            const wx = ox + sock.x;
            const wy = oy + sock.y - walkSwing;

            ctx.save();

            switch (classVis.weaponType) {
                // 1. Lâmina-Bloco de Forja (Slab Greatsword)
                case 'slab_greatsword':
                    // Barra maciça de ferro afiada de um lado com sulcos de cinzas
                    ctx.save();
                    ctx.translate(wx, wy);
                    ctx.rotate(-0.25);

                    // Cabo de ferro com faixas de couro
                    ctx.fillStyle = '#4a3c28';
                    ctx.fillRect(-2, 4, 4, 14);

                    // Lâmina Slab maciça
                    const bladeGrad = ctx.createLinearGradient(-7, -46, 7, -46);
                    bladeGrad.addColorStop(0, '#363035');
                    bladeGrad.addColorStop(0.7, '#1f1c21');
                    bladeGrad.addColorStop(1, '#09080a');
                    ctx.fillStyle = bladeGrad;
                    ctx.fillRect(-7, -46, 14, 50);

                    // Fio de corte com marcas de escória
                    ctx.strokeStyle = '#7d7569';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(-7, -46);
                    ctx.lineTo(-7, 4);
                    ctx.stroke();

                    // Sulco de cinzas incandescentes no centro
                    ctx.fillStyle = '#df5418';
                    ctx.shadowColor = '#df5418';
                    ctx.shadowBlur = 4;
                    ctx.fillRect(-1, -38, 2, 36);
                    ctx.shadowBlur = 0;

                    ctx.restore();
                    break;

                // 2. Foice Curva de Descarne (Flensing Scythe)
                case 'flensing_scythe':
                    ctx.save();
                    ctx.translate(wx, wy);
                    ctx.rotate(-0.35);

                    // Haste curva
                    ctx.strokeStyle = '#2d231e';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.moveTo(0, 12);
                    ctx.lineTo(0, -36);
                    ctx.stroke();

                    // Lâmina curva com canaleta de sangue ressecado
                    ctx.beginPath();
                    ctx.moveTo(0, -36);
                    ctx.quadraticCurveTo(-18, -48, -24, -30);
                    ctx.quadraticCurveTo(-14, -36, 0, -28);
                    ctx.closePath();
                    ctx.fillStyle = '#4e1111';
                    ctx.fill();
                    ctx.strokeStyle = '#8b1c1c';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    ctx.restore();
                    break;

                // 3. Relicário-Cetro com Braseiro Suspenso (Pyre Censer)
                case 'censer_mace':
                    ctx.save();
                    ctx.translate(wx, wy);
                    ctx.rotate(-0.15);

                    // Haste de ferro
                    ctx.fillStyle = '#1f1c1f';
                    ctx.fillRect(-2, -32, 4, 42);

                    // Capela gótica em miniatura com chama viva
                    ctx.fillStyle = '#4a3c28';
                    ctx.fillRect(-8, -46, 16, 15);
                    ctx.strokeStyle = '#09080a';
                    ctx.strokeRect(-8, -46, 16, 15);

                    // Fogo interno do relicário
                    const flamePulse = (Math.sin(now / 150) + 1) * 0.5;
                    ctx.fillStyle = '#ffa000';
                    ctx.shadowColor = '#df5418';
                    ctx.shadowBlur = 8 + flamePulse * 4;
                    ctx.beginPath();
                    ctx.arc(0, -39, 4 + flamePulse * 1.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;

                    ctx.restore();
                    break;

                // 4. Foco de Fenda do Vácuo (Void Catalyst)
                case 'void_catalyst':
                default:
                    ctx.save();
                    ctx.translate(wx, wy - 10);

                    // Fragmentos de vidro negro orbitando
                    const angleOrbit = (now / 400) % (Math.PI * 2);
                    ctx.fillStyle = '#0d0b12';
                    ctx.shadowColor = '#7b1fa2';
                    ctx.shadowBlur = 10;

                    for (let i = 0; i < 3; i++) {
                        const a = angleOrbit + (i * Math.PI * 2) / 3;
                        const fx = Math.cos(a) * 9;
                        const fy = Math.sin(a) * 6;
                        ctx.beginPath();
                        ctx.ellipse(fx, fy, 4, 2, a, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.shadowBlur = 0;

                    ctx.restore();
                    break;
            }

            ctx.restore();
        }

        /**
         * Emissor sutil de partículas associadas aos sockets
         */
        static _emitAmbientSockets(entity, lineage, classVis, px, py, isMoving) {
            // Emissão leve a cada ~120ms
            const now = performance.now();
            if (entity._lastParticleTick && (now - entity._lastParticleTick) < 140) return;
            entity._lastParticleTick = now;

            const engine = global.dungeonEngine;
            if (!engine || !engine.particles) return;

            // Filhos da Pira: cinzas e fagulhas quentes escapando dos punhos
            if (lineage.ambientParticle === 'ashes' && Math.random() < 0.6) {
                engine.particles.push({
                    x: px + (Math.random() - 0.5) * 16,
                    y: py - 20 + (Math.random() - 0.5) * 10,
                    vx: (Math.random() - 0.5) * 15,
                    vy: -Math.random() * 25 - 10,
                    lifetime: 0.55,
                    maxLife: 0.55,
                    size: Math.random() * 2.5 + 1.2,
                    color: Math.random() < 0.5 ? '#df5418' : '#373435',
                    type: 'circle',
                });
            }
            // Autômato Esfolado: jatos curtos de vapor cinzento sob pressão nas costas
            else if (lineage.ambientParticle === 'steam' && isMoving) {
                engine.particles.push({
                    x: px + (Math.random() - 0.5) * 10,
                    y: py - 12,
                    vx: (Math.random() - 0.5) * 12,
                    vy: -Math.random() * 30 - 15,
                    lifetime: 0.45,
                    maxLife: 0.45,
                    size: Math.random() * 4 + 2,
                    color: 'rgba(180, 180, 185, 0.4)',
                    type: 'circle',
                });
            }
            // Marcados pelo Vácuo: gotas de alcatrão que evaporam para cima
            else if (lineage.ambientParticle === 'void_drops' && Math.random() < 0.45) {
                engine.particles.push({
                    x: px + (Math.random() - 0.5) * 14,
                    y: py - 18,
                    vx: (Math.random() - 0.5) * 8,
                    vy: -Math.random() * 20 - 8,
                    lifetime: 0.6,
                    maxLife: 0.6,
                    size: Math.random() * 2.8 + 1,
                    color: '#7b1fa2',
                    type: 'circle',
                });
            }
        }
    }

    // Exportação Global
    global.SOCKETS = SOCKETS;
    global.PALETTE = PALETTE;
    global.LINEAGE_VISUALS = LINEAGE_VISUALS;
    global.CLASS_VISUALS = CLASS_VISUALS;
    global.PaperdollSystem = PaperdollSystem;

    console.log('[PaperdollSystem] Loaded successfully: Top-Down 15°-20° Rig, Sockets & Z-0..Z-9 Layers.');

})(typeof window !== 'undefined' ? window : this);
