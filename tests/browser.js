export default async function testTheme(page, options) {
  const results = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const check = (name, passed, detail) => {
    results.push({ name, passed, detail });
    if (!passed) throw new Error(name + ': ' + JSON.stringify(detail));
  };
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const colors = selector => page.locator(selector).first().evaluate(el => {
    const s = getComputedStyle(el);
    return { color: s.color, background: s.backgroundColor, border: s.borderTopWidth, font: s.fontFamily };
  });
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(options.baseURL + '/scenes?z=2');
    await page.locator('.scene-card').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const releaseNotes = page.getByRole('dialog');
    if (await releaseNotes.count()) {
      const modal = await colors('.modal-body');
      check('release notes use neutral surface', modal.background === 'rgb(20, 20, 20)' || modal.background === 'rgba(0, 0, 0, 0)', modal);
      await releaseNotes.getByRole('button', { name: 'Close', exact: true }).click();
    }
    check('eight actual Stash scene cards', await page.locator('.scene-card').count() === 8);
    check('theme CSS loaded', await page.locator('link[href*="/plugin/stash-minimal/css"]').count() === 1);
    const body = await colors('body');
    check('neutral background and Geist', body.background === 'rgb(10, 10, 10)' && body.font.includes('Stash Geist'), body);
    check('local font decoded', await page.evaluate(() => document.fonts.check('14px "Stash Geist"')));
    const card = await colors('.scene-card');
    check('cards have no chrome', card.background === 'rgba(0, 0, 0, 0)' && card.border === '0px', card);
    check('desktop has no horizontal overflow', await noOverflow());
    await page.screenshot({ path: options.reportDir + '/' + options.browser + '-library.png' });
    await page.locator('.sort-by-select .dropdown-toggle').click();
    const menu = await colors('.dropdown-menu.show');
    check('native dropdown uses theme surface', menu.background === 'rgb(20, 20, 20)', menu);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => ({ outline: getComputedStyle(document.activeElement).outlineStyle,
      color: getComputedStyle(document.activeElement).outlineColor }));
    check('keyboard focus visible', focus.outline === 'solid' && focus.color === 'rgb(82, 168, 255)', focus);
    await page.goto(options.baseURL + '/scenes/' + options.sceneId);
    await page.locator('video').first().waitFor();
    check('native video player remains available', await page.locator('video').count() > 0);
    check('detail page has no horizontal overflow', await noOverflow());
    await page.screenshot({ path: options.reportDir + '/' + options.browser + '-detail.png' });
    await page.goto(options.baseURL + '/settings?tab=plugins');
    await page.getByText('Stash Minimal', { exact: true }).first().waitFor();
    check('package appears in native settings', await page.getByText('Stash Minimal', { exact: true }).count() > 0);
    check('settings has no horizontal overflow', await noOverflow());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(options.baseURL + '/scenes?z=2');
    await page.locator('.scene-card').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    check('portrait has no horizontal overflow', await noOverflow());
    check('portrait search avoids zoom', await page.locator('.filtered-list-toolbar .search-term-input input').first().evaluate(el => getComputedStyle(el).fontSize) === '16px');
    await page.screenshot({ path: options.reportDir + '/' + options.browser + '-mobile.png' });
    await page.locator('.navbar-toggler').click();
    await page.locator('.navbar-collapse.show').waitFor();
    check('mobile navigation opens', await page.locator('.navbar-collapse.show').count() === 1);
    check('open mobile navigation has no overflow', await noOverflow());
    await page.locator('.navbar-toggler').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const duration = await page.locator('.btn').first().evaluate(el => getComputedStyle(el).transitionDuration);
    check('respects reduced motion', duration === '0s', duration);
    check('no application errors', errors.length === 0, errors);
    return { browser: options.browser, passed: true, results };
  } catch (error) {
    await page.screenshot({ path: options.reportDir + '/' + options.browser + '-failure.png' });
    return { browser: options.browser, passed: false, results, error: error.message, errors };
  }
}
