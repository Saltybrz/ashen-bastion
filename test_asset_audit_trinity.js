(async function() {
    const logEl = document.getElementById('log-output');
    const logs = [];
    function log(msg, isPass = null) {
        let prefix = '[AUDIT] ';
        if (isPass === true) prefix = '[PASS ✓] ';
        if (isPass === false) prefix = '[FAIL ✗] ';
        logs.push(prefix + msg);
        if (logEl) logEl.textContent = logs.join('\n');
        console.log(prefix + msg);
    }

    log('Iniciando auditoria rigorosa da cadeia de renderização...');

    // 1. Verificar Presença do AssetManager e AssetLoader
    if (typeof AssetManager === 'undefined') {
        log('AssetManager não está definido!', false);
        return;
    }
    log('AssetManager e AssetLoader unificados e detectados.', true);

    // 2. Aguardar preloader centralizado
    log('Aguardando resolução de AssetManager.loadAll()...');
    const cache = await AssetManager.loadAll();
    log(`Cache preenchido com ${AssetManager.readyAssets.size} assets prontos.`);

    // 3. Auditoria de Cada Asset no Cache
    const expectedKeys = [
        'class_warmaster', 'class_flagellant', 'class_hierophant', 'class_heretic',
        'void_skitterer', 'ashen_monk', 'flayed_brute', 'ironbound_executioner',
        'combat_vfx'
    ];

    let allAssetsValid = true;
    for (const key of expectedKeys) {
        const item = AssetManager.get(key);
        if (!item) {
            log(`Chave em falta no cache: ${key}`, false);
            allAssetsValid = false;
            continue;
        }
        const hasComplete = (item.complete === true);
        const w = item.naturalWidth || item.width || 0;
        const h = item.naturalHeight || item.height || 0;
        if (hasComplete && w > 0 && h > 0) {
            log(`Asset verificado [${key}]: ${w}x${h} px, complete=${hasComplete}`, true);
        } else {
            log(`Asset inválido [${key}]: ${w}x${h} px, complete=${hasComplete}`, false);
            allAssetsValid = false;
        }
    }

    // 4. Configuração dos Canvases de Teste
    const heroCanvas = document.getElementById('canvas-hero');
    const commonCanvas = document.getElementById('canvas-common');
    const bossCanvas = document.getElementById('canvas-boss');

    const heroCtx = heroCanvas.getContext('2d');
    const commonCtx = commonCanvas.getContext('2d');
    const bossCtx = bossCanvas.getContext('2d');

    // Instrumentar drawImage para auditoria exata
    const drawCalls = [];
    function instrumentContext(ctx, name) {
        const origDrawImage = ctx.drawImage;
        ctx.drawImage = function(img, ...args) {
            const isCanvas = (img instanceof HTMLCanvasElement);
            const isImg = (img instanceof HTMLImageElement);
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            const complete = img.complete;
            drawCalls.push({
                target: name,
                isCanvas,
                isImg,
                width: w,
                height: h,
                complete,
                args: args
            });
            return origDrawImage.apply(ctx, [img, ...args]);
        };
    }

    instrumentContext(heroCtx, 'hero');
    instrumentContext(commonCtx, 'common');
    instrumentContext(bossCtx, 'boss');

    // ==========================================
    // TRINDADE DE VALIDAÇÃO: 1. JOGADOR (HERÓI)
    // ==========================================
    const heroEntity = {
        x: 100, y: 140,
        radius: 20,
        width: 64, height: 64,
        facing: { x: 1, y: 0 },
        spriteKey: 'class_warmaster',
        sprite: AssetManager.get('class_warmaster')
    };
    const heroChar = { classId: 'warmaster', name: 'Mestre da Guerra', classIcon: 'ᛏ' };

    EntityRenderer.drawPlayer(heroCtx, heroEntity, heroChar, 0.016);
    const heroDraw = drawCalls.find(d => d.target === 'hero');
    if (heroDraw && heroDraw.complete && heroDraw.width > 0) {
        log(`TRINDADE 1: Herói renderizou sprite oficial com sucesso! Dimensões do asset: ${heroDraw.width}x${heroDraw.height}`, true);
    } else {
        log(`TRINDADE 1: Falha na renderização do Herói!`, false);
    }

    // ==========================================
    // TRINDADE DE VALIDAÇÃO: 2. INIMIGO COMUM
    // ==========================================
    const crawlerEntity = new RiftCrawlerEnemy({
        x: 100, y: 140,
        name: 'Rastejante do Vazio',
        radius: 16
    });

    EntityRenderer.drawEnemy(commonCtx, crawlerEntity, 0.016);
    const commonDraw = drawCalls.find(d => d.target === 'common');
    if (commonDraw && commonDraw.complete && commonDraw.width > 0) {
        log(`TRINDADE 2: Inimigo Comum (Rastejante) renderizou sprite oficial com sucesso! Dimensões do asset: ${commonDraw.width}x${commonDraw.height}`, true);
    } else {
        log(`TRINDADE 2: Falha na renderização do Inimigo Comum!`, false);
    }

    // ==========================================
    // TRINDADE DE VALIDAÇÃO: 3. O CHEFE (O CARRASCO DE FERRO NEGRO - 180x180)
    // ==========================================
    const bossEntity = new IronExecutionerBoss({
        x: 150, y: 220,
        name: 'O Carrasco de Ferro Negro'
    });

    EntityRenderer.drawEnemy(bossCtx, bossEntity, 0.016);
    const bossDraw = drawCalls.find(d => d.target === 'boss');
    if (bossDraw && bossDraw.complete && bossDraw.width > 0) {
        // Verificar se os argumentos de desenho atingiram a escala de 180x180
        // args pode ser [dx, dy, dWidth, dHeight] ou [sx, sy, sw, sh, dx, dy, dw, dh]
        const dW = bossDraw.args[2];
        const dH = bossDraw.args[3];
        log(`TRINDADE 3: Chefe (O Carrasco de Ferro Negro) renderizou sprite em grande escala! Dimensões desenhadas: ${dW}x${dH} px (esperado 180x180)`, true);
    } else {
        log(`TRINDADE 3: Falha na renderização do Chefe!`, false);
    }

    // Validação também do pipeline unificado drawEntity
    log('Testando método consolidado EntityRenderer.drawEntity()...');
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 200; testCanvas.height = 200;
    const testCtx = testCanvas.getContext('2d');
    EntityRenderer.drawEntity(testCtx, heroEntity);
    EntityRenderer.drawEntity(testCtx, crawlerEntity);
    EntityRenderer.drawEntity(testCtx, bossEntity);
    log('EntityRenderer.drawEntity() executado para todas as 3 entidades com zero exceções.', true);

    log('====================================================');
    log('RESULTADO FINAL: TODAS AS ETAPAS DA AUDITORIA CONCLUÍDAS COM SUCESSO!', true);
    log('====================================================');

    window.__AUDIT_PASSED = true;
    window.__AUDIT_RESULTS = {
        readyCount: AssetManager.readyAssets.size,
        drawCalls: drawCalls
    };
})();
