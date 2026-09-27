/**
 * ============================================
 *  BLACKSMITH MANAGER (A Bigorna Ancestral)
 *  In Search of Hope: The Ashen Bastion
 *  Handles equipment upgrading (+1 to +10)
 *  and item salvaging (individual & bulk).
 * ============================================
 */

class BlacksmithManager {
    /**
     * @param {StateManager} state
     */
    constructor(state) {
        /** @type {StateManager} */
        this.state = state;

        this.maxLevel = 10;
        this.baseOreCost = 15;
        this.baseGoldCost = 25;

        console.log('[BlacksmithManager] Bigorna Ancestral pronta.');
    }

    /**
     * Calculate cost for the next upgrade level.
     * Formula: Cost = BaseCost * (nextLevel)^1.5
     * @param {Item} item
     * @returns {{ ore: number, gold: number, nextLevel: number } | null}
     */
    getUpgradeCost(item) {
        if (!item) return null;
        const currentLevel = item.upgradeLevel || 0;
        if (currentLevel >= this.maxLevel) return null;

        const nextLevel = currentLevel + 1;
        const ore = Math.round(this.baseOreCost * Math.pow(nextLevel, 1.5));
        const gold = Math.round(this.baseGoldCost * Math.pow(nextLevel, 1.5));
        return { ore, gold, nextLevel };
    }

    /**
     * Get upgrade success chance for the next level.
     * 100% up to +3. From +4 onward: decreasing chances.
     * @param {number} currentLevel
     * @returns {number} 0.0 - 1.0
     */
    getSuccessChance(currentLevel = 0) {
        const nextLevel = currentLevel + 1;
        if (nextLevel <= 3) return 1.0;

        const chances = {
            4: 0.85,
            5: 0.70,
            6: 0.55,
            7: 0.40,
            8: 0.30,
            9: 0.20,
            10: 0.15,
        };
        return chances[nextLevel] ?? 0.10;
    }

    /**
     * Attempt to upgrade an item.
     * On success: +1 upgrade level, +10% base stats.
     * On failure: resources are spent, item remains intact.
     * @param {string} itemId
     * @returns {{ success: boolean, upgraded: boolean, item?: Item, newLevel?: number, cost?: Object, chance?: number, reason?: string }}
     */
    upgradeItem(itemId) {
        const char = this.state.character;
        if (!char) return { success: false, upgraded: false, reason: 'Nenhum campeão ativo.' };

        // Search in inventory or equipped gear
        let item = (char.inventory || []).find(i => i && i.id === itemId);
        let isEquipped = false;
        if (!item && char.equipment) {
            for (const [slot, eq] of Object.entries(char.equipment)) {
                if (eq && eq.id === itemId) {
                    item = eq;
                    isEquipped = true;
                    break;
                }
            }
        }

        if (!item) return { success: false, upgraded: false, reason: 'Equipamento não localizado na forja.' };

        const currentLvl = item.upgradeLevel || 0;
        if (currentLvl >= this.maxLevel) {
            return { success: false, upgraded: false, reason: `O equipamento já atingiu o zênite de têmpera (+${this.maxLevel}).` };
        }

        const cost = this.getUpgradeCost(item);
        if (!cost) return { success: false, upgraded: false, reason: 'Custo de têmpera indefinido.' };

        const currentOre = this.state.resources[ResourceType.ORE] || 0;
        const currentGold = this.state.resources[ResourceType.GOLD] || 0;

        if (currentOre < cost.ore || currentGold < cost.gold) {
            return {
                success: false,
                upgraded: false,
                reason: `Matérias insuficientes. Requer 🜛 ${cost.ore} Minério e 🜚 ${cost.gold} Ouro.`,
            };
        }

        // Consume forge resources
        this.state.spendResource(ResourceType.ORE, cost.ore);
        this.state.spendResource(ResourceType.GOLD, cost.gold);

        const chance = this.getSuccessChance(currentLvl);
        const roll = Math.random();
        const success = roll <= chance;

        if (success) {
            item.upgradeLevel = currentLvl + 1;
            char.recalculate();
            this.state.emit('character:changed', char);
            this.state.emit('item_upgraded', {
                item,
                newLevel: item.upgradeLevel,
                success: true,
                cost,
                isEquipped,
            });
            return {
                success: true,
                upgraded: true,
                item,
                newLevel: item.upgradeLevel,
                cost,
                chance,
            };
        } else {
            // Failure: item remains intact!
            this.state.emit('item_upgraded', {
                item,
                newLevel: currentLvl,
                success: false,
                cost,
                isEquipped,
            });
            return {
                success: true,
                upgraded: false,
                item,
                newLevel: currentLvl,
                cost,
                chance,
                failed: true,
            };
        }
    }

    /**
     * Calculate return resources when salvaging an item.
     * @param {Item} item
     * @returns {Object}
     */
    calculateSalvageReturns(item) {
        if (!item) return {};
        const returns = {};
        const rarity = item.rarity || Rarity.COMMON;

        if (rarity === Rarity.COMMON) {
            // Common: Wood + Ore
            returns[ResourceType.WOOD] = Utils.randInt(5, 12);
            returns[ResourceType.ORE]  = Utils.randInt(4, 10);
        } else if (rarity === Rarity.MAGIC) {
            // Magic: Gold + Arcane Powder / Essence
            returns[ResourceType.GOLD]    = Utils.randInt(15, 30);
            returns[ResourceType.ESSENCE] = Utils.randInt(2, 5);
        } else if (rarity === Rarity.RARE) {
            // Rare: Gold + Essence + Core Fragment / Sacred Ashes
            returns[ResourceType.GOLD]    = Utils.randInt(45, 90);
            returns[ResourceType.ESSENCE] = Utils.randInt(5, 12);
            returns[ResourceType.ASHES]   = Utils.randInt(1, 2);
        } else if (rarity === Rarity.LEGENDARY || rarity === Rarity.EPIC) {
            // Epic / Legendary: High Gold + Essence + Sacred Ashes
            returns[ResourceType.GOLD]    = Utils.randInt(120, 260);
            returns[ResourceType.ESSENCE] = Utils.randInt(15, 25);
            returns[ResourceType.ASHES]   = Utils.randInt(3, 6);
        }

        // Return extra ore/gold if the salvaged item had upgrade levels
        if (item.upgradeLevel > 0) {
            returns[ResourceType.ORE] = (returns[ResourceType.ORE] || 0) + item.upgradeLevel * 6;
            returns[ResourceType.GOLD] = (returns[ResourceType.GOLD] || 0) + item.upgradeLevel * 12;
        }

        return returns;
    }

    /**
     * Salvage a single unequipped item from inventory.
     * @param {string} itemId
     * @returns {{ success: boolean, returned?: Object, item?: Item, reason?: string }}
     */
    salvageItem(itemId) {
        const char = this.state.character;
        if (!char) return { success: false, reason: 'Nenhum campeão ativo.' };

        const idx = (char.inventory || []).findIndex(i => i && i.id === itemId);
        if (idx === -1) {
            return { success: false, reason: 'O item não se encontra na algibeira ou está equipado.' };
        }

        const item = char.inventory[idx];
        const returns = this.calculateSalvageReturns(item);

        // Remove item from inventory
        char.inventory[idx] = null;

        // Grant returned resources
        for (const [resType, amount] of Object.entries(returns)) {
            this.state.addResource(resType, amount);
        }

        char.recalculate();
        this.state.emit('character:changed', char);
        this.state.emit('item_salvaged', { item, returns, bulk: false, count: 1 });

        return { success: true, returned: returns, item };
    }

    /**
     * Bulk salvage all Common and Magic items in inventory.
     * @returns {{ success: boolean, count: number, returned?: Object, reason?: string }}
     */
    salvageCommonAndMagic() {
        const char = this.state.character;
        if (!char) return { success: false, count: 0, reason: 'Nenhum campeão ativo.' };

        const totalReturns = {};
        let count = 0;

        for (let i = 0; i < char.inventory.length; i++) {
            const item = char.inventory[i];
            if (item && (item.rarity === Rarity.COMMON || item.rarity === Rarity.MAGIC)) {
                const ret = this.calculateSalvageReturns(item);
                for (const [res, amt] of Object.entries(ret)) {
                    totalReturns[res] = (totalReturns[res] || 0) + amt;
                }
                char.inventory[i] = null;
                count++;
            }
        }

        if (count > 0) {
            for (const [res, amt] of Object.entries(totalReturns)) {
                this.state.addResource(res, amt);
            }
            char.recalculate();
            this.state.emit('character:changed', char);
            this.state.emit('item_salvaged', { item: null, returns: totalReturns, bulk: true, count });
            return { success: true, count, returned: totalReturns };
        } else {
            return {
                success: false,
                count: 0,
                reason: 'Nenhum equipamento Comum ou Mágico encontrado para desmanche.',
            };
        }
    }
}
