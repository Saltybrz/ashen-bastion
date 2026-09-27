/**
 * ============================================
 *  ALCHEMY MANAGER (O Caldeirão Alquímico)
 *  In Search of Hope: The Ashen Bastion
 *  Handles potion distillation, belt slots (1 & 2),
 *  temporary combat buffs, and instant restorative tonics.
 * ============================================
 */

class AlchemyManager {
    /**
     * @param {StateManager} state
     */
    constructor(state) {
        /** @type {StateManager} */
        this.state = state;

        this.definitions = ELIXIR_DEFINITIONS;
        this.cooldowns = {
            unstable_ether_flask: 0,
        };

        console.log('[AlchemyManager] Caldeirão Alquímico em ebulição.');
    }

    /**
     * Get inventory count of a specific potion.
     * @param {string} potionId
     * @returns {number}
     */
    getPotionCount(potionId) {
        return this.state.potions[potionId] || 0;
    }

    /**
     * Check if player can afford brewing a potion.
     * @param {string} potionId
     * @param {number} amount
     * @returns {boolean}
     */
    canCraft(potionId, amount = 1) {
        const def = this.definitions[potionId];
        if (!def) return false;

        for (const [resType, cost] of Object.entries(def.cost)) {
            const required = cost * amount;
            if ((this.state.resources[resType] || 0) < required) {
                return false;
            }
        }
        return true;
    }

    /**
     * Craft/distill a potion.
     * @param {string} potionId
     * @param {number} amount
     * @returns {{ success: boolean, count?: number, reason?: string }}
     */
    craftPotion(potionId, amount = 1) {
        const def = this.definitions[potionId];
        if (!def) return { success: false, reason: 'Receita alquímica desconhecida.' };

        if (!this.canCraft(potionId, amount)) {
            return { success: false, reason: 'Reagentes e matérias insuficientes para a destilação.' };
        }

        // Consume reagents
        for (const [resType, cost] of Object.entries(def.cost)) {
            this.state.spendResource(resType, cost * amount);
        }

        // Add to potion inventory
        this.state.potions[potionId] = (this.state.potions[potionId] || 0) + amount;
        this.state.emit('potions:changed', this.state.potions);
        this.state.emit('potion_crafted', { potionId, amount, def });

        return { success: true, count: this.state.potions[potionId], def };
    }

    /**
     * Assign a potion to a belt quickslot (0 for Key 1, 1 for Key 2).
     * @param {number} slotIndex 0 | 1
     * @param {string} potionId
     */
    assignBeltSlot(slotIndex, potionId) {
        if (slotIndex < 0 || slotIndex > 1) return false;
        if (potionId && !this.definitions[potionId]) return false;

        this.state.potionBelt[slotIndex] = potionId;
        this.state.emit('belt:changed', this.state.potionBelt);
        return true;
    }

    /**
     * Consume potion assigned to belt quickslot.
     * @param {number} slotIndex 0 | 1
     * @returns {{ success: boolean, potionId?: string, reason?: string }}
     */
    useBeltSlot(slotIndex) {
        const potionId = this.state.potionBelt[slotIndex];
        if (!potionId) {
            return { success: false, reason: 'Nenhum elixir equipado neste bolsão da cinta.' };
        }

        return this.usePotion(potionId);
    }

    /**
     * Consume a potion by ID.
     * @param {string} potionId
     * @returns {{ success: boolean, def?: Object, reason?: string }}
     */
    usePotion(potionId) {
        const def = this.definitions[potionId];
        if (!def) return { success: false, reason: 'Elixir inexistente.' };

        const currentCount = this.getPotionCount(potionId);
        if (currentCount <= 0) {
            return { success: false, reason: `Sem frascos de ${def.name} restantes.` };
        }

        const char = this.state.character;
        if (!char) return { success: false, reason: 'Nenhum campeão em combate.' };

        // Handle cooldown if applicable (e.g. Unstable Ether Flask)
        if (def.cooldown && this.cooldowns[potionId] > 0) {
            const rem = Math.ceil(this.cooldowns[potionId]);
            return { success: false, reason: `O frasco ainda ferve. Aguarde ${rem}s.` };
        }

        // Consume one potion
        this.state.potions[potionId]--;
        this.state.emit('potions:changed', this.state.potions);

        // Apply instant effect
        if (def.instantResource) {
            const restored = Math.floor(char.maxResource * def.instantResource);
            char.resource = Math.min(char.maxResource, char.resource + restored);
            this.cooldowns[potionId] = def.cooldown || 30;
            this.state.emit('character:changed', char);
            this.state.emit('potion_consumed', { potionId, def, instantRestored: restored });
            return { success: true, def, message: `+${restored} ${char.resourceLabel} restaurados!` };
        }

        // Apply temporary buff
        if (def.buff) {
            const expiresAt = Date.now() + def.duration * 1000;
            const buffData = {
                ...def.buff,
                name: def.name,
                icon: def.icon,
                expiresAt,
                duration: def.duration,
            };

            this.state.activeBuffs[potionId] = buffData;
            char.activeBuffs[potionId] = buffData;
            char.recalculate();

            this.state.emit('character:changed', char);
            this.state.emit('buff_applied', { potionId, buff: buffData });
            this.state.emit('potion_consumed', { potionId, def, buff: buffData });

            return { success: true, def, buff: buffData };
        }

        return { success: true, def };
    }

    /**
     * Update active buffs and cooldowns.
     * @param {number} dt Delta time in seconds
     */
    update(dt) {
        const now = Date.now();
        const char = this.state.character;
        let buffsChanged = false;

        // Update cooldowns
        for (const [id, cd] of Object.entries(this.cooldowns)) {
            if (cd > 0) {
                this.cooldowns[id] = Math.max(0, cd - dt);
            }
        }

        // Update active buffs
        for (const [id, buff] of Object.entries(this.state.activeBuffs)) {
            if (!buff) continue;
            buff.duration = (buff.duration !== undefined ? buff.duration : 0) - dt;
            if (buff.duration <= 0 || (buff.expiresAt && now >= buff.expiresAt)) {
                delete this.state.activeBuffs[id];
                if (char && char.activeBuffs) {
                    delete char.activeBuffs[id];
                }
                buffsChanged = true;
                this.state.emit('buff_expired', { potionId: id, name: buff.name });
            }
        }

        if (buffsChanged && char) {
            char.recalculate();
            this.state.emit('character:changed', char);
        }
    }

    /**
     * Returns active buffs with remaining seconds.
     * @returns {Array<Object>}
     */
    getActiveBuffs() {
        const now = Date.now();
        const list = [];
        for (const [id, b] of Object.entries(this.state.activeBuffs)) {
            if (b && b.expiresAt > now) {
                const remainingSecs = Math.max(0, Math.ceil((b.expiresAt - now) / 1000));
                list.push({ ...b, id, remainingSecs });
            }
        }
        return list;
    }
}
