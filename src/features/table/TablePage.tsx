import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '../../components/ui';
import { Coach } from '../../components/Coach';
import { backLabel, resolveBack } from '../../domain/back-designs';
import {
  getProject,
  getImageBlob,
  getSetting,
  listCardDefinitions,
  listDecks,
  listTables,
  saveTable,
  setSetting,
  touchProject
} from '../../persistence/repositories';
import {
  CardDefinition,
  DeckDefinition,
  Project,
  clampWorld,
  TableObject,
  TableState
} from '../../domain/models';
import {
  bringToFront,
  cutStack,
  dealFromStack,
  drawFromStack,
  duplicateObject,
  flipTop,
  gatherInto,
  launchDeck,
  mergeStack,
  removeObject,
  returnToDeck,
  rotateObject,
  sendToBack,
  shuffleStack
} from '../../domain/table-operations';
import { deckCardCount } from '../../domain/deck-operations';
import { loadImage, renderCardPreview } from '../workshop/cardRenderer';
import { playTableSound, setSoundMuted, type TableSound } from './sounds';
import { softSnap, snapRotation, snapTolerance } from './snap';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const MM_TO_UNITS = 2; // 1 mm = 2 logical table units
const HOLD_TO_GRAB_MS = 700; // hold a stack this long to move the whole deck
const FELT_GREEN = '#15372a';
const SHUFFLE_MS = 500;

/** Which texture a surface colour should get. Felt fuzz is for felt only. */
function surfaceClass(background: string): string {
  if (background === '#7a5c3f') return 'surface-wood';
  if (background === '#22262b' || background === '#e8e3d8') return 'surface-plain';
  return 'surface-felt';
}

interface Snapshot {
  objects: TableObject[];
  camera: { x: number; y: number; zoom: number };
  background: string;
}

interface DragState {
  kind: 'object' | 'pan' | 'stack-draw';
  pointerId: number;
  id?: string;
  dx?: number;
  dy?: number;
  moved: boolean;
  startClientX: number;
  startClientY: number;
  startCamera?: { x: number; y: number; zoom: number };
}

interface MenuState {
  id: string;
  left: number;
  top: number;
}

/**
 * Table (M3): launch decks as stacks, drag, flip, shuffle, draw, deal,
 * stack, pan/zoom (wheel, pinch, buttons), auto-save, undo/redo.
 */
export function TablePage({
  projectId,
  navigate,
  focus = false,
  onToggleFocus
}: {
  projectId?: string;
  navigate: (hash: string) => void;
  focus?: boolean;
  onToggleFocus?: () => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [decks, setDecks] = useState<DeckDefinition[]>([]);
  const [cards, setCards] = useState<Map<string, CardDefinition>>(new Map());
  const [table, setTable] = useState<TableState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ url: string; x: number; y: number } | null>(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [trayOpen, setTrayOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drawFaceUp, setDrawFaceUp] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [grabbingId, setGrabbingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [snapOn, setSnapOn] = useState(true);
  const [animations, setAnimations] = useState<Map<string, string>>(new Map());
  const [deckThumbs, setDeckThumbs] = useState<Map<string, { url: string; label: string }>>(new Map());

  const tableRef = useRef<TableState | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const faceCacheRef = useRef<Map<string, string>>(new Map());
  const spaceRef = useRef(false);
  const grabTimerRef = useRef<number | null>(null);
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const fittedRef = useRef(false);
  const edgeColorRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    tableRef.current = table;
  }, [table]);

  async function load() {
    if (!projectId) return;
    const [project, decks, cards, tables] = await Promise.all([
      getProject(projectId),
      listDecks(projectId),
      listCardDefinitions(projectId),
      listTables(projectId)
    ]);
    let table = tables[0];
    if (!table) {
      table = {
        id: crypto.randomUUID(),
        projectId,
        name: 'Main table',
        objects: [],
        camera: { x: 0, y: 0, zoom: 1 },
        background: FELT_GREEN,
        updatedAt: Date.now()
      };
      await saveTable(table);
    } else if (table.background === '#4a5b4f') {
      // Old muted-green default → the deeper felt we ship now.
      table = { ...table, background: FELT_GREEN };
      await saveTable(table);
    }
    setProject(project ?? null);
    setDecks(decks);
    setCards(new Map(cards.map((c) => [c.id, c])));

    // Decode every image the table might need once, then draw faces on demand
    // (and cache the drawing). Original blobs stay untouched in IndexedDB.
    const images = new Map<string, HTMLImageElement>();
    const ensureImage = async (assetId: string | undefined) => {
      if (!assetId || images.has(assetId)) return;
      const blob = await getImageBlob(assetId);
      if (!blob) return;
      const image = await loadImage(blob);
      if (image) images.set(assetId, image);
    };
    for (const card of cards) {
      await ensureImage(card.frontAssetId);
      await ensureImage(card.backAssetId);
    }
    for (const deck of decks) await ensureImage(deck.defaultBackAssetId);
    imagesRef.current = images;
    faceCacheRef.current.clear();

    const thumbs = new Map<string, { url: string; label: string }>();
    for (const deck of decks) {
      const entry = deck.entries[0];
      const card = entry ? cards.find((c) => c.id === entry.cardDefinitionId) : undefined;
      if (!card) continue;
      thumbs.set(deck.id, {
        url: renderFace(card, 'back', deck, 120),
        label: backLabel(resolveBack(card, deck))
      });
    }
    setDeckThumbs(thumbs);

    setTable(table);
    setDrawFaceUp(Boolean(await getSetting(`drawFaceUp:${table.id}`)));
    setSoundMuted((await getSetting('sound')) === false);
    setSnapOn((await getSetting('tableSnap')) !== false);
    setLoading(false);
  }

  /** The colour of the pile's sides: the card back, slightly darker. */
  function edgeColor(card?: CardDefinition, deck?: DeckDefinition): string {
    if (!card) return '#d8d2c4';
    const back = resolveBack(card, deck);
    if (back.kind === 'generated') return back.design.base;
    if (back.kind === 'neutral') return '#1f3a52';
    const cached = edgeColorRef.current.get(back.assetId);
    if (cached) return cached;
    const image = imagesRef.current.get(back.assetId);
    let color = '#d8d2c4';
    if (image) {
      const swatch = document.createElement('canvas');
      swatch.width = 6;
      swatch.height = 6;
      const ctx = swatch.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0, 6, 6);
        const data = ctx.getImageData(0, 0, 6, 6).data;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        const n = data.length / 4;
        color = `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
      }
    }
    edgeColorRef.current.set(back.assetId, color);
    return color;
  }

  /** Draw one face of a card at table resolution, cached by card + face + deck. */
  function renderFace(card: CardDefinition, face: 'front' | 'back', deck?: DeckDefinition, size = 300): string {
    const key = `${card.id}:${face}:${face === 'back' ? deck?.id ?? 'none' : ''}`;
    const cached = faceCacheRef.current.get(key);
    if (cached) return cached;
    const source = resolveBack(card, deck);
    const canvas = document.createElement('canvas');
    renderCardPreview(
      card,
      imagesRef.current.get(card.frontAssetId) ?? null,
      source.kind === 'image' ? imagesRef.current.get(source.assetId) ?? null : null,
      face,
      canvas,
      size,
      source.kind === 'generated' ? source.design : undefined
    );
    const url = canvas.toDataURL('image/png');
    faceCacheRef.current.set(key, url);
    return url;
  }

  function animate(objectIds: string[], kind: string, duration: number) {
    setAnimations((current) => {
      const next = new Map(current);
      for (const id of objectIds) next.set(id, kind);
      return next;
    });
    setTimeout(() => {
      setAnimations((current) => {
        const next = new Map(current);
        for (const id of objectIds) next.delete(id);
        return next;
      });
    }, duration);
  }

  function sound(kind: TableSound) {
    playTableSound(kind);
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  useEffect(() => {
    // The canvas only exists once loading is finished, so this must depend on
    // both — otherwise a freshly launched deck is never framed and can end up
    // outside the visible part of the table.
    if (table && !loading && canvasRef.current && !fittedRef.current) {
      fittedRef.current = true;
      fitView();
    }
  }, [table, loading]);

  // Entering or leaving focus mode changes the size of the felt; keep the
  // cards in the middle of the view.
  useEffect(() => {
    recenter();
  }, [focus]);

  // Resizing the window (or rotating a tablet) should not lose the cards.
  useEffect(() => {
    let timer: number | null = null;
    const onResize = () => {
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(recenter, 250);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Debounced autosave.
  useEffect(() => {
    if (!table) return;
    const timer = setTimeout(async () => {
      try {
        setSaveStatus('Saving…');
        await saveTable(table);
        await touchProject(table.projectId);
        setSaveStatus('Saved ✓');
      } catch (error) {
        setSaveStatus(
          'Save failed — browser storage may be full. Export the project from the Library to keep a backup.'
        );
        console.error('Table save failed:', error);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [table]);

  // Keyboard: Space = pan mode, Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo,
  // Esc = close the menu, then the controls panel, then leave focus mode.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
      if (event.key === 'Escape') {
        if (menu) {
          setMenu(null);
          return;
        }
        if (panelOpen) {
          setPanelOpen(false);
          return;
        }
        if (focus) onToggleFocus?.();
        return;
      }
      if (event.key === ' ') {
        spaceRef.current = true;
        event.preventDefault();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key === ' ') spaceRef.current = false;
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [focus, panelOpen, onToggleFocus]);

  function snapshot() {
    const current = tableRef.current;
    if (!current) return;
    pastRef.current.push({
      objects: structuredClone(current.objects),
      camera: structuredClone(current.camera),
      background: current.background
    });
    if (pastRef.current.length > 50) pastRef.current.shift();
    futureRef.current = [];
  }

  function undo() {
    const current = tableRef.current;
    const previous = pastRef.current.pop();
    if (!current || !previous) return;
    futureRef.current.push({
      objects: structuredClone(current.objects),
      camera: structuredClone(current.camera),
      background: current.background
    });
    setTable({ ...current, objects: previous.objects, camera: previous.camera, background: previous.background });
  }

  function redo() {
    const current = tableRef.current;
    const next = futureRef.current.pop();
    if (!current || !next) return;
    pastRef.current.push({
      objects: structuredClone(current.objects),
      camera: structuredClone(current.camera),
      background: current.background
    });
    setTable({ ...current, objects: next.objects, camera: next.camera, background: next.background });
  }

  function mutate(objects: TableObject[]) {
    const current = tableRef.current;
    if (!current) return;
    snapshot();
    setTable({ ...current, objects, updatedAt: Date.now() });
    setSaveStatus('Unsaved');
  }

  function setCamera(camera: { x: number; y: number; zoom: number }) {
    const current = tableRef.current;
    if (!current) return;
    setTable({ ...current, camera });
  }

  function worldPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    const camera = tableRef.current?.camera ?? { x: 0, y: 0, zoom: 1 };
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - camera.x) / camera.zoom,
      y: (clientY - rect.top - camera.y) / camera.zoom
    };
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const canvas = canvasRef.current;
    const current = tableRef.current;
    if (!canvas || !current) return;
    const rect = canvas.getBoundingClientRect();
    const world = worldPoint(clientX, clientY);
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.camera.zoom * factor));
    setCamera({
      x: clientX - rect.left - world.x * zoom,
      y: clientY - rect.top - world.y * zoom,
      zoom
    });
  }

  /** Smoothly tween the camera to a target over ~260 ms. */
  function animateCamera(target: { x: number; y: number; zoom: number }, duration = 260) {
    const current = tableRef.current;
    if (!current) return;
    const start = { ...current.camera };
    const t0 = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const k = ease(t);
      setCamera({
        x: start.x + (target.x - start.x) * k,
        y: start.y + (target.y - start.y) * k,
        zoom: start.zoom + (target.zoom - start.zoom) * k
      });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function contentBounds() {
    const current = tableRef.current;
    if (!current || current.objects.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const object of current.objects) {
      const top = object.cardInstances[object.cardInstances.length - 1];
      const { w, h } = cardSize(top ? cards.get(top.cardDefinitionId) : undefined);
      minX = Math.min(minX, object.x - w / 2);
      minY = Math.min(minY, object.y - h / 2);
      maxX = Math.max(maxX, object.x + w / 2);
      maxY = Math.max(maxY, object.y + h / 2);
    }
    return { minX, minY, maxX, maxY };
  }

  /** Keep whatever the player is looking at centred when the table resizes. */
  function recenter() {
    const canvas = canvasRef.current;
    const current = tableRef.current;
    if (!canvas || !current) return;
    const bounds = contentBounds();
    const zoom = current.camera.zoom;
    const cx = bounds ? (bounds.minX + bounds.maxX) / 2 : 0;
    const cy = bounds ? (bounds.minY + bounds.maxY) / 2 : 0;
    animateCamera({
      x: canvas.clientWidth / 2 - cx * zoom,
      y: canvas.clientHeight / 2 - cy * zoom,
      zoom
    });
  }

  /** World coordinates at the middle of what the player is currently looking at. */
  function viewCentre(): { x: number; y: number } {
    const canvas = canvasRef.current;
    const camera = tableRef.current?.camera ?? { x: 0, y: 0, zoom: 1 };
    if (!canvas) return { x: 0, y: 0 };
    return {
      x: (canvas.clientWidth / 2 - camera.x) / camera.zoom,
      y: (canvas.clientHeight / 2 - camera.y) / camera.zoom
    };
  }

  /** Fit the camera to the cards on the table (or a comfortable default). */
  function fitView(animate = true) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const bounds = contentBounds();
    if (!bounds) {
      // Nothing on the felt yet: put the world origin in the middle of the view.
      const target = { x: rect.width / 2, y: rect.height / 2, zoom: 1 };
      if (animate) animateCamera(target);
      else setCamera(target);
      return;
    }
    const padding = 60;
    const w = bounds.maxX - bounds.minX + padding * 2;
    const h = bounds.maxY - bounds.minY + padding * 2;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(rect.width / w, rect.height / h, 1.5)));
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const target = {
      x: rect.width / 2 - centerX * zoom,
      y: rect.height / 2 - centerY * zoom,
      zoom
    };
    if (animate) animateCamera(target);
    else setCamera(target);
  }

  function quickZoom(factor: number) {
    const canvas = canvasRef.current;
    const current = tableRef.current;
    if (!canvas || !current) return;
    const rect = canvas.getBoundingClientRect();
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.camera.zoom * factor));
    const worldCenter = {
      x: (rect.width / 2 - current.camera.x) / current.camera.zoom,
      y: (rect.height / 2 - current.camera.y) / current.camera.zoom
    };
    animateCamera({
      x: rect.width / 2 - worldCenter.x * zoom,
      y: rect.height / 2 - worldCenter.y * zoom,
      zoom
    });
  }

  // Wheel zoom + pinch gestures.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.1 : 0.9);
    };
    let pinch: { dist: number } | null = null;
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        const [a, b] = event.touches;
        pinch = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && pinch) {
        event.preventDefault();
        const [a, b] = event.touches;
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        zoomAt((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, dist / pinch.dist);
        pinch = { dist };
      }
    };
    const onTouchEnd = () => {
      pinch = null;
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart);
    canvas.addEventListener('touchmove', onTouchMove);
    canvas.addEventListener('touchend', onTouchEnd);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  function cardSize(card: CardDefinition | undefined) {
    if (!card) return { w: 127, h: 178 };
    return { w: Math.round(card.widthMm * MM_TO_UNITS), h: Math.round(card.heightMm * MM_TO_UNITS) };
  }

  /** Grid pitch shown while a particular card is in hand. */
  function gridPitch(objectId: string | null): { w: number; h: number } {
    if (!objectId) return { w: 127, h: 178 };
    const object = tableRef.current?.objects.find((o) => o.id === objectId);
    const top = object?.cardInstances[object.cardInstances.length - 1];
    return cardSize(top ? cards.get(top.cardDefinitionId) : undefined);
  }

  function startPan(event: React.PointerEvent) {
    const current = tableRef.current;
    if (!current) return;
    dragRef.current = {
      kind: 'pan',
      pointerId: event.pointerId,
      moved: false,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCamera: { ...current.camera }
    };
  }

  function handleObjectPointerDown(event: React.PointerEvent, object: TableObject) {
    if (event.button !== 0) return;
    if (spaceRef.current) return; // Space = pan mode; let it fall through to the canvas.
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(object.id);
    setDraggingId(object.id);
    sound('pickup');
    // Dragging a stack peels its top card (drag-to-draw). Hold Shift to slide
    // the whole stack instead.
    const peel =
      object.type === 'stack' &&
      object.cardInstances.length > 1 &&
      !event.shiftKey;
    const world = worldPoint(event.clientX, event.clientY);
    if (!peel) {
      snapshot();
      // Whatever you grab comes to the front so it never slides under
      // other cards while you move it.
      if (tableRef.current) {
        setTable({
          ...tableRef.current,
          objects: bringToFront(tableRef.current.objects, object.id),
          updatedAt: Date.now()
        });
        setSaveStatus('Unsaved');
      }
    }
    dragRef.current = {
      kind: peel ? 'stack-draw' : 'object',
      pointerId: event.pointerId,
      id: object.id,
      dx: object.x - world.x,
      dy: object.y - world.y,
      moved: false,
      startClientX: event.clientX,
      startClientY: event.clientY
    };
    setMenu(null);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    if (peel) {
      // Hold still for a beat and the whole stack comes with you.
      if (grabTimerRef.current) clearTimeout(grabTimerRef.current);
      grabTimerRef.current = window.setTimeout(() => {
        const drag = dragRef.current;
        if (drag && drag.kind === 'stack-draw' && !drag.moved) {
          snapshot();
          if (tableRef.current) {
            setTable({
              ...tableRef.current,
              objects: bringToFront(tableRef.current.objects, object.id),
              updatedAt: Date.now()
            });
            setSaveStatus('Unsaved');
          }
          dragRef.current = { ...drag, kind: 'object' };
          setGrabbingId(object.id);
        }
      }, HOLD_TO_GRAB_MS);
    }
  }

  function handleObjectPointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind === 'stack-draw') {
      // Only peel once the pointer has actually travelled a little, so a
      // plain click on a stack just selects it.
      const travelled = Math.hypot(
        event.clientX - drag.startClientX,
        event.clientY - drag.startClientY
      );
      if (travelled < 8) return;
      if (grabTimerRef.current) {
        clearTimeout(grabTimerRef.current);
        grabTimerRef.current = null;
      }
      const current = tableRef.current;
      if (!current) return;
      const stack = current.objects.find((o) => o.id === drag.id);
      if (!stack || stack.cardInstances.length === 0) {
        dragRef.current = null;
        return;
      }
      snapshot();
      const objects = drawFromStack(stack, current.objects, { faceUp: drawFaceUp });
      sound('draw');
      const drawn = objects.find(
        (o) => o.type === 'card' && !current.objects.some((c) => c.id === o.id)
      );
      if (!drawn) {
        dragRef.current = null;
        return;
      }
      const world = worldPoint(event.clientX, event.clientY);
      setTable({
        ...current,
        objects: objects.map((o) => (o.id === drawn.id ? { ...o, x: world.x, y: world.y } : o)),
        updatedAt: Date.now()
      });
      setSaveStatus('Unsaved');
      setSelectedId(drawn.id);
      dragRef.current = {
        kind: 'object',
        pointerId: event.pointerId,
        id: drawn.id,
        dx: 0,
        dy: 0,
        moved: true,
        startClientX: event.clientX,
        startClientY: event.clientY
      };
      return;
    }
    if (drag.kind !== 'object') return;
    const world = worldPoint(event.clientX, event.clientY);
    const current = tableRef.current;
    if (!current) return;
    drag.moved = true;
    // The felt has no edge, so cards can go anywhere; only a sanity limit stops
    // a stray drag from sending a card to the stratosphere.
    const rawX = clampWorld(world.x + (drag.dx ?? 0));
    const rawY = clampWorld(world.y + (drag.dy ?? 0));
    let x = rawX;
    let y = rawY;
    if (snapOn) {
      const dragged = current.objects.find((o) => o.id === drag.id);
      const topCard = dragged ? cards.get(dragged.cardInstances[dragged.cardInstances.length - 1]?.cardDefinitionId) : undefined;
      const size = cardSize(topCard);
      const others = current.objects.filter((o) => o.id !== drag.id);
      x = softSnap(x, size.w, snapTolerance(size.w), others.map((o) => o.x));
      y = softSnap(y, size.h, snapTolerance(size.h), others.map((o) => o.y));
    }
    setTable({
      ...current,
      objects: current.objects.map((o) => (o.id === drag.id ? { ...o, x, y } : o))
    });
  }

  function handleObjectPointerUp(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (grabTimerRef.current) {
      clearTimeout(grabTimerRef.current);
      grabTimerRef.current = null;
    }
    setGrabbingId(null);
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind !== 'object') {
      // A click on a stack that never moved: just a selection, no draw.
      dragRef.current = null;
      return;
    }
    const current = tableRef.current;
    if (current && drag.moved) {
      const dragged = current.objects.find((o) => o.id === drag.id);
      let objects = current.objects;
      let changed = false;

      // Squaring up: a card within a few degrees of square straightens itself.
      if (snapOn && dragged) {
        objects = objects.map((o) => (o.id === drag.id ? { ...o, rotationDeg: snapRotation(o.rotationDeg) } : o));
        changed = objects.some((o, index) => o.rotationDeg !== current.objects[index].rotationDeg);
      }

      if (dragged && dragged.type === 'card') {
        const target = objects.find(
          (o) =>
            o.id !== dragged.id &&
            o.type === 'stack' &&
            o.cardInstances.length > 0 &&
            Math.abs(dragged.x - o.x) <= cardSize(cards.get(o.cardInstances[o.cardInstances.length - 1].cardDefinitionId)).w / 2 &&
            Math.abs(dragged.y - o.y) <= cardSize(cards.get(o.cardInstances[o.cardInstances.length - 1].cardDefinitionId)).h / 2
        );
        if (target) {
          objects = objects
            .filter((o) => o.id !== dragged.id)
            .map((o) => (o.id === target.id ? mergeStack(target, dragged) : o));
          changed = true;
        }
      }

      if (changed) mutate(objects);
      if (drag.moved) sound('place');
    }
    dragRef.current = null;
    setDraggingId(null);
  }

  function handleCanvasPointerDown(event: React.PointerEvent) {
    // Clicks inside the context menu or zoom controls must not close the
    // menu or start a pan — otherwise the button's click handler is removed
    // from the DOM before the click fires.
    if (event.target instanceof HTMLElement && event.target.closest('.context-menu, .zoom-controls, .action-bar')) return;
    if (event.button !== 0) return;
    if (menu) setMenu(null);
    if (dragRef.current) return;
    startPan(event);
  }

  function handleCanvasPointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.kind !== 'pan' || drag.pointerId !== event.pointerId) return;
    setCamera({
      x: drag.startCamera!.x + (event.clientX - drag.startClientX),
      y: drag.startCamera!.y + (event.clientY - drag.startClientY),
      zoom: drag.startCamera!.zoom
    });
  }

  function handleCanvasPointerUp(event: React.PointerEvent) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setDraggingId(null);
    }
  }

  function launch(deck: DeckDefinition) {
    const current = tableRef.current;
    if (!current) return;
    const wasEmpty = current.objects.length === 0;
    // Drop the pack where the player is looking, not at a fixed spot on an
    // imaginary 1600x1000 board.
    const centre = viewCentre();
    const stack = launchDeck(
      deck.entries,
      deck.id,
      deck.name,
      centre.x + (current.objects.length % 4) * 70,
      centre.y - (current.objects.length % 4) * 70
    );
    mutate([...current.objects, stack]);
    sound('place');
    if (wasEmpty) {
      // First deck on an empty table: zoom in on it instead of the whole felt.
      setTimeout(() => fitView(), 60);
    }
  }

  function selectedObject(): TableObject | undefined {
    return tableRef.current?.objects.find((o) => o.id === selectedId);
  }

  /** Apply an action to an object by id (used by the context menu). */
  function applyTo(id: string, fn: (objects: TableObject[], object: TableObject) => TableObject[], withSound?: TableSound) {
    const current = tableRef.current;
    if (!current) return;
    const object = current.objects.find((o) => o.id === id);
    if (!object) return;
    mutate(fn(current.objects, object));
    if (withSound) {
      if (withSound === 'shuffle') animate([id], 'shuffle', SHUFFLE_MS);
      sound(withSound);
    }
    setMenu(null);
  }

  function openContextMenu(event: React.MouseEvent, object: TableObject) {
    event.preventDefault();
    setSelectedId(object.id);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setMenu({
      id: object.id,
      left: Math.min(Math.max(8, event.clientX - rect.left), rect.width - 220),
      top: Math.min(Math.max(8, event.clientY - rect.top), rect.height - 240)
    });
  }

  function peekTop(object: TableObject) {
    const top = object.cardInstances[object.cardInstances.length - 1];
    if (!top) return;
    const card = cards.get(top.cardDefinitionId);
    const deck = object.sourceDeckId ? decks.find((d) => d.id === object.sourceDeckId) : undefined;
    if (!card) return;
    setPeek({ url: renderFace(card, 'front', deck), x: object.x, y: object.y - 140 });
    setTimeout(() => setPeek(null), 2500);
  }

  function flipSelected() {
    const object = selectedObject();
    const current = tableRef.current;
    if (!object || !current) return;
    mutate(current.objects.map((o) => (o.id === object.id ? flipTop(o) : o)));
    sound('flip');
  }

  function shuffleSelected() {
    const object = selectedObject();
    const current = tableRef.current;
    if (!object || !current) return;
    mutate(shuffleStack(object, current.objects));
    animate([object.id], 'shuffle', SHUFFLE_MS);
    sound('shuffle');
  }

  function cutSelected() {
    const object = selectedObject();
    const current = tableRef.current;
    if (!object || !current) return;
    mutate(cutStack(object, current.objects));
    sound('cut');
  }

  function drawOne() {
    const object = selectedObject();
    const current = tableRef.current;
    if (!object || !current) return;
    mutate(drawFromStack(object, current.objects, { faceUp: drawFaceUp }));
    sound('draw');
  }

  function dealN(n: number) {
    const object = selectedObject();
    const current = tableRef.current;
    if (!object || !current) return;
    const before = new Set(current.objects.map((o) => o.id));
    const objects = dealFromStack(object, current.objects, n, { faceUp: drawFaceUp });
    mutate(objects);
    const dealt = objects.filter((o) => !before.has(o.id)).map((o) => o.id);
    animate(dealt, 'dealt', 320);
    dealt.forEach((_, index) => setTimeout(() => sound('deal'), index * 150));
  }

  function dealPrompt() {
    const raw = window.prompt('How many cards to deal?', '5');
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) dealN(Math.min(50, n));
  }

  function changeDrawFaceUp(value: string) {
    const faceUp = value === 'up';
    setDrawFaceUp(faceUp);
    const current = tableRef.current;
    if (current) void setSetting(`drawFaceUp:${current.id}`, faceUp);
  }

  function gatherSelected() {
    const object = selectedObject();
    const current = tableRef.current;
    if (!object || !current) return;
    mutate(gatherInto(object, current.objects, 170));
    sound('gather');
  }

  function rotateSelected() {
    const object = selectedObject();
    const current = tableRef.current;
    if (!object || !current) return;
    mutate(current.objects.map((o) => (o.id === object.id ? rotateObject(o, 90) : o)));
    sound('flip');
  }

  function duplicateSelected() {
    const current = tableRef.current;
    if (!current || !selectedId) return;
    mutate(duplicateObject(current.objects, selectedId));
  }

  function returnSelectedToDeck() {
    const current = tableRef.current;
    if (!current || !selectedId) return;
    const object = current.objects.find((o) => o.id === selectedId);
    if (!object) return;
    mutate(returnToDeck(current.objects, object));
  }

  function deleteSelected() {
    const current = tableRef.current;
    if (!current || !selectedId) return;
    mutate(removeObject(current.objects, selectedId));
    setSelectedId(null);
  }

  function resetTable() {
    if (!window.confirm('Remove every card and stack from the table?')) return;
    mutate([]);
  }

  function setBackground(color: string) {
    const current = tableRef.current;
    if (!current) return;
    snapshot();
    setTable({ ...current, background: color, updatedAt: Date.now() });
    setSaveStatus('Unsaved');
  }

  if (!projectId) {
    return (
      <section className="table-page">
        <h1>Table</h1>
        <EmptyState
          title="Choose a project first"
          message="Open a project from the Library to play on the table."
        />
      </section>
    );
  }

  if (loading || !table) {
    return (
      <section className="table-page">
        <h1>Table</h1>
        <p className="muted">Loading table…</p>
      </section>
    );
  }

  const selected = selectedObject();

  return (
    <section className="table-page">
      <header className="table-toolbar">
        <strong>{project ? `Table — ${project.name}` : 'Table'}</strong>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('#/library')}>
          Library
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => navigate(`#/workshop/${projectId}`)}>
          Workshop
        </button>
        <button type="button" className="btn btn-secondary" onClick={undo}>
          Undo
        </button>
        <button type="button" className="btn btn-secondary" onClick={redo}>
          Redo
        </button>
        <label className="bg-picker">
          Draw
          <select value={drawFaceUp ? 'up' : 'down'} onChange={(e) => changeDrawFaceUp(e.target.value)}>
            <option value="down">Face-down</option>
            <option value="up">Face-up</option>
          </select>
        </label>
        <label className="bg-picker">
          Surface
          <select value={table.background} onChange={(e) => setBackground(e.target.value)}>
            <option value="#15372a">Deep felt green</option>
            <option value="#1f3a52">Blue felt</option>
            <option value="#5a2b2b">Red felt</option>
            <option value="#7a5c3f">Wood</option>
            <option value="#22262b">Dark</option>
            <option value="#e8e3d8">Light</option>
            <option value="#ffffff">Custom…</option>
          </select>
        </label>
        <button
          type="button"
          className="tips-toggle"
          aria-pressed={snapOn}
          onClick={() => {
            const next = !snapOn;
            setSnapOn(next);
            void setSetting('tableSnap', next);
          }}
          title="Cards line up with an invisible grid when you drop them near one"
        >
          Snap {snapOn ? 'on' : 'off'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={resetTable}>
          Clear table
        </button>
        <span className="save-status" aria-live="polite">{saveStatus || 'Synced'}</span>
      </header>

      <div className="table-toolbar-notes">
        <Coach
          text="Sound plays the riffle when you shuffle, the snap when a card flips and the thwip when cards are dealt. Snap makes a card line up with the grid — or with a card it is already near — but only if it is already close."
        />
      </div>

      <div className="table-main">
        <aside className={`tray ${trayOpen ? '' : 'tray-closed'}`}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setTrayOpen((open) => !open)}
            aria-expanded={trayOpen}
          >
            {trayOpen ? 'Hide decks' : 'Show decks'}
          </button>
          {trayOpen && (
            <div className="tray-decks">
              {decks.length === 0 && <p className="muted">No decks yet — build one in the Workshop.</p>}
              <Coach
                text="Launch a deck and it appears as a face-down stack. Drag the top card off it to draw, or hold a stack briefly and drag to carry the whole deck."
              />
              {decks.map((deck) => {
                const thumb = deckThumbs.get(deck.id);
                return (
                  <div key={deck.id} className="tray-deck">
                    <div className="tray-deck-body">
                      <div>
                        <strong>{deck.name}</strong>
                        <span className="muted"> · {deckCardCount(deck)} cards</span>
                      </div>
                      <span className="muted tray-deck-back">{thumb ? thumb.label : 'no cards yet'}</span>
                    </div>
                    {thumb ? (
                      <img className="tray-deck-thumb" src={thumb.url} alt={`${deck.name} card back`} />
                    ) : (
                      <span className="back-none">no cards</span>
                    )}
                    <button type="button" className="btn btn-primary" onClick={() => launch(deck)}>
                      Launch
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        <div
          className={`table-canvas ${surfaceClass(table.background)}`}
          ref={canvasRef}
          style={{ backgroundColor: table.background }}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
        >
          <div
            className={`table-world ${snapOn && draggingId ? 'grid-on' : ''}`}
            style={{
              transform: `translate(${table.camera.x}px, ${table.camera.y}px) scale(${table.camera.zoom})`,
              ['--grid-x' as string]: `${gridPitch(draggingId).w}px`,
              ['--grid-y' as string]: `${gridPitch(draggingId).h}px`
            }}
          >
            {table.objects.map((object) => {
              const top = object.cardInstances[object.cardInstances.length - 1];
              const card = top ? cards.get(top.cardDefinitionId) : undefined;
              const deck = object.sourceDeckId ? decks.find((d) => d.id === object.sourceDeckId) : undefined;
              const { w, h } = cardSize(card);
              const url = card ? renderFace(card, top.face, deck) : '';
              const isStack = object.type === 'stack';
              const layers = Math.min(6, Math.max(0, object.cardInstances.length - 1));
              const layerStep = object.cardInstances.length > 24 ? 2.5 : 4;
              const animation = animations.get(object.id);
              return (
                <div
                  key={object.id}
                  className={`table-object ${object.id === selectedId ? 'selected' : ''} ${isStack ? 'stack' : ''} ${object.id === grabbingId ? 'grabbing' : ''} ${animation ? `anim-${animation}` : ''}`}
                  style={{
                    left: object.x - w / 2,
                    top: object.y - h / 2,
                    width: w,
                    height: h,
                    ['--rot' as string]: `${object.rotationDeg}deg`,
                    ['--edge-color' as string]: isStack ? edgeColor(card, deck) : undefined,
                    transform: `rotate(${object.rotationDeg}deg)`,
                    zIndex: object.z + 1
                  }}
                  onPointerDown={(e) => handleObjectPointerDown(e, object)}
                  onPointerMove={handleObjectPointerMove}
                  onPointerUp={handleObjectPointerUp}
                  onDoubleClick={() => {
                    setSelectedId(object.id);
                    const current = tableRef.current;
                    if (current) {
                      mutate(current.objects.map((o) => (o.id === object.id ? flipTop(o) : o)));
                      sound('flip');
                    }
                  }}
                  onContextMenu={(e) => openContextMenu(e, object)}
                >
                  {Array.from({ length: layers }, (_, i) => (
                    <div
                      key={i}
                      className="stack-edge"
                      aria-hidden="true"
                      style={{
                        ['--ex' as string]: `${-(i + 1) * layerStep}px`,
                        ['--ey' as string]: `${-(i + 1) * layerStep}px`
                      }}
                    />
                  ))}
                  {url && <img src={url} alt={card?.name ?? 'Card'} draggable={false} />}
                  {animation === 'shuffle' && url && (
                    <div className="shuffle-split" aria-hidden="true">
                      <div className="shuffle-half left"><img src={url} alt="" /></div>
                      <div className="shuffle-half right"><img src={url} alt="" /></div>
                    </div>
                  )}
                  {isStack && <span className="count-badge">{object.cardInstances.length}</span>}
                </div>
              );
            })}

            {peek && (
              <div className="peek-overlay" style={{ left: peek.x - 127, top: peek.y - 178 }}>
                <img src={peek.url} alt="Peeked card" />
                <span className="muted">Peek (only visible on this device)</span>
              </div>
            )}
          </div>

          <div className="zoom-controls">
            {focus && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPanelOpen((open) => !open)}
                aria-expanded={panelOpen}
                title="Table controls"
              >
                Controls
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => fitView()}>
              Fit cards
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => quickZoom(1.25)}>
              Zoom +
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => quickZoom(0.8)}>
              Zoom −
            </button>
            <span className="zoom-level" aria-live="off">
              {Math.round(table.camera.zoom * 100)}%
            </span>
          </div>

          {focus && panelOpen && (
            <div className="focus-panel" role="group" aria-label="Table controls">
              <div className="focus-panel-row">
                <button type="button" className="btn btn-secondary" onClick={undo}>Undo</button>
                <button type="button" className="btn btn-secondary" onClick={redo}>Redo</button>
                <label className="bg-picker">
                  Draw
                  <select value={drawFaceUp ? 'up' : 'down'} onChange={(e) => changeDrawFaceUp(e.target.value)}>
                    <option value="down">Face-down</option>
                    <option value="up">Face-up</option>
                  </select>
                </label>
                <label className="bg-picker">
                  Surface
                  <select value={table.background} onChange={(e) => setBackground(e.target.value)}>
                    <option value="#15372a">Deep felt green</option>
                    <option value="#1f3a52">Blue felt</option>
                    <option value="#5a2b2b">Red felt</option>
                    <option value="#7a5c3f">Wood</option>
                    <option value="#22262b">Dark</option>
                    <option value="#e8e3d8">Light</option>
                    <option value="#ffffff">Custom…</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="tips-toggle"
                  aria-pressed={snapOn}
                  onClick={() => {
                    const next = !snapOn;
                    setSnapOn(next);
                    void setSetting('tableSnap', next);
                  }}
                >
                  Snap {snapOn ? 'on' : 'off'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetTable}>
                  Clear table
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => navigate('#/library')}>
                  Library
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => navigate(`#/workshop/${projectId}`)}>
                  Workshop
                </button>
              </div>
              <div className="focus-panel-row">
                {decks.length === 0 && <span className="muted">No decks in this project yet.</span>}
                {decks.map((deck) => (
                  <button key={deck.id} type="button" className="btn btn-primary" onClick={() => launch(deck)}>
                    {deck.name} ({deck.entries.reduce((sum, entry) => sum + entry.quantity, 0)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {menu && (() => {
            const object = table.objects.find((o) => o.id === menu.id);
            if (!object) return null;
            const isStack = object.type === 'stack' && object.cardInstances.length > 1;
            const top = object.cardInstances[object.cardInstances.length - 1];
            const name = isStack
              ? object.label ?? 'Stack'
              : cards.get(top?.cardDefinitionId)?.name ?? 'Card';
            return (
              <div
                className="context-menu"
                role="menu"
                aria-label="Object actions"
                style={{ left: menu.left, top: menu.top }}
                onPointerDown={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
              >
                <strong>{name}{isStack ? ` · ${object.cardInstances.length} cards` : ''}</strong>
                <div className="context-menu-actions">
                  <button type="button" role="menuitem" onClick={() => applyTo(menu.id, (objects) => objects.map((x) => (x.id === menu.id ? flipTop(x) : x)), 'flip')}>
                    Flip top
                  </button>
                  <button type="button" role="menuitem" onClick={() => applyTo(menu.id, (objects) => objects.map((x) => (x.id === menu.id ? rotateObject(x, 90) : x)))}>
                    Rotate 90°
                  </button>
                  {isStack ? (
                    <>
                      <button type="button" role="menuitem" onClick={() => applyTo(menu.id, (objects, o) => shuffleStack(o, objects), 'shuffle')}>
                        Shuffle
                      </button>
                      <button type="button" role="menuitem" onClick={() => applyTo(menu.id, (objects, o) => cutStack(o, objects), 'cut')}>
                        Cut
                      </button>
                      <button type="button" role="menuitem" onClick={() => applyTo(menu.id, (objects, o) => drawFromStack(o, objects, { faceUp: drawFaceUp }), 'draw')}>
                        Draw 1
                      </button>
                      <button type="button" role="menuitem" onClick={() => applyTo(menu.id, (objects, o) => dealFromStack(o, objects, 3, { faceUp: drawFaceUp }), 'deal')}>
                        Draw 3
                      </button>
                      <button type="button" role="menuitem" onClick={() => applyTo(menu.id, (objects, o) => gatherInto(o, objects, 170), 'gather')}>
                        Gather
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" role="menuitem" onClick={() => applyTo(menu.id, (objects) => bringToFront(objects, menu.id))}>
                        Bring to front
                      </button>
                      <button type="button" role="menuitem" onClick={() => applyTo(menu.id, (objects) => sendToBack(objects, menu.id))}>
                        Send to back
                      </button>
                      <button type="button" role="menuitem" onClick={() => applyTo(menu.id, (objects) => duplicateObject(objects, menu.id))}>
                        Duplicate
                      </button>
                      {object.sourceDeckId ? (
                        <button type="button" role="menuitem" onClick={() => applyTo(menu.id, (objects, o) => returnToDeck(objects, o))}>
                          Return to deck
                        </button>
                      ) : null}
                    </>
                  )}
                  <button type="button" role="menuitem" className="danger" onClick={() => { applyTo(menu.id, (objects) => removeObject(objects, menu.id)); setSelectedId(null); }}>
                    Delete
                  </button>
                </div>
                <p className="muted context-menu-hint">Hold a stack to move it · Shift+drag too</p>
              </div>
            );
          })()}

          {selected && (
            <div className="action-bar" role="group" aria-label="Card actions">
              <button type="button" className="btn btn-secondary" onClick={flipSelected}>
                Flip
              </button>
              <button type="button" className="btn btn-secondary" onClick={rotateSelected}>
                Rotate 90°
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const current = tableRef.current;
                  if (current && selectedId) mutate(bringToFront(current.objects, selectedId));
                }}
              >
                Bring to front
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const current = tableRef.current;
                  if (current && selectedId) mutate(sendToBack(current.objects, selectedId));
                }}
              >
                Send to back
              </button>
              <button type="button" className="btn btn-secondary" onClick={duplicateSelected}>
                Duplicate
              </button>
              {selected.type === 'stack' ? (
                <>
                  <button type="button" className="btn btn-primary" onClick={shuffleSelected}>
                    Shuffle
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={cutSelected}>
                    Cut
                  </button>
                  <button type="button" className="btn btn-primary" onClick={drawOne}>
                    Draw 1
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => dealN(3)}>
                    Draw 3
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={dealPrompt}>
                    Deal N…
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={gatherSelected}>
                    Gather
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => peekTop(selected)}>
                    Peek top
                  </button>
                </>
              ) : selected.sourceDeckId ? (
                <button type="button" className="btn btn-primary" onClick={returnSelectedToDeck}>
                  Return to deck
                </button>
              ) : null}
              <button type="button" className="btn btn-danger" onClick={deleteSelected}>
                Delete
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
