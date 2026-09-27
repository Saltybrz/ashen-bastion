/**
 * ============================================
 *  LOOT TABLE
 *  Drop tables for enemies, chests, and bosses.
 * ============================================
 */

class LootTable {
    /**
     * Roll loot for an enemy kill according to the exact weighted distribution:
     * - 70% chance: Direct Gold and forge materials (Wood, Iron Ore).
     * - 25% chance: Common or Magic equipment item.
     * - 5% chance: Rare equipment item or extra Rift Key.
     * 
     * @param {number} floorLevel
     * @param {object} [difficultyConfig=null]
     * @returns {Item[]}
     */
    static rollEnemyLoot(floorLevel, difficultyConfig = null) {
        const drops = [];
        const roll = Math.random();

        // 70% chance (0.00 to 0.70): Gold and Forge Materials
        if (roll < 0.70) {
            // Gold
            drops.push(new Item({
                name: 'Ouro',
                type: ItemType.MATERIAL,
                rarity: Rarity.COMMON,
                icon: '🜚',
                stackable: true,
                quantity: Utils.randInt(5 + floorLevel * 2, 12 + floorLevel * 3),
            }));

            // Forge material: 50% Wood, 50% Black Iron Ore
            const isWood = Math.random() < 0.5;
            drops.push(new Item({
                name: isWood ? 'Madeira Rúnica' : 'Ferro Negro',
                type: ItemType.MATERIAL,
                rarity: Rarity.COMMON,
                icon: isWood ? 'ᚱ' : '🜛',
                stackable: true,
                quantity: Utils.randInt(2 + floorLevel, 5 + floorLevel),
            }));
        }
        // 25% chance (0.70 to 0.95): Equipment item (Common or Magic)
        else if (roll < 0.95) {
            const isMagic = Math.random() < (0.45 + (difficultyConfig?.magicDropBonus || 0));
            const rarity = isMagic ? Rarity.MAGIC : Rarity.COMMON;
            drops.push(Item.generate(floorLevel, rarity));
        }
        // 5% chance (0.95 to 1.00): Rare equipment item or Extra Rift Key
        else {
            if (Math.random() < 0.5) {
                // Rare Item
                drops.push(Item.generate(floorLevel + 1, Rarity.RARE));
            } else {
                // Extra Rift Key
                drops.push(new Item({
                    name: 'Chave da Fenda',
                    type: ItemType.KEY,
                    rarity: Rarity.RARE,
                    icon: '⚿',
                    stackable: true,
                    quantity: 1,
                }));
            }
        }

        return drops;
    }

    /**
     * Roll loot for a treasure chest.
     * @param {number} floorLevel
     * @returns {Item[]}
     */
    static rollChestLoot(floorLevel) {
        const drops = [];
        // Guaranteed materials
        drops.push(new Item({
            name: 'Materiais',
            type: ItemType.MATERIAL,
            rarity: Rarity.COMMON,
            icon: 'ᛟ',
            stackable: true,
            quantity: Utils.randInt(5, 15),
        }));
        // 50% chance for Rare or better
        if (Math.random() < 0.50) {
            const rarity = Math.random() < 0.15 ? Rarity.EPIC : Rarity.RARE;
            drops.push(Item.generate(floorLevel, rarity));
        }
        // 25% another item
        if (Math.random() < 0.25) {
            drops.push(Item.generate(floorLevel));
        }
        return drops;
    }

    /**
     * Roll loot for a boss kill (Loot Explosion).
     * @param {number} floorLevel
     * @param {object} [difficultyConfig]
     * @returns {Item[]}
     */
    static rollBossLoot(floorLevel, difficultyConfig = null) {
        const drops = [];

        // Guaranteed 2-4 items of Rare+ quality
        const count = Utils.randInt(2, 4);
        for (let i = 0; i < count; i++) {
            const roll = Math.random();
            let rarity;
            const legChance = difficultyConfig?.id === 'abyssal' ? 0.15 : (difficultyConfig?.id === 'veteran' ? 0.08 : 0.05);
            const epicChance = difficultyConfig?.id === 'abyssal' ? 0.45 : (difficultyConfig?.id === 'veteran' ? 0.30 : 0.20);

            if (roll < legChance)       rarity = Rarity.LEGENDARY;
            else if (roll < epicChance) rarity = Rarity.EPIC;
            else                        rarity = Rarity.RARE;

            drops.push(Item.generate(floorLevel + 2, rarity));
        }

        // Guaranteed Gold
        drops.push(new Item({
            name: 'Ouro do Titã',
            type: ItemType.MATERIAL,
            rarity: Rarity.RARE,
            icon: '🜚',
            stackable: true,
            quantity: Utils.randInt(50 + floorLevel * 10, 100 + floorLevel * 20),
        }));

        // 40% chance for Núcleo de Titã
        if (Math.random() < 0.40) {
            drops.push(new Item({
                name: 'Núcleo de Titã',
                type: ItemType.MATERIAL,
                rarity: Rarity.LEGENDARY,
                icon: 'ᛟ',
                stackable: true,
                quantity: 1,
            }));
        }

        // Guaranteed Rift Key for clearing the boss
        drops.push(new Item({
            name: 'Chave da Fenda',
            type: ItemType.KEY,
            rarity: Rarity.RARE,
            icon: '⚿',
            stackable: true,
            quantity: 1,
        }));

        return drops;
    }
}

console.log('[Model] LootTable loaded.');
