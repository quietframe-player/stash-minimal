export default async function testTheme(page, options) {
  const results = [];
  const errors = [];
  page.on('pageerror', error => errors.push({ message: error.message, url: page.url() }));
  const check = (name, passed, detail) => {
    results.push({ name, passed, detail });
    if (!passed) throw new Error(name + ': ' + JSON.stringify(detail));
  };
  const noOverflow = (target = page) => target.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
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
      check('release notes use neutral surface', modal.background === 'rgb(10, 10, 10)' || modal.background === 'rgba(0, 0, 0, 0)', modal);
      await releaseNotes.getByRole('button', { name: 'Close', exact: true }).click();
    }
    check('eight actual Stash scene cards', await page.locator('.scene-card').count() === 8);
    check('theme CSS loaded', await page.locator('link[href*="/plugin/stash-minimal/css"]').count() === 1);
    const body = await colors('body');
    check('neutral background and Geist', body.background === 'rgb(0, 0, 0)' && body.font.includes('Stash Geist'), body);
    check('local font decoded', await page.evaluate(() => document.fonts.check('14px "Stash Geist"')));
    const card = await colors('.scene-card');
    check('cards have no chrome', card.background === 'rgba(0, 0, 0, 0)' && card.border === '0px', card);
    const emptyMetadataGap = await page.locator('.scene-card').first().evaluate(card => {
      const date = card.querySelector('.scene-card__date').getBoundingClientRect();
      const tags = card.querySelector('.card-popovers').getBoundingClientRect();
      return tags.top - date.bottom;
    });
    check('empty metadata does not reserve space', emptyMetadataGap <= 12, emptyMetadataGap);
    check('desktop has no horizontal overflow', await noOverflow());
    const navigation = page.locator('.minimal-navigation');
    const openScenes = async () => {
      const toggle = page.locator('.navbar-toggler');
      if (await toggle.isVisible()) {
        await page.locator('.top-nav .collapsing').waitFor({ state: 'hidden' });
        if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
        await page.locator('.navbar-collapse.show').waitFor();
      }
      await navigation.getByRole('link', { name: 'Scenes', exact: true }).click();
      await page.locator('.scene-card').first().waitFor();
      if (await toggle.isVisible()) {
        await page.locator('.top-nav .collapsing').waitFor({ state: 'hidden' });
        await page.locator('.navbar-collapse').waitFor({ state: 'hidden' });
      }
    };
    check('primary native navigation visible', await navigation.getByRole('link', { name: 'Scenes', exact: true }).isVisible()
      && await navigation.getByRole('link', { name: 'Images', exact: true }).isVisible()
      && await navigation.getByRole('link', { name: 'Performers', exact: true }).isVisible());
    await navigation.getByRole('button', { name: 'More', exact: true }).click();
    for (const name of ['Groups', 'Markers', 'Galleries', 'Studios', 'Tags']) {
      check(name + ' remains available', await navigation.getByRole('link', { name, exact: true }).isVisible());
    }
    await navigation.getByRole('link', { name: 'Tags', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/tags');
    check('More links use native routing', page.url().split('?')[0].endsWith('/tags'));
    await openScenes();
    await page.locator('.scene-card').first().waitFor();
    const utilities = page.locator('.navbar-buttons');
    await utilities.getByRole('button', { name: 'More actions', exact: true }).click();
    check('secondary utility actions visible', await utilities.getByRole('button', { name: 'Help', exact: true }).isVisible()
      && await utilities.getByRole('button', { name: 'Statistics', exact: true }).isVisible()
      && await utilities.getByRole('button', { name: 'Donate', exact: true }).isVisible());
    await utilities.getByRole('button', { name: 'Statistics', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/stats');
    check('Statistics uses native routing', page.url().split('?')[0].endsWith('/stats'));
    for (const [name, route, more] of [['Images', '/images', false], ['Performers', '/performers', false],
      ['Groups', '/groups', true], ['Markers', '/scenes/markers', true], ['Galleries', '/galleries', true],
      ['Studios', '/studios', true], ['Tags', '/tags', true]]) {
      if (more) await navigation.getByRole('button', { name: 'More', exact: true }).click();
      await navigation.getByRole('link', { name, exact: true }).click();
      await page.waitForURL(url => url.pathname === route);
      check(name + ' page remains usable', await navigation.getByRole('button', { name: 'More', exact: true }).isVisible()
        && await noOverflow());
    }
    await openScenes();
    await page.locator('.scene-card').first().waitFor();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: options.reportDir + '/' + options.browser + '-library.png' });
    await page.locator('.sort-by-select .dropdown-toggle').click();
    const menu = await colors('.dropdown-menu.show');
    check('native dropdown uses theme surface', menu.background === 'rgb(10, 10, 10)', menu);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => ({ outline: getComputedStyle(document.activeElement).outlineStyle,
      color: getComputedStyle(document.activeElement).outlineColor }));
    check('keyboard focus visible', focus.outline === 'solid' && focus.color === 'rgb(82, 168, 255)', focus);
    const playerPage = await page.context().newPage();
    playerPage.on('pageerror', error => errors.push({ message: error.message, url: playerPage.url() }));
    await playerPage.setViewportSize({ width: 1440, height: 1000 });
    await playerPage.goto(options.baseURL + '/scenes/' + options.sceneId);
    await playerPage.locator('video').first().waitFor();
    await playerPage.locator('.vjs-marker-tooltip').waitFor({ state: 'attached' });
    check('native video player remains available', await playerPage.locator('video').count() > 0);
    await playerPage.getByRole('button', { name: 'Show scene details', exact: true }).waitFor();
    check('scene details start collapsed', await playerPage.locator('.scene-tabs').isHidden()
      && await playerPage.locator('.scene-player-container.expanded').count() === 1);
    await playerPage.getByRole('button', { name: 'Show scene details', exact: true }).click();
    check('native detail panel can be reopened', await playerPage.locator('.scene-tabs').isVisible());
    await playerPage.getByRole('button', { name: 'Hide scene details', exact: true }).click();
    check('native detail panel closes', await playerPage.locator('.scene-tabs').isHidden());
    await playerPage.locator('.vjs-big-play-button').click();
    await playerPage.waitForFunction(() => { const video = document.querySelector('video'); return video && !video.paused && video.currentTime > 0; });
    check('native playback starts with details collapsed', await playerPage.locator('.scene-tabs').isHidden());
    await playerPage.locator('.vjs-play-control').click();
    await playerPage.waitForLoadState('networkidle');
    check('detail page has no horizontal overflow', await noOverflow(playerPage));
    await playerPage.locator('.scrubber-item').first().waitFor();
    const scrubber = playerPage.locator('#scrubber-back');
    const scrubberColors = await scrubber.evaluate(el => { const s = getComputedStyle(el); return { background: s.backgroundColor, color: s.color }; });
    check('generated thumbnail scrubber uses quiet arrows', scrubberColors.background === 'rgba(0, 0, 0, 0)' && scrubberColors.color === 'rgb(161, 161, 161)', scrubberColors);
    await scrubber.hover();
    await playerPage.waitForFunction(() => getComputedStyle(document.querySelector('#scrubber-back')).backgroundColor === 'rgb(31, 31, 31)');
    check('scrubber hover uses neutral highlight', await scrubber.evaluate(el => getComputedStyle(el).backgroundColor) === 'rgb(31, 31, 31)');
    await playerPage.mouse.move(700, 400);
    const track = await playerPage.locator('.scrubber-tags-background').evaluate(el => getComputedStyle(el).backgroundColor);
    check('scrubber track uses neutral border token', track === 'rgb(41, 41, 41)', track);
    await playerPage.screenshot({ path: options.reportDir + '/' + options.browser + '-detail.png' });
    await utilities.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('tab', { name: 'Plugins', exact: true }).click();
    await page.getByText('Stash Minimal', { exact: true }).first().waitFor();
    check('package appears in native settings', await page.getByText('Stash Minimal', { exact: true }).count() > 0);
    const tableHeader = await colors('.package-manager thead');
    check('package table uses neutral header', tableHeader.background === 'rgb(10, 10, 10)', tableHeader);
    check('settings has no horizontal overflow', await noOverflow());
    const advancedMode = page.getByRole('checkbox', { name: 'Advanced mode', exact: true });
    if (!(await advancedMode.isChecked())) await advancedMode.press('Space');
    check('advanced native settings remain available', await page.getByRole('checkbox', { name: 'Advanced mode', exact: true }).isChecked());
    for (const tab of ['Interface', 'Tasks', 'Library', 'Security', 'Metadata Providers', 'Services', 'System', 'Logs', 'Tools', 'Changelog', 'About']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await page.getByRole('tabpanel', { name: tab, exact: true }).waitFor();
      check(tab + ' settings remain usable', await noOverflow());
      const legacySurfaces = await page.getByRole('tabpanel', { name: tab, exact: true }).evaluate(panel => [...panel.querySelectorAll('*')].filter(el => el.getBoundingClientRect().height > 0 && ['rgb(32, 43, 51)', 'rgb(48, 64, 77)', 'rgb(57, 75, 89)'].includes(getComputedStyle(el).backgroundColor)).map(el => ({ tag: el.tagName, class: el.className, background: getComputedStyle(el).backgroundColor })));
      check(tab + ' has no legacy blue surfaces', legacySurfaces.length === 0, legacySurfaces);
      if (tab === 'Tasks') {
        const queue = await colors('.job-table.card');
        check('task queue uses neutral surface', queue.background === 'rgb(10, 10, 10)', queue);
        check('empty task queue is compact', await page.locator('.job-table.card').evaluate(el => el.getBoundingClientRect().height) <= 80);
        const heading = await page.locator('#tasks-panel h1').first().evaluate(el => getComputedStyle(el).fontSize);
        check('settings headings follow dashboard scale', heading === '24px', heading);
        const diagnostic = page.getByRole('button', { name: 'Troubleshooting mode', exact: true });
        const diagnosticStyle = await diagnostic.evaluate(el => { const s = getComputedStyle(el); return { bg: s.backgroundColor, color: s.color, size: s.fontSize, position: getComputedStyle(el.parentElement).position }; });
        check('diagnostic action is secondary and inline', diagnosticStyle.bg === 'rgba(0, 0, 0, 0)' && diagnosticStyle.color === 'rgb(161, 161, 161)' && diagnosticStyle.position === 'static', diagnosticStyle);
        await diagnostic.click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        check('native diagnostic dialog still opens', await dialog.isVisible());
        check('diagnostic dialog uses neutral surface', (await colors('.modal-content')).background === 'rgb(10, 10, 10)');
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        const switchGeometry = await page.locator('.custom-switch .custom-control-label').first().evaluate(el => { const track = getComputedStyle(el, '::before'), thumb = getComputedStyle(el, '::after'); return { width: track.width, height: track.height, thumb: thumb.width }; });
        check('native switches match dashboard geometry', switchGeometry.width === '36px' && switchGeometry.height === '20px' && switchGeometry.thumb === '16px', switchGeometry);
        const disabledSwitch = await page.locator('label[for=scan-generate-image-previews]').evaluate(el => getComputedStyle(el, '::before').backgroundColor);
        check('disabled switches retain neutral surface', disabledSwitch === 'rgb(31, 31, 31)', disabledSwitch);
        await page.screenshot({ path: options.reportDir + '/' + options.browser + '-settings.png' });
        const jobResponse = await page.request.post(options.baseURL + '/graphql', { data: { query: 'mutation($input:GenerateMetadataInput!){metadataGenerate(input:$input)}', variables: { input: { sceneIDs: [options.sceneId], sprites: true, overwrite: true } } } });
        const job = await jobResponse.json();
        check('owned fixture generation creates a real job', !!job.data?.metadataGenerate, job.errors);
        await page.locator('.job-table .job').first().waitFor();
        check('populated task queue uses neutral surface', (await colors('.job-table.card')).background === 'rgb(10, 10, 10)');
        check('populated queue stays bounded', await page.locator('.job-table.card').evaluate(el => el.getBoundingClientRect().height) <= 240);
        await page.locator('.job-table .job').waitFor({ state: 'hidden', timeout: 45000 });
        check('queue shrinks after job completion', await page.locator('.job-table.card').evaluate(el => el.getBoundingClientRect().height) <= 80);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: 'Tasks', exact: true }).click();
    await page.getByRole('tabpanel', { name: 'Tasks', exact: true }).waitFor();
    check('portrait settings do not overflow', await noOverflow());
    check('portrait queue remains compact', await page.locator('.job-table.card').evaluate(el => el.getBoundingClientRect().height) <= 80);
    await page.screenshot({ path: options.reportDir + '/' + options.browser + '-mobile-settings.png' });
    await openScenes();
    await page.locator('.scene-card').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle');
    check('portrait has no horizontal overflow', await noOverflow());
    const mobileNav = await page.locator('.navbar-buttons').evaluate(el => ({ top: el.getBoundingClientRect().top,
      bottom: el.getBoundingClientRect().bottom, viewport: innerHeight }));
    check('portrait navigation stays on screen', mobileNav.top >= 0 && mobileNav.bottom <= mobileNav.viewport, mobileNav);
    check('portrait search avoids zoom', await page.locator('.filtered-list-toolbar .search-term-input input').first().evaluate(el => getComputedStyle(el).fontSize) === '16px');
    await page.screenshot({ path: options.reportDir + '/' + options.browser + '-mobile.png' });
    await page.locator('.navbar-toggler').click();
    await page.locator('.navbar-collapse.show').waitFor();
    check('mobile navigation opens', await page.locator('.navbar-collapse.show').count() === 1);
    check('open mobile navigation has no overflow', await noOverflow());
    check('mobile primary pages visible', await navigation.getByRole('link', { name: 'Scenes', exact: true }).isVisible());
    check('mobile navigation stacks vertically', await navigation.locator('.navbar-nav').evaluate(el => getComputedStyle(el).flexDirection) === 'column');
    await navigation.getByRole('button', { name: 'More', exact: true }).click();
    check('mobile secondary pages visible', await navigation.getByRole('link', { name: 'Studios', exact: true }).isVisible());
    await navigation.getByRole('link', { name: 'Studios', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/studios');
    check('mobile More links work', page.url().split('?')[0].endsWith('/studios'));
    await openScenes();
    await page.locator('.scene-card').first().waitFor();
    await page.locator('.scene-card .card-section-title').first().click();
    await page.getByRole('button', { name: 'Show scene details', exact: true }).waitFor();
    check('details collapse after native SPA navigation', await page.locator('.scene-tabs').isHidden());
    check('mobile details start collapsed', await page.locator('.scene-tabs').isHidden());
    await page.getByRole('button', { name: 'Show scene details', exact: true }).click();
    check('mobile details remain accessible', await page.locator('.scene-tabs').isVisible());
    check('mobile detail has no overflow', await noOverflow());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const duration = await page.locator('.btn').first().evaluate(el => getComputedStyle(el).transitionDuration);
    check('respects reduced motion', duration === '0s', duration);
    check('no application errors', errors.length === 0, errors);
    return { browser: options.browser, passed: true, results };
  } catch (error) {
    await page.screenshot({ path: options.reportDir + '/' + options.browser + '-failure.png' });
    const navigation = await page.locator('.minimal-navigation').evaluateAll(items => items.map(el => ({ display: getComputedStyle(el).display,
      children: [...el.querySelectorAll('a,button,.navbar-nav')].map(child => ({ tag: child.tagName, text: child.textContent, display: getComputedStyle(child).display })) })));
    return { browser: options.browser, passed: false, results, url: page.url(), error: error.message, errors, navigation };
  }
}
