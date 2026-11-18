const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

for (const path of ['/index.php', '/liaison.php', '/pilotage.php', '/login.php']) {
  test(`accessibilité et contrastes du thème : ${path}`, async ({ page, browser }) => {
    let target = page;
    if (path === '/login.php') target = await (await browser.newContext({ storageState: undefined })).newPage();
    await target.setViewportSize({ width: 390, height: 844 });
    await target.emulateMedia({ reducedMotion: 'reduce' });
    await target.goto(path);
    await target.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page: target }).analyze();
    const blocking = results.violations.filter(v => ['critical', 'serious'].includes(v.impact));
    expect(blocking.map(v => v.id + ' : ' + v.nodes.map(n => n.target.join(' ')).join(', '))).toEqual([]);
  });
}
