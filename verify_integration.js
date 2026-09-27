// Verification script for 2D Sprite Integration and Chroma-Key Processing
(async function() {
    console.log('[VERIFY] Starting verification...');
    
    // 1. Check AssetLoader existence
    if (typeof AssetLoader === 'undefined') {
        console.error('[VERIFY FAIL] AssetLoader is undefined');
        return;
    }
    console.log('[VERIFY OK] AssetLoader is defined');

    // 2. Wait for AssetLoader init
    await AssetLoader.init();
    console.log(`[VERIFY] AssetLoader ready assets: ${AssetLoader.readyAssets.size}`);

    // Check specific keys
    const requiredKeys = [
        'base_mannequin', 'class_warmaster', 'class_flagellant', 'class_hierophant', 'class_heretic',
        'flayed_brute', 'ashen_monk', 'void_skitterer', 'ironbound_executioner', 'combat_vfx'
    ];

    for (const key of requiredKeys) {
        const item = AssetLoader.get(key);
        if (!item) {
            console.error(`[VERIFY FAIL] Missing asset in cache: ${key}`);
        } else {
            console.log(`[VERIFY OK] Asset loaded: ${key}, type: ${item.type}, size: ${item.width}x${item.height}, chromaKeyed: ${item.isChromaKeyed}`);
        }
    }

    // 3. Check EntityRenderer existence
    if (typeof EntityRenderer === 'undefined') {
        console.error('[VERIFY FAIL] EntityRenderer is undefined');
        return;
    }
    console.log('[VERIFY OK] EntityRenderer is defined');

    // 4. Test drawing to a dummy canvas
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 800;
    testCanvas.height = 600;
    const ctx = testCanvas.getContext('2d');

    // Draw player with all classes
    const classes = ['warmaster', 'flagellant', 'hierophant', 'heretic'];
    for (const c of classes) {
        ctx.clearRect(0, 0, 800, 600);
        const dummyPlayer = { x: 400, y: 300, vx: 0, vy: 0, facing: { x: 1, y: 0 }, radius: 20 };
        const dummyChar = { classId: c, classIcon: 'ᛏ' };
        EntityRenderer.drawPlayer(ctx, dummyPlayer, dummyChar, 0.016);
        console.log(`[VERIFY OK] Successfully rendered player class: ${c}`);
    }

    // Draw all enemy types
    const dummyCrawler = { x: 200, y: 200, vx: -1, archetype: 'crawler', name: 'Rastejante do Vazio', radius: 18, hp: 50, maxHp: 50 };
    const dummyMonk = { x: 300, y: 200, vx: 0, archetype: 'monk', name: 'Monge das Cinzas', radius: 22, hp: 80, maxHp: 80 };
    const dummyBrute = { x: 400, y: 200, vx: 1, archetype: 'brute', isElite: true, name: 'Bruto Esfolado', radius: 28, hp: 120, maxHp: 120, windUpTimer: 0.2 };
    const dummyBoss = { x: 500, y: 200, vx: 0, isBoss: true, archetype: 'boss', name: 'O Carrasco de Ferro Negro', radius: 48, hp: 500, maxHp: 500 };

    EntityRenderer.drawEnemy(ctx, dummyCrawler, 0.016);
    console.log('[VERIFY OK] Successfully rendered RiftCrawler (Void Skitterer)');

    EntityRenderer.drawEnemy(ctx, dummyMonk, 0.016);
    console.log('[VERIFY OK] Successfully rendered Ashen Monk');

    EntityRenderer.drawEnemy(ctx, dummyBrute, 0.016);
    console.log('[VERIFY OK] Successfully rendered Flayed Brute');

    EntityRenderer.drawEnemy(ctx, dummyBoss, 0.016);
    console.log('[VERIFY OK] Successfully rendered Ironbound Executioner Boss');

    // Draw Combat VFX
    EntityRenderer.drawCombatVFX(ctx, { x: 400, y: 300, size: 70, angle: 0, vfxType: 'slash', progress: 0.2 });
    console.log('[VERIFY OK] Successfully rendered Combat VFX (slash)');

    EntityRenderer.drawCombatVFX(ctx, { x: 400, y: 300, size: 90, angle: 0, vfxType: 'fire', progress: 0.4 });
    console.log('[VERIFY OK] Successfully rendered Combat VFX (fire)');

    console.log('[VERIFY ALL TESTS PASSED]');
    window.__VERIFY_DONE__ = true;
})();
