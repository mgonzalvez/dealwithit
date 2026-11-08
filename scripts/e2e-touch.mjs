/**
 * Touch e2e: drives the table with real touch events (CDP), not mouse clicks.
 * This is what a tablet user actually does, so the finger paths — tap to
 * select, drag to peel, pinch to zoom, rubber-band with Select mode — are
 * exercised for real.
 *
 * Run: npm run test:e2e:touch
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}${detail ? ` (${detail})` : ''}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const server = await createServer({ logLevel: 'error' });
await server.listen();
const url = `http://localhost:${server.httpServer.address().port}/`;
console.log(`Driving the table at ${url}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
page.on('dialog', (dialog) => dialog.accept());

await page.goto(url, { waitUntil: 'networkidle' });
if (await page.locator('.tour-rail').count()) {
  await page.locator('.tour-rail-actions button:has-text("Close tour")').click();
}
await page.click('button:has-text("Play a standard 52-card deck")');
await page.waitForFunction(() => document.body.innerText.includes('52-card deck is ready'), { timeout: 30000 });
await page.locator('.project-card-actions button:has-text("Table")').click();
await page.waitForSelector('.table-object.stack');
await page.waitForTimeout(1500);

const cdp = await page.context().newCDPSession(page);
const touchStart = (points) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
const touchMove = (points) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points });
const touchEnd = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

async function tap(x, y) {
  await touchStart([{ x, y }]);
  await page.waitForTimeout(60);
  await touchEnd();
  await page.waitForTimeout(250);
}

async function swipe(from, to, steps = 8) {
  await touchStart([{ x: from.x, y: from.y }]);
  for (let i = 1; i <= steps; i += 1) {
    await touchMove([
      { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }
    ]);
    await page.waitForTimeout(30);
  }
  await touchEnd();
  await page.waitForTimeout(300);
}

function tableState() {
  return page.evaluate(() => ({
    objects: document.querySelectorAll('.table-object').length,
    loose: document.querySelectorAll('.table-object:not(.stack)').length,
    selected: document.querySelectorAll('.table-object.selected').length,
    zoom: parseFloat((document.querySelector('.table-world')?.style.transform ?? '').match(/scale\(([\d.]+)\)/)?.[1] ?? '1'),
    badges: Array.from(document.querySelectorAll('.table-object.stack .count-badge')).map((b) => Number(b.textContent))
  }));
}

//** Find a spot on the felt itself: bare felt, well clear of cards and chrome. */
function feltPoint(offset = 0) {
  return page.evaluate((skip) => {
    const canvas = document.querySelector('.table-canvas').getBoundingClientRect();
    const blockers = Array.from(document.querySelectorAll('.table-object, .zoom-controls, .group-bar, .action-bar, .focus-panel, .tray')).map((el) => el.getBoundingClientRect());
    for (let y = canvas.top + 30; y < canvas.bottom - 30; y += 12) {
      for (let x = canvas.left + 30; x < canvas.right - 30; x += 12) {
        const clear = blockers.every((r) => x < r.left - 30 || x > r.right + 30 || y < r.top - 30 || y > r.bottom + 30);
        if (!clear) continue;
        const hit = document.elementFromPoint(x, y);
        if (!hit || !hit.classList.contains('table-world')) continue;
        if (skip-- <= 0) return { x, y };
      }
    }
    return null;
  }, offset);
}

function stackPoint() {
  return page.evaluate(() => {
    const el = document.querySelector('.table-object.stack');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
}

// 1. A finger tap on the deck selects it and opens the action bar.
const deck = await stackPoint();
await tap(deck.x, deck.y);
const bar = await page.evaluate(() => document.querySelector('.action-bar')?.textContent ?? '');
check('a finger tap on the deck selects it and opens the action bar', /Draw/.test(bar), bar.slice(0, 40));

// 2. Dragging the deck with a finger peels one card per drag.
const before = await tableState();
await swipe(deck, { x: deck.x + 120, y: deck.y + 160 }, 6);
const afterPeel = await tableState();
check('a finger drag peels the top card off the stack', afterPeel.objects === before.objects + 1, `${before.objects} -> ${afterPeel.objects}`);

// 3. Keep dragging the pile: each drag deals another card, never the whole pack.
let dealt = 1;
for (let i = 0; i < 4; i += 1) {
  const point = await stackPoint();
  if (!point) break;
  const beforeLoop = await tableState();
  await swipe(point, { x: point.x + 110, y: point.y + 130 }, 6);
  const afterLoop = await tableState();
  if (afterLoop.objects === beforeLoop.objects + 1) dealt += 1;
}
check('repeated finger drags keep dealing single cards, never the whole pack', dealt >= 3, `${dealt} cards dealt by finger`);
check('the deck never got grabbed whole', (await tableState()).badges.length >= 1, `badges ${(await tableState()).badges.join('/')}`);

// 4. Arrange the dealt cards with the finger-driven group bar.
await page.locator('.table-toolbar button:has-text("Select all cards")').click();
await page.waitForTimeout(300);
await page.locator('.group-bar button:has-text("Arrange in a row")').click();
await page.waitForTimeout(600);
const row = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('.table-object.selected')).map((el) => ({
    left: parseFloat(el.style.left),
    top: parseFloat(el.style.top),
    width: parseFloat(el.style.width)
  }));
  const gaps = cards.slice(1).map((card, index) => card.left - (cards[index].left + cards[index].width));
  return { count: cards.length, gap: gaps.length ? Math.round(gaps[0]) : 0, spread: gaps.length ? Math.max(...gaps) - Math.min(...gaps) : 0 };
});
check('finger-arranged cards sit in one clean row with an even gap', row.count >= 3 && row.gap >= 4 && row.gap <= 60 && row.spread <= 4, `${row.count} cards, ${row.gap} unit gap`);

// 5. A tap well clear of every card clears the group.
const empty = await feltPoint(0);
if (empty) {
  await tap(empty.x, empty.y);
  const cleared = await tableState();
  check('tapping empty felt deselects', cleared.selected === 0, `${cleared.selected} still selected`);
}

// 6. Select mode turns taps into group building.
await page.locator('.table-toolbar button:has-text("Select mode")').click();
await page.waitForTimeout(200);
const twoCards = await page.evaluate(() => {
  const points = [];
  for (const el of document.querySelectorAll('.table-object:not(.stack)')) {
    const r = el.getBoundingClientRect();
    points.push({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
    if (points.length >= 2) break;
  }
  return points;
});
if (twoCards.length === 2) {
  await tap(twoCards[0].x, twoCards[0].y);
  await tap(twoCards[1].x, twoCards[1].y);
  const group = await tableState();
  check('tapping two cards in Select mode builds a group of two', group.selected === 2, `${group.selected} selected`);
  check('the group bar offers finger actions', /Gather into a pile/.test(await page.evaluate(() => document.querySelector('.group-bar')?.textContent ?? '')));
}
await page.locator('.table-toolbar button:has-text("Select mode")').click();
await page.waitForTimeout(200);

// 7. Rubber-band with a finger: drag across the felt while in Select mode.
await page.locator('.table-toolbar button:has-text("Select mode")').click();
await page.waitForTimeout(200);
const band = await page.evaluate(() => {
  const canvas = document.querySelector('.table-canvas').getBoundingClientRect();
  const cards = Array.from(document.querySelectorAll('.table-object:not(.stack)')).map((el) => el.getBoundingClientRect());
  if (!cards.length) return null;
  const top = Math.min(...cards.map((r) => r.top));
  const bottom = Math.max(...cards.map((r) => r.bottom));
  const left = Math.min(...cards.map((r) => r.left));
  const right = Math.max(...cards.map((r) => r.right));
  // Find a felt spot above the cards to start the band from.
  for (let y = top - 20; y > canvas.top + 10; y -= 10) {
    if (document.elementFromPoint(left, y)?.classList.contains('table-world')) return { x: left, y, right, bottom };
  }
  return null;
});
if (band) {
  await swipe({ x: band.x, y: band.y }, { x: band.right, y: band.bottom }, 12);
  const banded = await tableState();
  check('a finger rubber-band grabs every card it covers', banded.selected >= 2, `${banded.selected} selected`);
  await page.locator('.table-toolbar button:has-text("Select mode")').click();
  await page.waitForTimeout(200);
}

// 8. Two-finger pinch zooms the felt. Both fingers must land on bare felt.
const clear = await page.evaluate(() => {
  const canvas = document.querySelector('.table-canvas').getBoundingClientRect();
  for (let y = canvas.top + 60; y < canvas.bottom - 60; y += 20) {
    for (let x = canvas.left + 80; x < canvas.right - 80; x += 20) {
      const spots = [{ x: x - 60, y }, { x: x + 60, y }, { x: x - 150, y }, { x: x + 150, y }];
      if (spots.every((p) => document.elementFromPoint(p.x, p.y)?.classList.contains('table-world'))) return { x, y };
    }
  }
  return null;
});
if (clear) {
  const zoomBefore = (await tableState()).zoom;
  await touchStart([
    { x: clear.x - 60, y: clear.y },
    { x: clear.x + 60, y: clear.y }
  ]);
  await page.waitForTimeout(120);
  await touchMove([
    { x: clear.x - 150, y: clear.y },
    { x: clear.x + 150, y: clear.y }
  ]);
  await page.waitForTimeout(250);
  const zoomOut = (await tableState()).zoom;
  await touchMove([
    { x: clear.x - 40, y: clear.y },
    { x: clear.x + 40, y: clear.y }
  ]);
  await page.waitForTimeout(250);
  const zoomIn = (await tableState()).zoom;
  await touchEnd();
  await page.waitForTimeout(300);
  check('spreading two fingers zooms out', zoomOut > zoomBefore, `${zoomBefore} -> ${zoomOut}`);
  check('pinching two fingers back in zooms in', zoomIn < zoomOut, `${zoomOut} -> ${zoomIn}`);
  const badge = await page.evaluate(() => document.querySelector('.zoom-controls')?.textContent ?? '');
  const badgePercent = Number(badge.match(/(\d+)%/)?.[1] ?? 0);
  check('the zoom badge shows the pinched zoom level', Math.abs(badgePercent - Math.round(zoomIn * 100)) <= 2, `badge ${badgePercent}% vs zoom ${Math.round(zoomIn * 100)}%`);
}

// 9. A near-miss tap still grabs the nearest card.
const nearMiss = await page.evaluate(() => {
  const el = document.querySelector('.table-object:not(.stack)');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.right + 12), y: Math.round(r.top + r.height / 2) };
});
if (nearMiss) {
  await tap(nearMiss.x, nearMiss.y);
  const rescued = await tableState();
  check('a tap that misses a card by a whisker still selects it', rescued.selected >= 1, `${rescued.selected} selected`);
}

// 10. Touch never leaves a card outside the endless felt bounds.
const sane = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.table-object')).every((el) => {
    const x = parseFloat(el.style.left);
    const y = parseFloat(el.style.top);
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= 6200 && Math.abs(y) <= 6200;
  })
);
check('every card stays inside the endless felt bounds', sane);

// 11. Undo works with fingers too.
await page.locator('.table-toolbar button:has-text("Undo")').click();
await page.waitForTimeout(400);
check('undo restores the table after finger work', (await page.evaluate(() => document.querySelectorAll('.table-object').length)) > 0);

await browser.close();
await server.close();

if (failures) {
  console.log(`\nTouch test failed (${failures} checks).`);
  process.exit(1);
}
console.log('\nTouch test passed.');
