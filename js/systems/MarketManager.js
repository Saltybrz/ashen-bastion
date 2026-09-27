/**
 * ============================================
 *  MARKET MANAGER (A Feira das Cinzas)
 *  In Search of Hope: The Ashen Bastion
 *  Handles raw resource barter with friction margins,
 *  and provision merchant with rotating rare supplies.
 * ============================================
 */

class MarketManager {
    /**
     * @param {StateManager} state
     */
    constructor(state) {
        /** @type {StateManager} */
        this.state = state;

        this.barterRates = BARTER_RATES;
        this.provisions  = MARKET_PROVISIONS;

        console.log('[MarketManager] Feira das Cinzas aberta para comércio.');
    }

    /**
     * Execute barter exchange of resources.
     * @param {'wood_to_ore' | 'ore_to_gold' | 'gold_to_wood'} rateId
     * @param {number} times Multiplier (e.g. 1 or 10)
     * @returns {{ success: boolean, spent?: Object, gained?: Object, reason?: string }}
     */
    barter(rateId, times = 1) {
        const rate = this.barterRates[rateId];
        if (!rate) return { success: false, reason: 'Taxa de permuta desconhecida.' };

        const fromCost = rate.fromAmount * times;
        const toGain   = rate.toAmount * times;

        const currentAvailable = this.state.resources[rate.from] || 0;
        if (currentAvailable < fromCost) {
            const metaFrom = RESOURCE_META[rate.from]?.label || rate.from;
            return {
                success: false,
                reason: `Recurso insuficiente. Requer ${fromCost} de ${metaFrom}.`,
            };
        }

        // Deduct and add
        this.state.spendResource(rate.from, fromCost);
        this.state.addResource(rate.to, toGain);

        this.state.emit('resource_traded', {
            rateId,
            fromResource: rate.from,
            fromAmount: fromCost,
            toResource: rate.to,
            toAmount: toGain,
            times,
        });

        return {
            success: true,
            spent: { resource: rate.from, amount: fromCost },
            gained: { resource: rate.to, amount: toGain },
        };
    }

    /**
     * Buy a Rift Key from the provision merchant.
     * @param {number} count
     * @returns {{ success: boolean, count?: number, cost?: number, reason?: string }}
     */
    buyRiftKey(count = 1) {
        const item = this.provisions.key;
        const totalGold = item.goldCost * count;
        const currentGold = this.state.resources[ResourceType.GOLD] || 0;

        if (currentGold < totalGold) {
            return {
                success: false,
                reason: `Ouro insuficiente. Requer 🜚 ${totalGold} Ouro para adquirir ${count} chave(s).`,
            };
        }

        this.state.spendResource(ResourceType.GOLD, totalGold);
        if (typeof this.state.addKeys === 'function') {
            this.state.addKeys(count);
        } else {
            this.state.dungeonKeys = (this.state.dungeonKeys || 0) + count;
            this.state.emit('keys:changed', this.state.dungeonKeys);
        }

        this.state.emit('provision_purchased', {
            itemId: 'key',
            name: item.name,
            count,
            goldCost: totalGold,
        });

        return { success: true, count, cost: totalGold };
    }

    /**
     * Buy a rare reagent from limited merchant stock.
     * @param {'essence' | 'ashes'} reagentId
     * @param {number} count
     * @returns {{ success: boolean, reason?: string }}
     */
    buyReagent(reagentId, count = 1) {
        const item = this.provisions[reagentId];
        if (!item) return { success: false, reason: 'Mercadoria não catalogada.' };

        const currentStock = this.state.marketStock[reagentId] || 0;
        if (currentStock < count) {
            return { success: false, reason: `Estoque esgotado para ${item.name}. Aguarde ou renove o estoque.` };
        }

        const totalCost = item.goldCost * count;
        const currentGold = this.state.resources[ResourceType.GOLD] || 0;

        if (currentGold < totalCost) {
            return { success: false, reason: `Ouro insuficiente. Requer 🜚 ${totalCost} Ouro.` };
        }

        this.state.spendResource(ResourceType.GOLD, totalCost);
        this.state.marketStock[reagentId] -= count;

        const targetResource = reagentId === 'essence' ? ResourceType.ESSENCE : ResourceType.ASHES;
        this.state.addResource(targetResource, count);

        this.state.emit('provision_purchased', {
            itemId: reagentId,
            name: item.name,
            count,
            goldCost: totalCost,
            remainingStock: this.state.marketStock[reagentId],
        });

        return { success: true, count, cost: totalCost, remainingStock: this.state.marketStock[reagentId] };
    }

    /**
     * Replenish rare merchant stock for a small fee in gold.
     * @param {number} fee
     * @returns {{ success: boolean, reason?: string }}
     */
    restock(fee = 50) {
        const currentGold = this.state.resources[ResourceType.GOLD] || 0;
        if (currentGold < fee) {
            return { success: false, reason: `Tributo insuficiente para caravana. Requer 🜚 ${fee} Ouro.` };
        }

        this.state.spendResource(ResourceType.GOLD, fee);
        this.state.marketStock.essence = this.provisions.essence.maxStock;
        this.state.marketStock.ashes   = this.provisions.ashes.maxStock;
        this.state.marketStock.lastRestock = Date.now();

        this.state.emit('market_restocked', {
            stock: this.state.marketStock,
        });

        return { success: true, stock: this.state.marketStock };
    }
}
