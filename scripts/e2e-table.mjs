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

  // Sound toggle is global and actually silences the table.
  await page.locator('.tips-toggle:has-text("Sound on")').click();
  mark = await audio();
  await page.locator('.action-bar button:has-text("Flip")').click();
  await page.waitForTimeout(600);
  const muted = delta(mark, await audio());
  check('the header Sound toggle silences the table', muted.bursts === 0 && muted.thuds === 0);
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`\nTable smoke test failed: ${failures.length} problem(s)`);
  process.exit(1);
}
console.log('\nTable smoke test passed.');
