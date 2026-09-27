/**
 * ============================================
 *  SKILL TREE MANAGER
 *  Handles spending skill points, tier validation,
 *  modifier/mutation toggles, and respec with idle costs.
 * ============================================
 */

class SkillTreeManager {
    /**
     * @param {StateManager} state
     */
    constructor(state) {
        /** @type {StateManager} */
        this.state = state;
        console.log('[SkillTreeManager] Initialized.');
    }

    /**
     * Current character reference.
     * @returns {Character|null}
     */
    get character() {
        return this.state.character;
    }

    /**
     * Current skill tree reference.
     * @returns {SkillTree|null}
     */
    get skillTree() {
        return this.character ? this.character.skillTree : null;
    }

    /**
     * Validate if a skill can be unlocked.
     * @param {string} skillId
     * @returns {{ valid: boolean, reason?: string }}
     */
    validatePrereqs(skillId) {
        const char = this.character;
        if (!char) return { valid: false, reason: 'Nenhum personagem ativo.' };

        const tree = this.skillTree;
        if (!tree) return { valid: false, reason: 'Árvore de habilidades inexistente.' };

        const skill = tree.getSkill(skillId);
        if (!skill) return { valid: false, reason: `Habilidade '${skillId}' não encontrada.` };

        if (skill.unlocked) {
            return { valid: false, reason: 'Habilidade já desbloqueada.' };
        }

        const progression = char.progression;
        if (progression.skillPoints <= 0) {
            return { valid: false, reason: 'Pontos de habilidade insuficientes.' };
        }

        if (progression.level < skill.requiredLevel) {
            return {
                valid: false,
                reason: `Requer Nível ${skill.requiredLevel} (Você está no Nível ${progression.level}).`
            };
        }

        // Tier prerequisite check: tier N requires tier N-1 unlocked
        if (skill.tier > 1) {
            const previousTierSkill = tree.getSkillByTier(skill.tier - 1);
            if (previousTierSkill && !previousTierSkill.unlocked) {
                return {
                    valid: false,
                    reason: `Requer desbloqueio da habilidade de Tier ${skill.tier - 1} (${previousTierSkill.name}).`
                };
            }
        }

        return { valid: true };
    }

    /**
     * Spend 1 skill point to unlock a skill.
     * @param {string} skillId
     * @returns {{ success: boolean, reason?: string, skill?: Skill }}
     */
    spendPoint(skillId) {
        const validation = this.validatePrereqs(skillId);
        if (!validation.valid) {
            return { success: false, reason: validation.reason };
        }

        const char = this.character;
        const skill = this.skillTree.getSkill(skillId);

        // Deduct 1 skill point
        char.progression.skillPoints--;
        skill.unlocked = true;

        // If it has modifiers and none is selected, select the first
        if (skill.modifiers && skill.modifiers.length > 0 && !skill.activeModifierId) {
            skill.activeModifierId = skill.modifiers[0].id;
        }

        // Notify state
        this.state.emit('skill:unlocked', { skillId, skill, remainingPoints: char.progression.skillPoints });
        this.state.emit('skilltree:updated', { tree: this.skillTree });
        this.state.emit('character:changed', char);

        return { success: true, skill };
    }

    /**
     * Toggle or select an active modifier / mutation variant for a skill.
     * @param {string} skillId
     * @param {string} modifierId
     * @returns {{ success: boolean, reason?: string, modifier?: SkillModifier }}
     */
    toggleModifier(skillId, modifierId) {
        const tree = this.skillTree;
        if (!tree) return { success: false, reason: 'Árvore de habilidades não encontrada.' };

        const skill = tree.getSkill(skillId);
        if (!skill) return { success: false, reason: 'Habilidade não encontrada.' };

        // Allow modifier selection if root skill is unlocked, allocated, or level >= 1
        const isUnlocked = skill.unlocked === true || 
                           (typeof skill.level === 'number' && skill.level >= 1) || 
                           skill.isAllocated === true || 
                           (typeof skill.allocated === 'number' && skill.allocated > 0);

        if (!isUnlocked) {
            return { success: false, reason: 'Habilidade precisa estar desbloqueada para alterar modificadores.' };
        }

        const modifier = skill.modifiers.find(m => m.id === modifierId);
        if (!modifier) {
            return { success: false, reason: 'Modificador não pertence a esta habilidade.' };
        }

        skill.setActiveModifier(modifierId);

        // Save active mutation in character object for persistence
        if (this.character) {
            if (!this.character.activeMutations) {
                this.character.activeMutations = {};
            }
            this.character.activeMutations[skillId] = modifierId;
        }

        this.state.emit('skill:modifier_toggled', { skillId, modifierId, modifier });
        this.state.emit('skilltree:updated', { tree });
        this.state.emit('character:changed', this.character);

        return { success: true, modifier };
    }

    /**
     * Respec (Reset) the entire skill tree, returning all spent points.
     * Consumes Idle resources (Gold and Ore).
     * @returns {{ success: boolean, reason?: string, refundedPoints?: number, cost?: Object }}
     */
    respec() {
        const char = this.character;
        if (!char) return { success: false, reason: 'Nenhum personagem ativo.' };

        const tree = this.skillTree;
        if (!tree) return { success: false, reason: 'Árvore de habilidades não encontrada.' };

        const cost = char.progression.getRespecCost();

        // Check if player can afford the respec cost
        if ((this.state.resources[ResourceType.GOLD] || 0) < cost.gold) {
            return {
                success: false,
                reason: `Ouro insuficiente para redistribuição. Requer ${cost.gold} 🜚 Ouro.`,
                cost
            };
        }

        if ((this.state.resources[ResourceType.ORE] || 0) < cost.ore) {
            return {
                success: false,
                reason: `Minério insuficiente para redistribuição. Requer ${cost.ore} 🜛 Ferro/Minério.`,
                cost
            };
        }

        // Deduct resources
        this.state.spendResource(ResourceType.GOLD, cost.gold);
        this.state.spendResource(ResourceType.ORE, cost.ore);

        // Reset the skill tree
        const refundedPoints = tree.reset();

        // Tier 1 always stays unlocked as the base fundamental skill
        const tier1Skill = tree.getSkillByTier(1);
        let actualRefunded = refundedPoints;
        if (tier1Skill) {
            tier1Skill.unlocked = true;
            actualRefunded = Math.max(0, refundedPoints - 1);
        }

        // Refund points back to player
        char.progression.skillPoints += actualRefunded;

        // Record respec increment
        char.progression.recordRespec();

        this.state.emit('skilltree:respec', {
            refundedPoints: actualRefunded,
            currentPoints: char.progression.skillPoints,
            cost,
        });
        this.state.emit('skilltree:updated', { tree });
        this.state.emit('character:changed', char);

        return {
            success: true,
            refundedPoints: actualRefunded,
            currentPoints: char.progression.skillPoints,
            cost,
        };
    }

    /**
     * Get all currently unlocked skills.
     * @returns {Skill[]}
     */
    getActiveSkills() {
        return this.skillTree ? this.skillTree.getActiveSkills() : [];
    }

    /**
     * Get skill by ID.
     * @param {string} skillId
     * @returns {Skill|null}
     */
    getSkill(skillId) {
        return this.skillTree ? this.skillTree.getSkill(skillId) : null;
    }
}

console.log('[System] SkillTreeManager loaded.');
