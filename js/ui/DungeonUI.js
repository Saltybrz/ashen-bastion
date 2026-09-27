/**
 * ============================================
 *  DUNGEON UI
 *  Binds dungeon enter/exit to the UI and
 *  manages the dungeon HUD overlay.
 * ============================================
 */

class DungeonUI {
    constructor(state, dungeonEngine, uiManager) {
        /** @type {StateManager} */
        this.state = state;
        /** @type {DungeonEngine} */
        this.dungeonEngine = dungeonEngine;
        /** @type {UIManager} */
        this.uiManager = uiManager;

        this.dom = {
            btnEnter:      document.getElementById('btn-enter-dungeon'),
            arena:         document.getElementById('dungeon-arena'),
            canvas:        document.getElementById('dungeon-canvas'),
            floorLabel:    document.getElementById('dungeon-floor'),
            enemiesLabel:  document.getElementById('dungeon-enemies'),
            btnRetreat:    document.getElementById('btn-retreat'),
            skillBar:      document.getElementById('skill-bar'),
            gatePortal:    document.getElementById('gate-portal'),
        };

        console.log('[DungeonUI] Initialized.');
    }

    init() {
        // Enter dungeon
        this.dom.btnEnter.addEventListener('click', () => {
            if (this.state.dungeonKeys <= 0) {
                this.uiManager.notify('Forje uma Chave da Fenda primeiro!', 'error');
                return;
            }

            // Show canvas
            this.dom.arena.classList.remove('hidden');

            const success = this.dungeonEngine.enter(this.dom.canvas);
            if (!success) {
                this.dom.arena.classList.add('hidden');
                this.uiManager.notify('Falha ao entrar na masmorra.', 'error');
                return;
            }

            this.uiManager.notify('Entrando na Fenda Abissal...', 'info');
            this._renderSkillBar();
        });

        // Retreat
        this.dom.btnRetreat.addEventListener('click', () => {
            this.dungeonEngine.exit('retreat');
            this.dom.arena.classList.add('hidden');
            this.uiManager.notify('Recuou da masmorra.', 'info');
        });

        // State events
        this.state.on('dungeon:entered', () => {
            this.dom.gatePortal.classList.add('active');
            if (window.AudioManager && typeof window.AudioManager.playMusic === 'function') {
                window.AudioManager.playMusic('dungeon');
            }
        });

        this.state.on('dungeon:exited', (data) => {
            this.dom.arena.classList.add('hidden');
            this.dom.gatePortal.classList.remove('active');
            if (window.AudioManager && typeof window.AudioManager.playMusic === 'function') {
                window.AudioManager.playMusic('general');
            }
            if (this.uiManager) {
                this.uiManager.switchTab('hub');
            }
            if (data.reason === 'death') {
                const p = data.penaltyInfo;
                let msg = 'Você sucumbiu à Fenda Abissal.';
                if (p) {
                    msg += ` Penalidade: -${p.lostGold} ouro, -${p.lostItemsCount} itens coletados (${p.penaltyPct}%).`;
                    if (p.keyBroken) msg += ' A Chave da Fenda quebrou!';
                }
                this.uiManager.notify(msg, 'error');
            }
        });

        this.state.on('dungeon:floor', (data) => {
            this.dom.floorLabel.textContent = data.floor;
            this.dom.enemiesLabel.textContent = data.enemies;
        });

        this.state.on('dungeon:bossdeath', (data) => {
            this.uiManager.notify(`Titã do andar ${data.floor} derrotado! Explosão de espólios!`, 'loot');
        });

        // Update enter button state
        this.state.on('keys:changed', (count) => {
            this.dom.btnEnter.disabled = count <= 0;
        });

        // Update HP bar and skill cooldowns during combat
        setInterval(() => {
            if (this.state.inDungeon && this.state.character) {
                this.uiManager.updateCharacterHUD(this.state.character);
                this._updateSkillBarCooldowns();

                // Update enemies count
                this.dom.enemiesLabel.textContent = this.dungeonEngine.enemies.length;
            }
        }, 100);

        // Re-render skill bar on skill tree events
        this.state.on('skilltree:updated', () => {
            if (this.state.inDungeon) {
                this._renderSkillBar();
            }
        });
        this.state.on('character:levelup', () => {
            if (this.state.inDungeon) {
                this._renderSkillBar();
            }
        });
    }

    _renderSkillBar() {
        const char = this.state.character;
        if (!char || !char.skillTree) return;

        this.dom.skillBar.innerHTML = '';
        const allSkills = char.skillTree.getAllSkills();

        for (const skill of allSkills) {
            const slot = document.createElement('div');
            const isUnlocked = skill.unlocked;
            slot.className = `skill-slot tier-${skill.tier} ${isUnlocked ? 'unlocked' : 'locked'}`;
            slot.dataset.tier = skill.tier;

            const activeMod = skill.getActiveModifier();
            const modBadge = activeMod ? `<span class="skill-mod-badge" title="Mutação: ${activeMod.name}">${activeMod.icon}</span>` : '';
            const costLabel = skill.cost > 0 ? `<span class="skill-cost">${skill.cost}</span>` : '';

            slot.title = isUnlocked
                ? `Tier ${skill.tier} - ${skill.name} (${skill.key}): ${skill.desc}`
                : `[Bloqueada] Requer Nível ${skill.requiredLevel}. Abra a Árvore de Habilidades para desbloquear.`;

            slot.innerHTML = `
                <span class="skill-icon rune-icon">${isUnlocked ? skill.icon : 'ᛦ'}</span>
                <span class="skill-key">${skill.key}</span>
                ${modBadge}
                ${costLabel}
                <div class="skill-cooldown-overlay" style="height: 0%;"></div>
                <span class="skill-cooldown-text"></span>
            `;

            // Click to activate if unlocked
            slot.addEventListener('click', () => {
                if (isUnlocked && this.dungeonEngine && this.dungeonEngine.combat) {
                    this.dungeonEngine.combat.useSkillByTier(skill.tier, this.dungeonEngine.mousePos);
                }
            });

            this.dom.skillBar.appendChild(slot);
        }
    }

    _updateSkillBarCooldowns() {
        const char = this.state.character;
        if (!char || !char.skillTree) return;

        const slots = this.dom.skillBar.querySelectorAll('.skill-slot');
        slots.forEach(slot => {
            const tier = parseInt(slot.dataset.tier);
            const skill = char.skillTree.getSkillByTier(tier);
            if (!skill) return;

            const overlay = slot.querySelector('.skill-cooldown-overlay');
            const cdText = slot.querySelector('.skill-cooldown-text');

            if (skill.currentCooldown > 0 && skill.cooldown > 0) {
                const pct = (skill.currentCooldown / skill.cooldown) * 100;
                if (overlay) overlay.style.height = `${pct}%`;
                if (cdText) cdText.textContent = skill.currentCooldown.toFixed(1) + 's';
                slot.classList.add('on-cooldown');
            } else {
                if (overlay) overlay.style.height = '0%';
                if (cdText) cdText.textContent = '';
                slot.classList.remove('on-cooldown');
            }

            // Check resource
            if (skill.cost > char.resource && skill.unlocked) {
                slot.classList.add('no-resource');
            } else {
                slot.classList.remove('no-resource');
            }
        });
    }
}

console.log('[DungeonUI] Class loaded.');
