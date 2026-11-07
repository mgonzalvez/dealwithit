/**
 * Interaction smoke test for the table.
 *
 * Unit tests can prove that shuffle() shuffles, but they cannot prove that a
 * pointer press on a stack actually peels a card, or that a sound is wired to
 * the action that plays it. This script drives a real Chromium against a real
 * Vite dev server and asserts the handful of things a player touches every
 * time they open the app.
 *
 *   npx playwright install chromium   # once
 *   npm run test:e2e
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';

const failures = [];
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${label}${detail ? ` (${detail})` : ''}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const server = await createServer({ logLevel: 'error' });
await server.listen();
const address = server.httpServer.address();
const url = `http://localhost:${address.port}/`;
console.log(`Driving the table at ${url}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });

page.on('pageerror', (error) => failures.push(`Uncaught page error: ${error.message}`));

// Count the audio nodes the sounds module creates.
await page.addInitScript(() => {
  window.__audio = { bursts: 0, thuds: 0 };
  const Original = window.AudioContext;
  if (!Original) return;
  class CountingContext extends Original {
    createBufferSource() {
      window.__audio.bursts += 1;
      return super.createBufferSource();
    }
    createOscillator() {
      window.__audio.thuds += 1;
      return super.createOscillator();
    }
  }
  window.AudioContext = CountingContext;
});

const audio = () => page.evaluate(() => ({ bursts: window.__audio.bursts, thuds: window.__audio.thuds }));
const delta = (a, b) => ({ bursts: b.bursts - a.bursts, thuds: b.thuds - a.thuds });
const objectCount = () => page.evaluate(() => document.querySelectorAll('.table-object').length);

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  if (await page.locator('.tour-rail').count()) {
    await page.locator('.tour-rail-actions button:has-text("Close tour")').click();
    await page.waitForTimeout(300);
  }

  await page.click('button:has-text("Play a standard 52-card deck")');
  await page.waitForFunction(() => document.body.innerText.includes('52-card deck is ready'), { timeout: 30000 });
  await page.locator('.project-card-actions button:has-text("Table")').click();
  await page.waitForSelector('.table-object.stack', { timeout: 20000 });
  await page.waitForTimeout(1200);

  // The table frames the deck instead of leaving it off-screen.
  const camera = await page.evaluate(() => document.querySelector('.table-world').style.transform);
  check('camera fits the cards on load', /scale\(1\.\d+\)/.test(camera) || /scale\(0\.\d+\)/.test(camera), camera);

  const stack = await page.evaluate(() => {
    const el = document.querySelector('.table-object.stack');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  });
  check('deck is inside the visible table', stack !== null && stack.x > 0 && stack.y > 0, stack ? `${Math.round(stack.x)}, ${Math.round(stack.y)}` : 'missing');

  // The face-down top card shows the deck's back, not blank card stock.
  const pixels = await page.evaluate(async () => {
    const img = document.querySelector('.table-object.stack img');
    if (!img) return null;
    const image = new Image();
    image.src = img.src;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const sample = ctx.getImageData(Math.floor(image.width / 2), Math.floor(image.height / 2), 1, 1).data;
    return [sample[0], sample[1], sample[2]];
  });
  const creamish = pixels && pixels[0] > 235 && pixels[1] > 225 && pixels[2] > 205;
  check('stack shows the real card back', pixels !== null && !creamish, pixels ? pixels.join(',') : 'no image');

  // The pile's count badge must be readable, not buried under the top card.
  const badge = await page.evaluate(() => {
    const badgeEl = document.querySelector('.table-object.stack .count-badge');
    if (!badgeEl) return null;
    const r = badgeEl.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      text: badgeEl.textContent,
      readable: hit === badgeEl,
      hit: hit ? `${hit.tagName}.${hit.className}` : 'nothing'
    };
  });
  check(
    'the stack count badge sits on top of the pile',
    badge !== null && badge.readable,
    badge ? `${badge.text} cards, top element: ${badge.hit}` : 'no badge'
  );

  // Pick up / peel: dragging the top card off a stack makes a new object.
  const before = await objectCount();
  let mark = await audio();
  await page.mouse.move(stack.x, stack.y);
  await page.mouse.down();
  await page.mouse.move(stack.x + 220, stack.y + 90, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const after = await objectCount();
  check('dragging peels the top card off the stack', after === before + 1, `${before} -> ${after}`);
  const drawn = delta(mark, await audio());
  check('drawing a card makes a sound', drawn.bursts > 0 && drawn.thuds > 0, `${drawn.bursts} bursts, ${drawn.thuds} thuds`);

  // Hold still and the whole stack comes with you.
  const box = await page.evaluate(() => {
    const el = document.querySelector('.table-object.stack');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (box) {
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.waitForTimeout(900);
    const grabbing = await page.evaluate(() => Boolean(document.querySelector('.table-object.grabbing')));
    await page.mouse.move(box.x + 120, box.y + 40, { steps: 12 });
    await page.mouse.up();
    check('holding a stack grabs the whole deck', grabbing);
  }

  // Shuffle: sound plus the two-half animation.
  const safeStack = await page.evaluate(() => {
    const el = document.querySelector('.table-object.stack');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const point = { x: r.left + r.width / 2, y: r.top + r.height * 0.2 };
    const hit = document.elementFromPoint(point.x, point.y);
    return hit && el.contains(hit) ? point : null;
  });
  mark = await audio();
  if (safeStack) {
    await page.mouse.click(safeStack.x, safeStack.y);
  } else {
    await page.click('.table-object.stack');
  }
  await page.waitForTimeout(200);
  await page.locator('.action-bar button:has-text("Shuffle")').click();
  await page.waitForTimeout(200);
  const animating = await page.evaluate(() => Boolean(document.querySelector('.table-object.anim-shuffle .shuffle-split')));
  await page.waitForTimeout(700);
  const riffle = delta(mark, await audio());
  check('shuffle plays a riffle', riffle.bursts >= 10, `${riffle.bursts} bursts`);
  check('shuffle animates the pack', animating);

  // Flip and cut.
  mark = await audio();
  try {
    await page.locator('.table-object.stack').dblclick({ timeout: 5000 });
  } catch {
    // The stack is hidden behind the action bar; ask the element directly.
    await page.evaluate(() => {
      const el = document.querySelector('.table-object.stack');
      if (el) el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
  }
  await page.waitForTimeout(400);
  const flipped = delta(mark, await audio());
  check('flipping a card makes a sound', flipped.bursts > 0 && flipped.thuds > 0, `${flipped.bursts} bursts, ${flipped.thuds} thuds`);

  mark = await audio();
  await page.locator('.action-bar button:has-text("Cut")').click();
  await page.waitForTimeout(400);
  const cut = delta(mark, await audio());
  check('cutting the deck makes a sound', cut.bursts > 0 && cut.thuds > 0, `${cut.bursts} bursts, ${cut.thuds} thuds`);

  // Putting a card down on the felt makes a thud.
  const card = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.table-object')).find((e) => !e.classList.contains('stack'));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // Aim near the top edge of the card, where the floating action bar is
    // least likely to be in the way.
    const point = { x: r.left + r.width / 2, y: r.top + r.height * 0.25 };
    const hit = document.elementFromPoint(point.x, point.y);
    return hit && el.contains(hit) ? point : null;
  });
  if (card) {
    mark = await audio();
    await page.mouse.move(card.x, card.y);
    await page.mouse.down();
    await page.mouse.move(card.x + 150, card.y + 120, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const placed = delta(mark, await audio());
    check('picking up and setting down a card makes sounds', placed.bursts > 0 && placed.thuds > 0, `${placed.bursts} bursts, ${placed.thuds} thuds`);
  } else {
    console.log('  skip  set-down sound (no free card to grab in view)');
  }

  // Deal a handful of cards off the deck so there is something to select.
  const deckPoint = await page.evaluate(() => {
    const el = document.querySelector('.table-object.stack');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const point = { x: r.left + r.width / 2, y: r.top + r.height * 0.2 };
    const hit = document.elementFromPoint(point.x, point.y);
    return hit && el.contains(hit) ? point : null;
  });
  if (deckPoint) {
    await page.mouse.click(deckPoint.x, deckPoint.y);
    await page.waitForTimeout(300);
    await page.locator('.action-bar button:has-text("Draw 3")').click();
    await page.waitForTimeout(600);
  }

  // Group selection: select the loose cards, lay them out, drag them as a set,
  // gather them, then rubber-band a selection with the mouse.
  await page.locator('.table-toolbar button:has-text("Select all cards")').click();
  await page.waitForTimeout(300);
  const group = await page.evaluate(() => ({
    selected: document.querySelectorAll('.table-object.selected').length,
    bar: document.querySelector('.group-bar')?.textContent?.trim() ?? ''
  }));
  check('Select all cards picks up every loose card', group.selected >= 4 && /cards selected/.test(group.bar), `${group.selected} selected — ${group.bar}`);

  await page.locator('.group-bar button:has-text("Arrange in a row")').click();
  await page.waitForTimeout(400);
  const rowTidy = await page.evaluate(() => {
    const tops = Array.from(document.querySelectorAll('.table-object.selected')).map((el) => parseFloat(el.style.top));
    return tops.length >= 2 && Math.max(...tops) - Math.min(...tops) < 1;
  });
  check('Arrange in a row lines the cards up at the same height', rowTidy);

  // Dragging one card of the group carries the rest with it.
  const groupPositions = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.table-object.selected')).map((el) => `${el.style.left},${el.style.top}`)
  );
  const pair = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.table-object.selected'));
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const point = { x: r.left + r.width / 2, y: r.top + r.height * 0.25 };
      const hit = document.elementFromPoint(point.x, point.y);
      if (hit && el.contains(hit)) return { a: point };
    }
    return null;
  });
  if (pair) {
    await page.mouse.move(pair.a.x, pair.a.y);
    await page.mouse.down();
    await page.mouse.move(pair.a.x + 120, pair.a.y + 60, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const moved = await page.evaluate((original) => {
      const now = Array.from(document.querySelectorAll('.table-object.selected')).map((el) => `${el.style.left},${el.style.top}`);
      return now.filter((position, index) => index < original.length && position !== original[index]).length;
    }, groupPositions);
    check('dragging one card of a group moves the whole group', moved >= Math.min(groupPositions.length, 2), `${moved} of ${groupPositions.length} cards moved`);
  }

  const objectsBefore = await objectCount();
  await page.locator('.group-bar button:has-text("Gather into a pile")').click();
  await page.waitForTimeout(400);
  const pile = await page.evaluate((count) => ({
    objects: document.querySelectorAll('.table-object').length,
    badges: Array.from(document.querySelectorAll('.table-object.stack .count-badge')).map((b) => Number(b.textContent))
  }), group.selected);
  check(
    'Gather into a pile stacks the selected cards',
    pile.objects === objectsBefore - group.selected + 1 && pile.badges.includes(group.selected),
    `${objectsBefore} -> ${pile.objects} objects, badges ${pile.badges.join('/')}`
  );

  // Deal again, arrange in a grid, and send the group back to the deck.
  const reDealPoint = await page.evaluate(() => {
    const el = document.querySelector('.table-object.stack');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const point = { x: r.left + r.width / 2, y: r.top + r.height * 0.2 };
    const hit = document.elementFromPoint(point.x, point.y);
    return hit && el.contains(hit) ? point : null;
  });
  if (reDealPoint) {
    await page.mouse.click(reDealPoint.x, reDealPoint.y);
    await page.waitForTimeout(300);
    await page.locator('.action-bar button:has-text("Draw 3")').click();
    await page.waitForTimeout(500);
    await page.locator('.table-toolbar button:has-text("Select all cards")').click();
    await page.waitForTimeout(300);
    await page.locator('.group-bar button:has-text("Arrange in a grid")').click();
    await page.waitForTimeout(400);
    const grid = await page.evaluate(() => {
      const cells = new Set(Array.from(document.querySelectorAll('.table-object.selected')).map((el) => `${Math.round(parseFloat(el.style.left))},${Math.round(parseFloat(el.style.top))}`));
      return cells.size;
    });
    check('Arrange in a grid gives every selected card its own cell', grid >= 3, `${grid} cells`);

    await page.locator('.group-bar button:has-text("Return to deck")').click();
    await page.waitForTimeout(400);
    const back = await page.evaluate(() => ({
      loose: document.querySelectorAll('.table-object:not(.stack)').length,
      total: Array.from(document.querySelectorAll('.table-object.stack .count-badge')).reduce((sum, b) => sum + Number(b.textContent), 0)
    }));
    check('Return to deck puts the selected cards back in a pile', back.loose === 0 && back.total === 52, `${back.total} cards in piles, ${back.loose} loose`);
  }

  // Rubber-band selection: Shift + drag across the felt.
  const marqueeBox = await page.evaluate(() => {
    const rect = document.querySelector('.table-object.stack').getBoundingClientRect();
    return { x: rect.left - 30, y: rect.top - 30, right: rect.right + 30, bottom: rect.bottom + 30 };
  });
  await page.mouse.move(marqueeBox.x, marqueeBox.y);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(marqueeBox.right, marqueeBox.bottom, { steps: 20 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForTimeout(300);
  const marquee = await page.evaluate(() => document.querySelectorAll('.table-object.selected').length);
  check('Shift + drag on the felt rubber-bands a selection', marquee >= 1, `${marquee} selected`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const cleared = await page.evaluate(() => document.querySelectorAll('.table-object.selected').length);
  check('Escape clears the selection', cleared === 0);


  // Select mode is the touch-friendly way to build a group: tap the cards you
  // want, then act on them.
  await page.locator('.table-toolbar button:has-text("Select mode")').click();
  await page.waitForTimeout(200);
  const tapTargets = await page.evaluate(() => {
    const points = [];
    for (const el of document.querySelectorAll('.table-object:not(.selected)')) {
      const r = el.getBoundingClientRect();
      const point = { x: r.left + r.width / 2, y: r.top + r.height * 0.25 };
      const hit = document.elementFromPoint(point.x, point.y);
      if (hit && el.contains(hit)) points.push(point);
      if (points.length >= 2) break;
    }
    return points;
  });
  if (tapTargets.length >= 2) {
    await page.mouse.click(tapTargets[0].x, tapTargets[0].y);
    await page.waitForTimeout(200);
    await page.mouse.click(tapTargets[1].x, tapTargets[1].y);
    await page.waitForTimeout(200);
    const built = await page.evaluate(() => document.querySelectorAll('.table-object.selected').length);
    check('Select mode builds a group by tapping cards', built === 2, `${built} selected`);
  }
  await page.locator('.table-toolbar button:has-text("Select mode")').click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Select the pile again so the next checks have something to act on.
  const pilePoint = await page.evaluate(() => {
    const el = document.querySelector('.table-object.stack');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const point = { x: r.left + r.width / 2, y: r.top + r.height * 0.25 };
    const hit = document.elementFromPoint(point.x, point.y);
    return hit && el.contains(hit) ? point : null;
  });
  if (pilePoint) {
    await page.mouse.click(pilePoint.x, pilePoint.y);
    await page.waitForTimeout(300);
  }

  // Sound toggle is global and actually silences the table.
  await page.locator('.tips-toggle:has-text("Sound on")').click();
  mark = await audio();
  await page.locator('.action-bar button:has-text("Flip")').click();
  await page.waitForTimeout(600);
  const muted = delta(mark, await audio());
  check('the header Sound toggle silences the table', muted.bursts === 0 && muted.thuds === 0);

  // Focus mode: the felt fills the screen and the interface chrome disappears.
  await page.locator('.focus-toggle').click();
  await page.waitForTimeout(900);
  const focusState = await page.evaluate(() => {
    const canvas = document.querySelector('.table-canvas');
    const rect = canvas.getBoundingClientRect();
    return {
      focused: document.body.classList.contains('table-focus'),
      canvasWidth: Math.round(rect.width),
      canvasHeight: Math.round(rect.height),
      viewportWidth: window.innerWidth,
      toolbarHidden: getComputedStyle(document.querySelector('.table-toolbar')).display === 'none',
      trayHidden: getComputedStyle(document.querySelector('.tray')).display === 'none'
    };
  });
  check(
    'focus mode makes the table fill the viewport',
    focusState.focused && focusState.canvasWidth === focusState.viewportWidth && focusState.canvasHeight > 400,
    `canvas ${focusState.canvasWidth}x${focusState.canvasHeight} in a ${focusState.viewportWidth}px viewport`
  );
  check('focus mode hides the toolbar and the deck tray', focusState.toolbarHidden && focusState.trayHidden);

  const stackVisible = await page.evaluate(() => {
    const rect = document.querySelector('.table-object.stack').getBoundingClientRect();
    return rect.left > 0 && rect.top > 0 && rect.right < window.innerWidth && rect.bottom < window.innerHeight;
  });
  check('focus mode keeps the cards in view', stackVisible);

  // The Controls panel brings back everything the toolbar used to hold.
  await page.locator('.zoom-controls button:has-text("Controls")').click();
  await page.waitForTimeout(300);
  const panel = await page.evaluate(() => {
    const el = document.querySelector('.focus-panel');
    if (!el) return null;
    return {
      launch: Boolean(el.querySelector('button.btn-primary')),
      surface: Boolean(el.querySelector('select')),
      undo: [...el.querySelectorAll('button')].some((b) => b.textContent === 'Undo')
    };
  });
  check('the focus Controls panel offers decks, surface and undo', panel !== null && panel.launch && panel.surface && panel.undo);

  await page.locator('.focus-toggle').click();
  await page.waitForTimeout(600);
  const backToNormal = await page.evaluate(() => ({
    focused: document.body.classList.contains('table-focus'),
    toolbarVisible: getComputedStyle(document.querySelector('.table-toolbar')).display !== 'none'
  }));
  check('exit focus restores the full interface', !backToNormal.focused && backToNormal.toolbarVisible);
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`\nTable smoke test failed: ${failures.length} problem(s)`);
  process.exit(1);
}
console.log('\nTable smoke test passed.');
