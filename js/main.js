/**
 * ============================================
 *  MAIN — Application Entry Point
 *  Wires together all systems, coordinates the
 *  Gothic Onboarding State Machine (Title,
 *  Prologue, Class, Difficulty) and starts
 *  the game loop.
 * ============================================
 */

// ─── Global System References ───
let uiManager         = null;
let idleEngine        = null;
let dungeonEngine     = null;
let hubUI             = null;
let dungeonUI         = null;
let blacksmithManager = null;
let alchemyManager    = null;
let marketManager     = null;
let bountyManager     = null;
let campServicesUI    = null;
let aiDialogueSystem  = null;
let gameStarted       = false;
let onboardingInitialized = false;

/**
 * 1. Sistema de Pré-Carregamento com Timeout de Segurança (Fail-Safe)
 * Regra Absoluta: O ecrã de carregamento nunca pode bloquear a entrada no jogo
 * por mais de 2 segundos, mesmo que imagens ou dados falhem completamente.
 * @param {string} src
 * @param {number} [timeoutMs=1500]
 * @returns {Promise<{ img: HTMLImageElement|null, loaded: boolean }>}
 */
function loadGameAsset(src, timeoutMs = 1500) {
    return new Promise((resolve) => {
        let settled = false;
        const settle = (result) => {
            if (!settled) {
                settled = true;
                resolve(result);
            }
        };

        const img = new Image();
        // Se carregar com sucesso:
        img.onload = () => settle({ img, loaded: true });
        // Se falhar (ficheiro em falta, erro 404):
        img.onerror = () => {
            console.warn(`[Aviso] Falha ao carregar o asset: ${src}. A usar fallback procedural.`);
            settle({ img: null, loaded: false });
        };
        img.src = src;

        // Timeout de emergência: se demorar mais de 1.5s, força a continuação
        setTimeout(() => {
            if (!settled) {
                console.warn(`[Aviso] Timeout de emergência (${timeoutMs}ms) ao carregar asset: ${src}. Forçando continuação.`);
                settle({ img: null, loaded: false });
            }
        }, timeoutMs);
    });
}
window.loadGameAsset = loadGameAsset;

/**
 * 2. Tratamento Global de Erros no Arranque (bootstrapGame / initGame)
 * Envolve todo o arranque dentro de um bloco try / catch / finally à prova de falhas.
 */
async function initGame() {
    const loadingScreen = document.getElementById('loading-screen') || document.querySelector('.loading-screen');
    const progressBar   = document.querySelector('.loading-bar-fill') || document.getElementById('loading-bar') || document.querySelector('.loading-bar');
    const loadingText   = document.getElementById('loading-text');

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  In Search of Hope: The Ashen Bastion                  ║');
    console.log('║  Fail-Safe Preloader & Bootstrap Engine                ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    try {
        if (progressBar) progressBar.style.width = '30%';
        if (loadingText) loadingText.textContent = 'Invocando glifos ancestrais e restaurando penitência...';

        // 1. Carrega as configurações globais e o estado salvo de forma segura
        if (typeof SettingsManager !== 'undefined' && typeof SettingsManager.init === 'function') {
            SettingsManager.init();
        }
        if (typeof StateManager !== 'undefined' && typeof StateManager.load === 'function') {
            StateManager.load();
        } else if (typeof gameState !== 'undefined') {
            gameState.load();
        }

        if (progressBar) progressBar.style.width = '60%';
        if (loadingText) loadingText.textContent = 'Pré-carregando mapa do Pátio do Bastião...';

        // 2. Tenta carregar o mapa do Hub sem bloquear
        const hubMap = await loadGameAsset('./assets/maps/hub_courtyard.jpg', 1500);
        if (typeof HubEngine !== 'undefined' && typeof HubEngine.init === 'function') {
            HubEngine.init(hubMap);
        }

        if (progressBar) progressBar.style.width = '75%';
        if (loadingText) loadingText.textContent = 'Consolidando cache de texturas e sprites 2D...';

        // 2.1 Centralized 2D Sprite Asset Loading with Rigid Promises
        if (typeof AssetManager !== 'undefined' && typeof AssetManager.loadAll === 'function') {
            await AssetManager.loadAll();
        } else if (typeof AssetLoader !== 'undefined' && typeof AssetLoader.init === 'function') {
            await AssetLoader.init();
        }

        if (progressBar) progressBar.style.width = '90%';
        if (loadingText) loadingText.textContent = 'Erguendo o acampamento nas cinzas...';

        // 3. Inicializa todos os subsistemas e UI
        bootstrapCoreSystems(hubMap);

        if (progressBar) progressBar.style.width = '100%';
        if (loadingText) loadingText.textContent = 'Os portões foram abertos.';

    } catch (err) {
        console.error('[ERRO CRÍTICO NO BOOTSTRAP]:', err);
    } finally {
        // 4. Força SEMPRE a remoção do ecrã de carregamento após uma breve pausa estética
        setTimeout(() => {
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                loadingScreen.classList.add('fade-out');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                    loadingScreen.classList.add('hidden');
                }, 400);
            }
        }, 500);
    }
}

// Global aliases
window.initGame = initGame;
window.bootstrapGame = initGame;

// Disparar o arranque assim que o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

/**
 * Initializes and wires core game engine managers.
 * @param {{ img: HTMLImageElement|null, loaded: boolean }} [hubMap]
 */
function bootstrapCoreSystems(hubMap) {
    if (!uiManager && typeof UIManager !== 'undefined' && typeof gameState !== 'undefined') {
        uiManager = new UIManager(gameState);
        window.uiManager = uiManager;
    }
    if (!idleEngine && typeof IdleEngine !== 'undefined' && typeof gameState !== 'undefined') {
        idleEngine = new IdleEngine(gameState);
        window.idleEngine = idleEngine;
    }
    if (!dungeonEngine && typeof DungeonEngine !== 'undefined' && typeof gameState !== 'undefined') {
        dungeonEngine = new DungeonEngine(gameState);
        window.dungeonEngine = dungeonEngine;
    }
    if (!blacksmithManager && typeof BlacksmithManager !== 'undefined' && typeof gameState !== 'undefined') {
        blacksmithManager = new BlacksmithManager(gameState);
        window.blacksmithManager = blacksmithManager;
    }
    if (!alchemyManager && typeof AlchemyManager !== 'undefined' && typeof gameState !== 'undefined') {
        alchemyManager = new AlchemyManager(gameState);
        window.alchemyManager = alchemyManager;
    }
    if (!marketManager && typeof MarketManager !== 'undefined' && typeof gameState !== 'undefined') {
        marketManager = new MarketManager(gameState);
        window.marketManager = marketManager;
    }
    if (!bountyManager && typeof BountyManager !== 'undefined' && typeof gameState !== 'undefined') {
        bountyManager = new BountyManager(gameState);
        window.bountyManager = bountyManager;
    }
    if (!hubUI && typeof HubUI !== 'undefined' && typeof gameState !== 'undefined') {
        hubUI = new HubUI(gameState, idleEngine, uiManager);
        window.hubUI = hubUI;
        if (hubMap && typeof hubUI.initCourtyardMap === 'function') {
            hubUI.initCourtyardMap(hubMap);
        }
    }
    if (!dungeonUI && typeof DungeonUI !== 'undefined' && typeof gameState !== 'undefined') {
        dungeonUI = new DungeonUI(gameState, dungeonEngine, uiManager);
        window.dungeonUI = dungeonUI;
    }
    if (!campServicesUI && typeof CampServicesUI !== 'undefined' && typeof gameState !== 'undefined') {
        campServicesUI = new CampServicesUI(gameState, blacksmithManager, alchemyManager, marketManager, bountyManager, uiManager);
        window.campServicesUI = campServicesUI;
    }

    // Connect HubEngine with HubUI
    if (window.HubEngine && window.hubUI && window.HubEngine.hubMapAsset) {
        window.hubUI.initCourtyardMap(window.HubEngine.hubMapAsset);
    }

    // Initialize Gothic Settings UI Modal
    if (typeof SettingsUI !== 'undefined' && typeof SettingsUI.init === 'function') {
        SettingsUI.init();
    }

    // Initialize AI Dialogue System (Oracle & Smart NPCs via Vercel Gemini)
    if (typeof AIDialogueSystem !== 'undefined') {
        aiDialogueSystem = new AIDialogueSystem(gameState);
        aiDialogueSystem.init();
        window.aiDialogueSystem = aiDialogueSystem;
    }

    // Setup Onboarding State Machine (Title Screen, Prologue, etc.)
    setupOnboardingFlow();
}

/**
 * Coordinates the opening State Machine:
 * Stage A: Gothic Title Screen
 * Stage B: Dark Fantasy Narrative Prologue
 * Stage C: Monolithic Class Selection
 * Stage D: Rift Difficulty Oath & Explicit Save Overwrite
 */
function setupOnboardingFlow() {
    if (onboardingInitialized) return;
    onboardingInitialized = true;

    // Canonical narrative prologue for In Search of Hope
    const PROLOGUE_TEXT = {
        p1: "O sol se pôs pela última vez há séculos. Nas profundezas da Fenda Abissal, não restam deuses ou reis — apenas cinzas e ecos de quem um dia teve fé.",
        p2: "Sobre as ruínas do Último Bastião, você empunha sua lâmina não pela glória, mas pela mais rara e perigosa das loucuras humanas:",
        p3: "A busca pela esperança."
    };

    if (uiManager && uiManager.dom) {
        if (uiManager.dom.prologueP1) uiManager.dom.prologueP1.textContent = PROLOGUE_TEXT.p1;
        if (uiManager.dom.prologueP2) uiManager.dom.prologueP2.textContent = PROLOGUE_TEXT.p2;
        if (uiManager.dom.prologueP3) uiManager.dom.prologueP3.textContent = PROLOGUE_TEXT.p3;
    }

    function getSaveSummary() {
        if (!gameState || !gameState.hasSave()) return null;
        try {
            const raw = localStorage.getItem('in_search_of_hope_save') || localStorage.getItem('tlb_save');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.character) {
                    const cDef = (typeof CLASS_DEFINITIONS !== 'undefined') ? CLASS_DEFINITIONS[parsed.character.classId] : null;
                    const cName = cDef ? cDef.name : 'Campeão';
                    const dDef = (typeof DIFFICULTY_DEFINITIONS !== 'undefined') ? DIFFICULTY_DEFINITIONS[parsed.difficulty] : null;
                    const dName = dDef ? dDef.name : 'Peregrino';
                    return `${cName} • Nv. ${parsed.character.level || 1} • ${dName}`;
                }
            }
        } catch (e) {
            console.warn('[Main] Error inspecting save metadata:', e);
        }
        return 'Penitência Gravada';
    }

    let saveSummary = getSaveSummary();

    // Show Stage A: Title Screen (Cinematic)
    if (uiManager && typeof uiManager.showTitleScreen === 'function') {
        uiManager.showTitleScreen(!!saveSummary, saveSummary);
    }
    // Start general background theme across title screen and onboarding
    if (window.AudioManager && typeof window.AudioManager.playMusic === 'function') {
        window.AudioManager.playMusic('general');
    }
    // Initialize the cinematic particle system
    if (typeof TitleScreenFX !== 'undefined' && typeof TitleScreenFX.init === 'function') {
        TitleScreenFX.init();
    }

    // ─── Title Screen Handlers ───
    const btnTitleContinue = document.getElementById('btn-title-continue');
    if (btnTitleContinue) {
        btnTitleContinue.addEventListener('click', () => {
            if (gameState && gameState.hasSave()) {
                const loaded = gameState.load();
                if (loaded && gameState.character) {
                    console.log('[Main] Resuming saved penitence with cinematic fade.');
                    // Cinematic fade-to-black, then enter game
                    if (typeof TitleScreenFX !== 'undefined' && typeof TitleScreenFX.fadeToBlack === 'function') {
                        TitleScreenFX.fadeToBlack(() => {
                            if (uiManager) uiManager.hideAllOnboardingScreens();
                            startGame();
                        });
                    } else {
                        if (uiManager) uiManager.hideAllOnboardingScreens();
                        startGame();
                    }
                } else {
                    if (uiManager) uiManager.notify('Falha ao restaurar penitência das cinzas.', 'error');
                }
            }
        });
    }

    const btnTitleSettings = document.getElementById('btn-title-settings');
    if (btnTitleSettings) {
        btnTitleSettings.addEventListener('click', () => {
            if (window.SettingsUI) {
                window.SettingsUI.open('audio');
            }
        });
    }

    const btnTitleNew = document.getElementById('btn-title-new');
    if (btnTitleNew) {
        btnTitleNew.addEventListener('click', () => {
            gameStarted = false;
            // Cinematic fade-to-black, then show prologue
            if (typeof TitleScreenFX !== 'undefined' && typeof TitleScreenFX.fadeToBlack === 'function') {
                TitleScreenFX.fadeToBlack(() => {
                    if (uiManager) {
                        uiManager.hideTitleScreen();
                        uiManager.playPrologueSequence();
                    }
                });
            } else {
                if (uiManager) {
                    uiManager.hideTitleScreen();
                    uiManager.playPrologueSequence();
                }
            }
        });
    }

    // ─── Prologue Handlers ───
    const btnContinuePrologue = document.getElementById('btn-continue-prologue');
    if (btnContinuePrologue) {
        btnContinuePrologue.addEventListener('click', () => {
            if (uiManager) {
                uiManager.hidePrologue();
                uiManager.showBloodlineSelection();
            }
        });
    }

    const btnSkipPrologue = document.getElementById('btn-skip-prologue');
    if (btnSkipPrologue) {
        btnSkipPrologue.addEventListener('click', () => {
            if (uiManager) {
                uiManager.hidePrologue();
                uiManager.showBloodlineSelection();
            }
        });
    }

    // ─── Bloodline Selection Handlers (Etapa I) ───
    const btnBloodlineBack = document.getElementById('btn-bloodline-back');
    if (btnBloodlineBack) {
        btnBloodlineBack.addEventListener('click', () => {
            if (uiManager) {
                uiManager.hideBloodlineSelection();
                saveSummary = getSaveSummary();
                uiManager.showTitleScreen(!!saveSummary, saveSummary);
                if (typeof TitleScreenFX !== 'undefined') TitleScreenFX.init();
            }
        });
    }

    const btnConfirmBloodline = document.getElementById('btn-confirm-bloodline');
    if (btnConfirmBloodline) {
        btnConfirmBloodline.addEventListener('click', () => {
            if (uiManager) {
                uiManager.hideBloodlineSelection();
                uiManager.showClassSelection();
            }
        });
    }

    // ─── Class Selection Handlers (Etapa II) ───
    const btnClassBack = document.getElementById('btn-class-back');
    if (btnClassBack) {
        btnClassBack.addEventListener('click', () => {
            if (uiManager) {
                uiManager.hideClassSelection();
                uiManager.showBloodlineSelection();
            }
        });
    }

    const btnConfirmClass = document.getElementById('btn-confirm-class');
    if (btnConfirmClass) {
        btnConfirmClass.addEventListener('click', () => {
            if (uiManager) {
                uiManager.hideClassSelection();
                uiManager.showDifficultySelection();
            }
        });
    }

    // ─── Difficulty Selection Handlers (Etapa III) ───
    const btnDiffBack = document.getElementById('btn-diff-back');
    if (btnDiffBack) {
        btnDiffBack.addEventListener('click', () => {
            if (uiManager) {
                uiManager.hideDifficultySelection();
                uiManager.showClassSelection();
            }
        });
    }

    const btnConfirmDiff = document.getElementById('btn-confirm-diff');
    if (btnConfirmDiff) {
        btnConfirmDiff.addEventListener('click', () => {
            const selectedBloodline = (uiManager && uiManager.getSelectedBloodline()) || 'children_of_pyre';
            const selectedClass     = (uiManager && uiManager.getSelectedClass()) || 'barbarian';
            const selectedDiff      = (uiManager && uiManager.getSelectedDifficulty()) || (typeof DifficultyType !== 'undefined' ? DifficultyType.NORMAL : 'pilgrim');

            // Explicitly initialize new game with Bloodline and overwrite previous save
            if (gameState) {
                gameState.initNewGame(selectedClass, selectedDiff, selectedBloodline);
                gameState.save();
            }

            if (uiManager) {
                uiManager.hideAllOnboardingScreens();
                uiManager.notify('Um novo despertar se inicia no Bastião das Cinzas... A busca pela esperança começa.', 'level');
            }
            gameStarted = false;
            startGame();
        });
    }
}

/**
 * Start the game after class and difficulty confirmation or save resume.
 */
function startGame() {
    if (gameStarted) return;
    gameStarted = true;
    console.log('[Main] Starting In Search of Hope systems...');

    // Show main game screen
    if (uiManager) uiManager.showGameScreen();

    // Ensure general theme is active across Hub and Camp
    if (window.AudioManager && typeof window.AudioManager.playMusic === 'function') {
        if (window.AudioManager.getCurrentTrack() !== 'general') {
            window.AudioManager.playMusic('general');
        }
    }

    // Ensure responsive canvas sizing immediately
    if (typeof window.resizeHubCanvas === 'function') {
        window.resizeHubCanvas();
    }

    // Render Hub UI
    if (hubUI) hubUI.render();

    // Render Camp Services UI (Forge, Alchemy, Market, Bounties)
    if (campServicesUI) campServicesUI.render();

    // Initialize Dungeon UI
    if (dungeonUI) dungeonUI.init();

    // Start Idle Engine (runs gathering + automation)
    if (idleEngine) idleEngine.start();

    if (typeof window.resizeHubCanvas === 'function') {
        window.resizeHubCanvas();
    }

    console.log('[Main] Game started successfully! [ᛟ]');
}
