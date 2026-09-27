/**
 * ============================================
 *  BOUNTY MANAGER (O Quadro de Editais)
 *  System with 3 active simultaneous secondary quests.
 *  Types: Caçada (Hunt), Extração (Gather), Artífice (Craft).
 *  Rewards: XP, Gold, Rift Keys, Sacred Ashes.
 *  Decoupled via Pub/Sub architecture.
 * ============================================
 */

class BountyManager {
    /**
     * @param {StateManager} state
     */
    constructor(state) {
        /** @type {StateManager} */
        this.state = state;
        this.maxSlots = 3;
        this.rerollFee = 25;
        this.refreshFee = 20;
        this.autoRefreshDuration = 45; // 45s cooldown after claim

        this._initListeners();
        this.ensureBounties();

        console.log('[BountyManager] Initialized with 3 bounty slots.');
    }

    /**
     * Subscribe to game events for automated progress tracking.
     */
    _initListeners() {
        // Hunt progress: Enemy killed in Dungeon
        this.state.on('dungeon:enemy_killed', (data) => {
            this._onEnemyKilled(data);
        });

        // Gather progress: Node gathered in Hub
        this.state.on('node:gathered', (data) => {
            this._onNodeGathered(data);
        });

        // Craft progress: Item upgraded in Forge
        this.state.on('item_upgraded', (data) => {
            if (data && data.success) {
                this._onCraftProgress('upgrade', 1);
            }
        });

        // Craft progress: Item salvaged in Forge
        this.state.on('item_salvaged', (data) => {
            const count = data ? (data.count || 1) : 1;
            this._onCraftProgress('salvage', count);
        });

        // Craft progress: Potion crafted in Alchemy
        this.state.on('potion_crafted', (data) => {
            const count = data ? (data.count || 1) : 1;
            this._onCraftProgress('alchemy', count);
        });

        // Save loaded: recheck slots
        this.state.on('game:loaded', () => {
            this.ensureBounties();
        });
    }

    /**
     * Ensure state.bounties always has exactly 3 valid slots.
     */
    ensureBounties() {
        if (!Array.isArray(this.state.bounties)) {
            this.state.bounties = [];
        }

        const current = this.state.bounties;
        while (current.length < this.maxSlots) {
            current.push(null);
        }

        for (let i = 0; i < this.maxSlots; i++) {
            if (!current[i]) {
                current[i] = this._createBounty(i);
            }
        }

        this.state.emit('bounties:changed', this.state.bounties);
    }

    /**
     * Create a new bounty from templates, avoiding duplicates where possible.
     * @param {number} slotIndex
     * @returns {Object}
     */
    _createBounty(slotIndex) {
        const templates = typeof BOUNTY_TEMPLATES !== 'undefined' ? BOUNTY_TEMPLATES : [];
        if (templates.length === 0) return null;

        // Collect existing template IDs to prevent duplicates
        const existingIds = (this.state.bounties || [])
            .filter(b => b && b.templateId)
            .map(b => b.templateId);

        let available = templates.filter(t => !existingIds.includes(t.id));
        if (available.length === 0) available = templates;

        const template = available[Math.floor(Math.random() * available.length)];

        // Icon based on bounty type
        let icon = 'ᛏ';
        if (template.type === 'hunt') icon = 'ᚦ';
        else if (template.type === 'gather') icon = 'ᚱ';
        else if (template.type === 'craft') icon = '🜛';

        return {
            id: `bounty_${Date.now()}_${slotIndex}_${Math.floor(Math.random() * 1000)}`,
            slotIndex,
            templateId: template.id,
            type: template.type,
            title: template.title,
            desc: template.desc,
            targetType: template.targetType,
            targetCount: template.targetCount,
            currentCount: 0,
            completed: false,
            claimed: false,
            reward: { ...template.reward },
            icon,
            cooldownRemaining: 0,
        };
    }

    /**
     * Progress hunt bounties.
     * @param {{ enemy: Object, isElite: boolean, isBoss: boolean }} data
     */
    _onEnemyKilled(data) {
        let changed = false;
        const bounties = this.state.bounties || [];

        for (const bounty of bounties) {
            if (!bounty || bounty.completed || bounty.claimed) continue;
            if (bounty.type !== 'hunt') continue;

            if (bounty.targetType === 'any_enemy') {
                bounty.currentCount = Math.min(bounty.targetCount, bounty.currentCount + 1);
                changed = true;
            } else if (bounty.targetType === 'elite_enemy' && (data.isElite || data.isBoss)) {
                bounty.currentCount = Math.min(bounty.targetCount, bounty.currentCount + 1);
                changed = true;
            }

            if (bounty.currentCount >= bounty.targetCount && !bounty.completed) {
                bounty.completed = true;
                this.state.emit('bounty_ready', { bounty });
            }
        }

        if (changed) {
            this.state.emit('bounties:changed', this.state.bounties);
        }
    }

    /**
     * Progress gather bounties.
     * @param {{ nodeId: string, resource: string, amount: number }} data
     */
    _onNodeGathered(data) {
        let changed = false;
        const bounties = this.state.bounties || [];

        for (const bounty of bounties) {
            if (!bounty || bounty.completed || bounty.claimed) continue;
            if (bounty.type !== 'gather') continue;

            if (bounty.targetType === data.resource) {
                bounty.currentCount = Math.min(bounty.targetCount, bounty.currentCount + (data.amount || 1));
                changed = true;
            }

            if (bounty.currentCount >= bounty.targetCount && !bounty.completed) {
                bounty.completed = true;
                this.state.emit('bounty_ready', { bounty });
            }
        }

        if (changed) {
            this.state.emit('bounties:changed', this.state.bounties);
        }
    }

    /**
     * Progress craft bounties (upgrade, salvage, alchemy).
     * @param {'upgrade' | 'salvage' | 'alchemy'} craftType
     * @param {number} count
     */
    _onCraftProgress(craftType, count = 1) {
        let changed = false;
        const bounties = this.state.bounties || [];

        for (const bounty of bounties) {
            if (!bounty || bounty.completed || bounty.claimed) continue;
            if (bounty.type !== 'craft') continue;

            if (bounty.targetType === craftType) {
                bounty.currentCount = Math.min(bounty.targetCount, bounty.currentCount + count);
                changed = true;
            }

            if (bounty.currentCount >= bounty.targetCount && !bounty.completed) {
                bounty.completed = true;
                this.state.emit('bounty_ready', { bounty });
            }
        }

        if (changed) {
            this.state.emit('bounties:changed', this.state.bounties);
        }
    }

    /**
     * Claim completed bounty reward.
     * @param {number} slotIndex
     * @returns {{ success: boolean, reward?: Object, reason?: string }}
     */
    claimBounty(slotIndex) {
        const bounty = (this.state.bounties || [])[slotIndex];
        if (!bounty) return { success: false, reason: 'Edital não encontrado.' };
        if (!bounty.completed) return { success: false, reason: 'O objetivo ainda não foi cumprido.' };
        if (bounty.claimed) return { success: false, reason: 'Recompensa já resgatada.' };

        // Mark claimed and start cooldown for replacement
        bounty.claimed = true;
        bounty.cooldownRemaining = this.autoRefreshDuration;

        const reward = bounty.reward || {};

        // Award XP
        if (reward.xp && this.state.character) {
            this.state.character.addXP(reward.xp, 'active');
        }

        // Award Gold
        if (reward.gold) {
            this.state.addResource(ResourceType.GOLD, reward.gold);
        }

        // Award Rift Keys
        if (reward.keys) {
            this.state.dungeonKeys = (this.state.dungeonKeys || 0) + reward.keys;
            this.state.emit('keys:changed', this.state.dungeonKeys);
        }

        // Award Sacred Ashes
        if (reward.ashes) {
            this.state.addResource(ResourceType.ASHES, reward.ashes);
        }

        this.state.emit('bounty_completed', {
            bounty,
            reward,
            slotIndex,
        });

        this.state.emit('bounties:changed', this.state.bounties);

        return { success: true, reward };
    }

    /**
     * Reroll an active incomplete bounty for a gold fee.
     * @param {number} slotIndex
     * @returns {{ success: boolean, bounty?: Object, reason?: string }}
     */
    rerollBounty(slotIndex) {
        const bounty = (this.state.bounties || [])[slotIndex];
        if (!bounty) return { success: false, reason: 'Edital não encontrado.' };
        if (bounty.claimed) return { success: false, reason: 'O edital já foi concluído. Utilize a renovação rápida.' };

        const currentGold = this.state.resources[ResourceType.GOLD] || 0;
        if (currentGold < this.rerollFee) {
            return {
                success: false,
                reason: `Ouro insuficiente para revogar edital. Requer 🜚 ${this.rerollFee} Ouro.`,
            };
        }

        this.state.spendResource(ResourceType.GOLD, this.rerollFee);

        // Replace slot with a fresh bounty
        const newBounty = this._createBounty(slotIndex);
        this.state.bounties[slotIndex] = newBounty;

        this.state.emit('bounty_rerolled', {
            oldId: bounty.id,
            newBounty,
            slotIndex,
            fee: this.rerollFee,
        });

        this.state.emit('bounties:changed', this.state.bounties);

        return { success: true, bounty: newBounty };
    }

    /**
     * Instantly refresh a claimed bounty on cooldown by paying a small gold fee.
     * @param {number} slotIndex
     * @returns {{ success: boolean, bounty?: Object, reason?: string }}
     */
    fastRefreshSlot(slotIndex) {
        const bounty = (this.state.bounties || [])[slotIndex];
        if (!bounty) return { success: false, reason: 'Edital não encontrado.' };
        if (!bounty.claimed) return { success: false, reason: 'Este edital ainda está ativo.' };

        const currentGold = this.state.resources[ResourceType.GOLD] || 0;
        if (currentGold < this.refreshFee) {
            return {
                success: false,
                reason: `Ouro insuficiente para apressar os editais. Requer 🜚 ${this.refreshFee} Ouro.`,
            };
        }

        this.state.spendResource(ResourceType.GOLD, this.refreshFee);

        const newBounty = this._createBounty(slotIndex);
        this.state.bounties[slotIndex] = newBounty;

        this.state.emit('bounty_refreshed', {
            newBounty,
            slotIndex,
            fee: this.refreshFee,
        });

        this.state.emit('bounties:changed', this.state.bounties);

        return { success: true, bounty: newBounty };
    }

    /**
     * Ticking update for cooldown timers on claimed bounties.
     * @param {number} dt Delta time in seconds
     */
    update(dt) {
        if (!this.state.bounties) return;

        let changed = false;

        for (let i = 0; i < this.state.bounties.length; i++) {
            const b = this.state.bounties[i];
            if (b && b.claimed && b.cooldownRemaining > 0) {
                b.cooldownRemaining = Math.max(0, b.cooldownRemaining - dt);
                if (b.cooldownRemaining <= 0) {
                    // Auto-replace with fresh bounty
                    this.state.bounties[i] = this._createBounty(i);
                    changed = true;
                }
            }
        }

        if (changed) {
            this.state.emit('bounties:changed', this.state.bounties);
        }
    }
}

// Export for browser globals
window.BountyManager = BountyManager;
