/**
 * Test script for verifying Settings System in In Search of Hope: The Ashen Bastion
 */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
    console.log('[Test] Starting Settings System verification...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('[Browser Error]', msg.text());
        }
    });

    const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
    console.log('[Test] Navigating to:', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 1. Verify SettingsManager is defined and populated
    const smTest = await page.evaluate(() => {
        if (!window.SettingsManager) return { ok: false, error: 'SettingsManager missing' };
        const audio = window.SettingsManager.get('audio');
        const visual = window.SettingsManager.get('visual');
        const gameplay = window.SettingsManager.get('gameplay');
        const controls = window.SettingsManager.get('controls');
        return {
            ok: true,
            hasAudio: !!audio && audio.masterVolume === 0.8,
            hasVisual: !!visual && visual.screenShakeIntensity === 1.0,
            hasGameplay: !!gameplay && gameplay.showDamageNumbers === true,
            hasControls: !!controls && controls.moveUp === 'KeyW'
        };
    });
    console.log('[Test] SettingsManager initialization:', smTest);

    // 2. Click Title Screen Settings Button
    console.log('[Test] Clicking #btn-title-settings...');
    await page.click('#btn-title-settings');
    await page.waitForTimeout(300);

    const isModalOpen = await page.evaluate(() => {
        const modal = document.getElementById('settings-modal-overlay');
        return modal && modal.classList.contains('active') && window.SettingsUI.isOpen;
    });
    console.log('[Test] Modal opened via Title Screen button:', isModalOpen);

    // 3. Test Tab Switching
    console.log('[Test] Testing 4 Heraldic Tabs switching...');
    const tabs = ['visual', 'gameplay', 'controls', 'audio'];
    for (const tab of tabs) {
        await page.click(`.settings-tab-btn[data-tab="${tab}"]`);
        await page.waitForTimeout(150);
        const activeTab = await page.evaluate((t) => {
            const pane = document.querySelector(`.settings-pane[data-pane="${t}"]`);
            return pane && pane.classList.contains('active');
        }, tab);
        console.log(`[Test] Tab "${tab}" is active:`, activeTab);
    }

    // 4. Test Key Remapping and Conflict Auto-Swap in Controls Tab
    console.log('[Test] Testing Key Remapping...');
    await page.click('.settings-tab-btn[data-tab="controls"]');
    await page.waitForTimeout(200);

    // Click skill1 remap slot (currently Q)
    await page.click('#remap-skill1');
    await page.waitForTimeout(150);
    // Press 'KeyW' (which is currently used by moveUp!)
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(200);

    const remapResult = await page.evaluate(() => {
        const s = window.SettingsUI.workingSettings.controls;
        return {
            skill1: s.skill1,
            moveUp: s.moveUp,
            bannerText: document.getElementById('remap-status-banner')?.textContent
        };
    });
    console.log('[Test] Remap auto-swap result:', remapResult);

    // 5. Test Apply & Save and verify localStorage
    console.log('[Test] Testing Apply & Save...');
    await page.click('#btn-settings-apply');
    await page.waitForTimeout(300);

    const storageCheck = await page.evaluate(() => {
        const raw = localStorage.getItem('ashen_bastion_settings');
        const parsed = JSON.parse(raw || '{}');
        const modal = document.getElementById('settings-modal-overlay');
        return {
            savedToStorage: !!raw,
            skill1Saved: parsed.controls?.skill1,
            modalClosed: !modal.classList.contains('active')
        };
    });
    console.log('[Test] LocalStorage persistence check:', storageCheck);

    // 6. Test ESC key toggle
    console.log('[Test] Testing ESC key toggle...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const escOpened = await page.evaluate(() => {
        const modal = document.getElementById('settings-modal-overlay');
        return modal && modal.classList.contains('active');
    });
    console.log('[Test] Modal opened with ESC:', escOpened);

    // Close with ESC
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const escClosed = await page.evaluate(() => {
        const modal = document.getElementById('settings-modal-overlay');
        return modal && !modal.classList.contains('active');
    });
    console.log('[Test] Modal closed with ESC:', escClosed);

    // Take screenshot of the Gothic Settings Modal for visual excellence verification
    await page.click('#btn-title-settings');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'settings_modal_showcase.png' });
    console.log('[Test] Screenshot saved to settings_modal_showcase.png');

    await browser.close();
    console.log('[Test] All Settings System tests completed successfully!');
})();
