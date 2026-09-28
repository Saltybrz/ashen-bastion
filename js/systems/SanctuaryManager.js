/**
 * ============================================================================
 * SanctuaryManager.js
 * In Search of Hope: The Ashen Bastion
 *
 * Manages the NPC sanctuary inside the Cathedral of Echoes (Catedral dos Ecos)
 * with progression-locked NPCs, interaction dialogues, and unique services:
 * - O Cronista das Cinzas (Bestiário & Fraquezas) - Nível 5+
 * - A Alquimista Herética (Tônicos Superiores) - Carrasco derrotado
 * - O Astrólogo do Vácuo (Respec de Rúbricas) - Nível 40+
 * ============================================================================
 */

(function (window) {
    'use strict';

    /**
     * @typedef {Object} SanctuaryNPC
     * @property {string} id
     * @property {string} name
     * @property {string} title
     * @property {number} x
     * @property {number} y
     * @property {number} radius
     * @property {string} icon
     * @property {string} auraColor
     * @property {(state: StateManager) => boolean} isUnlocked
     * @property {string} lockedNotice
     * @property {(state: StateManager, uiManager: UIManager) => void} onInteract
     */

    class SanctuaryManagerClass {
        constructor() {
            /** @type {SanctuaryNPC[]} */
            this.npcs = [
                {
                    id: 'lorekeeper',
                    name: 'O Cronista das Cinzas',
                    title: 'Lorekeeper & Guardião do Bestiário',
                    x: 380,
                    y: 440,
                    radius: 75,
                    icon: '📜',
                    auraColor: '#c5a059',
                    isUnlocked: (state) => {
                        const lvl = state?.character?.level || 1;
                        return lvl >= 5;
                    },
                    lockedNotice: 'A presença deste servo das cinzas ainda não se manifestou neste plano. [Requer Nível 5]',
                    onInteract: (state, uiManager) => {
                        this.openBestiaryModal(state, uiManager);
                    }
                },
                {
                    id: 'heretic_alchemist',
                    name: 'A Alquimista Herética',
                    title: 'Mestre de Tônicos & Óleos Proibidos',
                    x: 960,
                    y: 440,
                    radius: 75,
                    icon: '⚗️',
                    auraColor: '#9b59b6',
                    isUnlocked: (state) => {
                        const clears = state?.totalDungeonClears || 0;
                        const bosses = state?.character?.bossesDefeated || {};
                        return clears > 0 || !!bosses.ironbound_executioner;
                    },
                    lockedNotice: 'A presença deste servo das cinzas ainda não se manifestou neste plano. [Requer Derrotar o Carrasco de Ferro Negro]',
                    onInteract: (state, uiManager) => {
                        this.openHereticAlchemyModal(state, uiManager);
                    }
                },
                {
                    id: 'void_astrologer',
                    name: 'O Astrólogo do Vácuo',
                    title: 'Guardião das Rúbricas Celestes',
                    x: 672,
                    y: 175,
                    radius: 80,
                    icon: '🌌',
                    auraColor: '#3b706c',
                    isUnlocked: (state) => {
                        const lvl = state?.character?.level || 1;
                        return lvl >= 40;
                    },
                    lockedNotice: 'A presença deste servo das cinzas ainda não se manifestou neste plano. [Requer Nível 40 — Despertar das Rúbricas]',
                    onInteract: (state, uiManager) => {
                        this.openAstrologerModal(state, uiManager);
                    }
                }
            ];
        }

        /**
         * Returns an NPC by ID.
         * @param {string} id
         * @returns {SanctuaryNPC|null}
         */
        getNPC(id) {
            return this.npcs.find(n => n.id === id) || null;
        }

        /**
         * Returns active trigger zones for the Cathedral map.
         * @param {StateManager} state
         * @param {UIManager} uiManager
         * @returns {Array<any>}
         */
        getTriggerZones(state, uiManager) {
            return this.npcs.map(npc => {
                const unlocked = npc.isUnlocked(state);
                return {
                    id: `cathedral_npc_${npc.id}`,
                    name: unlocked ? npc.name : 'Manto Vazio',
                    prompt: unlocked ? `[E] Falar com ${npc.name}` : `[E] Inspecionar Cinzas`,
                    x: npc.x,
                    y: npc.y,
                    radius: npc.radius,
                    icon: unlocked ? npc.icon : '🜂',
                    color: unlocked ? npc.auraColor : '#44403c',
                    action: () => {
                        if (unlocked) {
                            npc.onInteract(state, uiManager);
                        } else {
                            if (uiManager && typeof uiManager.notify === 'function') {
                                uiManager.notify(npc.lockedNotice, 'warning');
                            }
                            if (window.AudioManager) window.AudioManager.playClick(400);
                        }
                    }
                };
            });
        }

        /**
         * Renders NPCs or their empty cloaks on the Cathedral Canvas.
         * @param {CanvasRenderingContext2D} ctx
         * @param {StateManager} state
         * @param {{ x: number, y: number }} heroPos
         * @param {number} now
         */
        render(ctx, state, heroPos, now) {
            for (const npc of this.npcs) {
                const unlocked = npc.isUnlocked(state);
                const dist = Math.hypot(heroPos.x - npc.x, heroPos.y - npc.y);
                const isNear = dist <= npc.radius;
                const pulse = (Math.sin(now / 500) + 1) * 0.5;

                ctx.save();

                if (unlocked) {
                    // Glowing NPC Circle / Aura
                    ctx.beginPath();
                    ctx.arc(npc.x, npc.y, isNear ? 28 + pulse * 4 : 22, 0, Math.PI * 2);
                    ctx.fillStyle = isNear ? 'rgba(197, 160, 89, 0.3)' : 'rgba(18, 15, 23, 0.7)';
                    ctx.fill();

                    ctx.strokeStyle = npc.auraColor;
                    ctx.lineWidth = isNear ? 2.5 : 1.5;
                    ctx.shadowColor = npc.auraColor;
                    ctx.shadowBlur = isNear ? 16 : 8;
                    ctx.stroke();
                    ctx.shadowBlur = 0;

                    // NPC Rune / Icon
                    ctx.font = '20px "Cinzel", serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#ffeed0';
                    ctx.fillText(npc.icon, npc.x, npc.y);

                    // Name Tag
                    ctx.font = 'bold 11px "Cinzel", serif';
                    ctx.fillStyle = isNear ? '#ffffff' : '#cfc3b2';
                    ctx.fillText(npc.name, npc.x, npc.y + 32);

                    ctx.font = 'italic 9px "Crimson Pro", serif';
                    ctx.fillStyle = '#9e9589';
                    ctx.fillText(npc.title, npc.x, npc.y + 44);

                } else {
                    // Locked: Extinguished mantle / ashes on the floor
                    ctx.beginPath();
                    ctx.ellipse(npc.x, npc.y + 6, 18, 9, 0, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(15, 12, 10, 0.85)';
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(120, 110, 100, 0.35)';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    // Subtle cold smoke ember
                    ctx.font = '14px "Cinzel", serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = 'rgba(120, 115, 105, 0.6)';
                    ctx.fillText('ᛣ', npc.x, npc.y + 4);

                    // Manto Vazio Tag
                    ctx.font = '10px "Cinzel", serif';
                    ctx.fillStyle = '#6b655d';
                    ctx.fillText('Manto Silencioso', npc.x, npc.y + 26);
                }

                // Interactive Prompt Box
                if (isNear) {
                    const promptText = unlocked ? `[E] ${npc.name}` : `[E] Inspecionar`;
                    ctx.font = 'bold 12px "Cinzel", serif';
                    const textMetrics = ctx.measureText(promptText);
                    const boxW = textMetrics.width + 24;
                    const boxH = 26;
                    const boxX = npc.x - boxW / 2;
                    const boxY = npc.y - 48;

                    ctx.fillStyle = 'rgba(10, 8, 12, 0.94)';
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(boxX, boxY, boxW, boxH, 4);
                    else ctx.rect(boxX, boxY, boxW, boxH);
                    ctx.fill();

                    ctx.strokeStyle = unlocked ? npc.auraColor : '#554f46';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    ctx.fillStyle = unlocked ? '#fceecb' : '#999083';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(promptText, npc.x, boxY + boxH / 2);
                }

                ctx.restore();
            }
        }

        /**
         * Modal do Cronista: Bestiário das Famílias e Fraquezas Elementais.
         */
        openBestiaryModal(state, uiManager) {
            const kills = state?.character?.stats?.monstersKilled || state?.totalKills || 0;
            const bossesDefeated = state?.totalDungeonClears || 0;

            const modalHtml = `
                <div class="gothic-modal-header">
                    <div class="modal-sigil">📜</div>
                    <div>
                        <h2 class="font-cinzel" style="color:#e2c27c; margin:0;">Crônicas da Fenda & Bestiário</h2>
                        <p class="font-crimson" style="color:#9e9589; margin:2px 0 0 0; font-style:italic;">
                            "Nas cinzas estão gravados os segredos de tudo o que rasteja e sangra."
                        </p>
                    </div>
                </div>

                <div class="bestiary-grid" style="display:flex; flex-direction:column; gap:12px; margin-top:16px;">
                    <!-- Família 1: Crias do Vazio -->
                    <div class="bestiary-entry" style="background:#131116; border:1px solid #3b3542; padding:12px; border-radius:3px;">
                        <h4 class="font-cinzel" style="color:#b388ff; margin:0 0 4px 0;">ᛟ Crias do Vazio (Void Spawn)</h4>
                        <p style="font-size:0.95rem; color:#d6d0c7; margin:0 0 6px 0;">
                            Entidades rastejantes geradas da fenda estelar. Movimentam-se em bando veloz e cospem feixes gravitacionais.
                        </p>
                        <div style="font-size:0.85rem; display:flex; gap:16px;">
                            <span style="color:#ef4444;"><strong>Fraqueza:</strong> Fogo Sagrado (+40% Dano)</span>
                            <span style="color:#60a5fa;"><strong>Resistência:</strong> Dano Cósmico / Trevas</span>
                        </div>
                    </div>

                    <!-- Família 2: Os Esfolados -->
                    <div class="bestiary-entry" style="background:#131116; border:1px solid #3b3542; padding:12px; border-radius:3px;">
                        <h4 class="font-cinzel" style="color:#ef4444; margin:0 0 4px 0;">🜂 Os Esfolados (The Flayed)</h4>
                        <p style="font-size:0.95rem; color:#d6d0c7; margin:0 0 6px 0;">
                            Colossos de músculos e correntes guiados pelo Carrasco de Ferro Negro. Possuem golpes devastadores de cutelo.
                        </p>
                        <div style="font-size:0.85rem; display:flex; gap:16px;">
                            <span style="color:#38bdf8;"><strong>Fraqueza:</strong> Gelo &amp; Sangramento (+35% Dano)</span>
                            <span style="color:#f97316;"><strong>Resistência:</strong> Impacto Físico Direto</span>
                        </div>
                    </div>

                    <!-- Família 3: Círculo Cinéreo -->
                    <div class="bestiary-entry" style="background:#131116; border:1px solid #3b3542; padding:12px; border-radius:3px;">
                        <h4 class="font-cinzel" style="color:#facc15; margin:0 0 4px 0;">† Círculo Cinéreo (Ashen Coven)</h4>
                        <p style="font-size:0.95rem; color:#d6d0c7; margin:0 0 6px 0;">
                            Monges ocos e sacerdotes corrompidos que entoam hinos funerários e disparam ondas de choque sonoras.
                        </p>
                        <div style="font-size:0.85rem; display:flex; gap:16px;">
                            <span style="color:#fde047;"><strong>Fraqueza:</strong> Relâmpago &amp; Perfuração (+50% Dano)</span>
                            <span style="color:#94a3b8;"><strong>Resistência:</strong> Fogo &amp; Magia Elemental</span>
                        </div>
                    </div>
                </div>

                <div class="bestiary-stats" style="margin-top:16px; background:#0c0b0e; border:1px solid #2a2228; padding:10px 14px; display:flex; justify-content:space-between; font-size:0.9rem;">
                    <span>Monstros Expurgados: <strong style="color:#e2c27c;">${kills}</strong></span>
                    <span>Grandes Titãs Derrotados: <strong style="color:#e2c27c;">${bossesDefeated}</strong></span>
                </div>
            `;

            this._showModal(modalHtml, uiManager);
        }

        /**
         * Modal da Alquimista Herética: Destilação de Tônicos Superiores.
         */
        openHereticAlchemyModal(state, uiManager) {
            const gold = state?.resources?.gold || 0;
            const ashes = state?.resources?.sacred_ashes || 0;
            const essence = state?.resources?.essence || 0;

            const modalHtml = `
                <div class="gothic-modal-header">
                    <div class="modal-sigil" style="color:#9b59b6;">⚗️</div>
                    <div>
                        <h2 class="font-cinzel" style="color:#e2c27c; margin:0;">A Alquimista Herética</h2>
                        <p class="font-crimson" style="color:#9e9589; margin:2px 0 0 0; font-style:italic;">
                            "O sangue dos carrascos destila elixires que os sacerdotes covardes jamais ousariam provar."
                        </p>
                    </div>
                </div>

                <div class="heretic-recipes" style="display:flex; flex-direction:column; gap:14px; margin-top:16px;">
                    <!-- Receita 1: Frasco de Sangue Antigo -->
                    <div class="recipe-card" style="background:#131116; border:1px solid #5a1e28; padding:14px; border-radius:3px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h4 class="font-cinzel" style="color:#ef4444; margin:0 0 4px 0;">🩸 Frasco de Sangue Antigo</h4>
                            <p style="font-size:0.9rem; color:#d6d0c7; margin:0 0 6px 0;">
                                Concede <strong>+35% Dano de Ataque</strong> e <strong>+20% Roubo de Vida</strong> por 25 segundos na masmorra.
                            </p>
                            <span style="font-size:0.8rem; color:#9e9589;">Custo: 100 Ouro 🜚 + 2 Cinzas Sagradas 🜂</span>
                        </div>
                        <button class="btn-gothic btn-gothic-primary btn-sm" id="btn-craft-ancient-blood">
                            Destilar
                        </button>
                    </div>

                    <!-- Receita 2: Elixir de Fúria -->
                    <div class="recipe-card" style="background:#131116; border:1px solid #6b4317; padding:14px; border-radius:3px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h4 class="font-cinzel" style="color:#f59e0b; margin:0 0 4px 0;">⚡ Elixir de Fúria</h4>
                            <p style="font-size:0.9rem; color:#d6d0c7; margin:0 0 6px 0;">
                                Concede <strong>+50% Velocidade de Ataque</strong> e <strong>Imunidade a Atordoamento</strong> por 15 segundos.
                            </p>
                            <span style="font-size:0.8rem; color:#9e9589;">Custo: 120 Ouro 🜚 + 1 Essência Mágica ᛟ</span>
                        </div>
                        <button class="btn-gothic btn-gothic-primary btn-sm" id="btn-craft-fury-elixir">
                            Destilar
                        </button>
                    </div>
                </div>

                <div class="user-res-bar" style="margin-top:16px; background:#0c0b0e; border:1px solid #2a2228; padding:8px 14px; display:flex; gap:20px; font-size:0.85rem; color:#9e9589;">
                    <span>Ouro: <strong style="color:#e2c27c;">${gold}</strong></span>
                    <span>Cinzas: <strong style="color:#ef4444;">${ashes}</strong></span>
                    <span>Essências: <strong style="color:#b388ff;">${essence}</strong></span>
                </div>
            `;

            this._showModal(modalHtml, uiManager);

            // Wire crafting actions
            const btn1 = document.getElementById('btn-craft-ancient-blood');
            if (btn1) {
                btn1.addEventListener('click', () => {
                    const g = state?.resources?.gold || 0;
                    const a = state?.resources?.sacred_ashes || 0;
                    if (g >= 100 && a >= 2) {
                        state.spendResource('gold', 100);
                        state.spendResource('sacred_ashes', 2);
                        if (!state.potions) state.potions = {};
                        state.potions['ancient_blood'] = (state.potions['ancient_blood'] || 0) + 1;
                        state.emit('potions:changed');
                        uiManager?.notify('Frasco de Sangue Antigo destilado com sucesso!', 'success');
                        if (window.AudioManager) window.AudioManager.playClick(850);
                        this.openHereticAlchemyModal(state, uiManager);
                    } else {
                        uiManager?.notify('Recursos insuficientes (Requer 100 Ouro e 2 Cinzas)!', 'error');
                    }
                });
            }

            const btn2 = document.getElementById('btn-craft-fury-elixir');
            if (btn2) {
                btn2.addEventListener('click', () => {
                    const g = state?.resources?.gold || 0;
                    const e = state?.resources?.essence || 0;
                    if (g >= 120 && e >= 1) {
                        state.spendResource('gold', 120);
                        state.spendResource('essence', 1);
                        if (!state.potions) state.potions = {};
                        state.potions['fury_elixir'] = (state.potions['fury_elixir'] || 0) + 1;
                        state.emit('potions:changed');
                        uiManager?.notify('Elixir de Fúria destilado com sucesso!', 'success');
                        if (window.AudioManager) window.AudioManager.playClick(850);
                        this.openHereticAlchemyModal(state, uiManager);
                    } else {
                        uiManager?.notify('Recursos insuficientes (Requer 120 Ouro e 1 Essência)!', 'error');
                    }
                });
            }
        }

        /**
         * Modal do Astrólogo: Reespecialização da Constelação de Rúbricas.
         */
        openAstrologerModal(state, uiManager) {
            const char = state?.character;
            const rubricsAllocated = char?.rubricPointsSpent || (char?.allocatedRubrics ? Object.keys(char.allocatedRubrics).length : 0);

            const modalHtml = `
                <div class="gothic-modal-header">
                    <div class="modal-sigil" style="color:#3b706c;">🌌</div>
                    <div>
                        <h2 class="font-cinzel" style="color:#e2c27c; margin:0;">O Astrólogo do Vácuo</h2>
                        <p class="font-crimson" style="color:#9e9589; margin:2px 0 0 0; font-style:italic;">
                            "As estrelas da fenda refratam os destinos. Desfaça seus laços arcanos e trace uma nova órbita."
                        </p>
                    </div>
                </div>

                <div style="margin-top:16px; background:#131116; border:1px solid #233f3d; padding:16px; border-radius:3px;">
                    <p style="font-size:1.05rem; color:#ded7cd; line-height:1.5; margin:0 0 12px 0;">
                        O Guardião oferece o ritual da <strong>Ressonância Celeste</strong>.
                        Todos os pontos de Rúbricas alocados na grande constelação serão restituídos à sua consciência espiritual.
                    </p>
                    <div style="font-size:0.9rem; color:#9e9589; margin-bottom:16px;">
                        Pontos de Rúbrica Alocados Atualmente: <strong style="color:#e2c27c;">${rubricsAllocated}</strong>
                    </div>

                    <button class="btn-gothic btn-gothic-primary" id="btn-respec-rubrics" style="width:100%; justify-content:center; padding:12px;">
                        <span class="rune-icon">🌌</span> Reespecializar Todas as Rúbricas (Respec Gratuito)
                    </button>
                </div>
            `;

            this._showModal(modalHtml, uiManager);

            const btnRespec = document.getElementById('btn-respec-rubrics');
            if (btnRespec) {
                btnRespec.addEventListener('click', () => {
                    if (char) {
                        if (typeof char.respecRubrics === 'function') {
                            char.respecRubrics();
                        } else {
                            // Fallback direct respec
                            if (char.allocatedRubrics) {
                                const count = Object.keys(char.allocatedRubrics).length;
                                char.rubricPoints = (char.rubricPoints || 0) + count;
                                char.allocatedRubrics = {};
                            }
                        }
                        state.emit('character:changed');
                        uiManager?.notify('Constelação de Rúbricas redefinida! Todos os pontos foram devolvidos.', 'level');
                        if (window.AudioManager) window.AudioManager.playClash(true);
                        uiManager?.closeModal();
                    }
                });
            }
        }

        /**
         * Helper para abrir o modal gótico padrão do jogo.
         * @private
         */
        _showModal(contentHtml, uiManager) {
            if (uiManager && typeof uiManager.showModal === 'function') {
                uiManager.showModal(contentHtml);
            } else {
                const overlay = document.getElementById('modal-overlay');
                const content = document.getElementById('modal-content');
                if (overlay && content) {
                    content.innerHTML = contentHtml;
                    overlay.classList.remove('hidden');
                }
            }
        }
    }

    // Exposição Global
    window.SanctuaryManager = new SanctuaryManagerClass();

})(window);
