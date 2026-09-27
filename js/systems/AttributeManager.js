/**
 * ============================================
 *  ATTRIBUTE MANAGER
 *  Manages distribution of free attribute points,
 *  recalculates primary and secondary stats,
 *  and communicates with StateManager and UI.
 * ============================================
 */

class AttributeManager {
    /**
     * @param {StateManager} state
     */
    constructor(state) {
        /** @type {StateManager} */
        this.state = state;
        console.log('[AttributeManager] Initialized.');
    }

    get character() {
        return this.state ? this.state.character : null;
    }

    get availablePoints() {
        return this.character ? (this.character.attributePoints || 0) : 0;
    }

    /**
     * Allocate 1 attribute point to the specified primary stat.
     * Stat benefits (Phase 5 & 6):
     * - Força (strength): +2.5 Dano Físico plano e +0.4% Dano Crítico por ponto.
     * - Destreza (dexterity): +0.4% Velocidade de Ataque plano, +0.3% Chance Crítica e +0.2% Esquiva por ponto.
     * - Vitalidade (vitality): +18 de Vida Máxima plana e +0.8 de Armadura por ponto.
     * - Fé / Éter (faith / intelligence): +12 de Mana Máxima e +1.8 de Dano Arcano por ponto.
     * 
     * @param {'strength'|'dexterity'|'vitality'|'faith'|'intelligence'} stat
     * @returns {{ success: boolean, reason?: string, stat?: string, pointsRemaining?: number }}
     */
    spendPoint(stat) {
        const char = this.character;
        if (!char) return { success: false, reason: 'Nenhum herói ativo.' };
        if ((char.attributePoints || 0) <= 0) {
            return { success: false, reason: 'Sem pontos livres de atributo.' };
        }

        const validStats = ['strength', 'dexterity', 'vitality', 'faith', 'intelligence'];
        if (!validStats.includes(stat)) {
            return { success: false, reason: 'Atributo inválido.' };
        }

        // Deduct 1 free attribute point
        char.attributePoints--;

        // Ensure allocated stats container exists
        if (!char.allocatedStats) {
            char.allocatedStats = { strength: 0, dexterity: 0, vitality: 0, faith: 0, intelligence: 0 };
        }
        char.allocatedStats[stat] = (char.allocatedStats[stat] || 0) + 1;

        // Recalculate secondary and derived combat stats in real-time
        if (typeof char.recalculateDerivedStats === 'function') {
            char.recalculateDerivedStats();
        } else {
            char.recalculate();
        }

        // Emit state change and persist
        this.state.emit('character:changed', char);
        this.state.save();

        return {
            success: true,
            stat,
            pointsRemaining: char.attributePoints,
            newStatValue: char.stats[stat] || char.baseStats[stat],
        };
    }
}

// Global exposure
if (typeof window !== 'undefined') {
    window.AttributeManager = AttributeManager;
}

console.log('[System] AttributeManager loaded.');
