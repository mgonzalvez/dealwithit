import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '../../components/ui';
import {
  getProject,
  getImageBlob,
  listCardDefinitions,
  listDecks,
  listTables,
  saveTable,
  touchProject
} from '../../persistence/repositories';
import {
  CardDefinition,
  DeckDefinition,
  Project,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  TableObject,
  TableState
} from '../../domain/models';
import {
  bringToFront,
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

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const MM_TO_UNITS = 2; // 1 mm = 2 logical table units

interface Snapshot {
  objects: TableObject[];
  camera: { x: number; y: number; zoom: number };
  background: string;
}

interface DragState {
  kind: 'object' | 'pan';
  pointerId: number;
  id?: string;
  dx?: number;
  dy?: number;
  moved: boolean;
  startClientX: number;
  startClientY: number;
  startCamera?: { x: number; y: number; zoom: number };
}

/**
 * Table (M3): launch decks as stacks, drag, flip, shuffle, draw, deal,
 * stack, pan/zoom (wheel, pinch, buttons), auto-save, undo/redo.
 */
export function TablePage({
  projectId,
  navigate
}: {
  projectId?: string;
  navigate: (hash: string) => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [decks, setDecks] = useState<DeckDefinition[]>([]);
  const [cards, setCards] = useState<Map<string, CardDefinition>>(new Map());
  const [faces, setFaces] = useState<Map<string, string>>(new Map());
  const [table, setTable] = useState<TableState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ url: string; x: number; y: number } | null>(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [trayOpen, setTrayOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  const tableRef = useRef<TableState | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const spaceRef = useRef(false);
  const longPressRef = useRef<number | null>(null);
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const fittedRef = useRef(false);

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
        background: '#4a5b4f',
        updatedAt: Date.now()
      };
      await saveTable(table);
    }
    setProject(project ?? null);
    setDecks(decks);
    setCards(new Map(cards.map((c) => [c.id, c])));

    // Pre-render card faces (front + back) at table resolution and cache
    // them as data URLs. Original blobs stay untouched in IndexedDB.
    const faceCache = new Map<string, string>();
    for (const card of cards) {
      const frontBlob = await getImageBlob(card.frontAssetId);
      const frontImage = frontBlob ? await loadImage(frontBlob) : null;
      const backAssetId =
        card.backAssetId ??
        decks.find((d) => d.defaultBackAssetId && d.entries.some((e) => e.cardDefinitionId === card.id))
          ?.defaultBackAssetId;
      const backBlob = backAssetId ? await getImageBlob(backAssetId) : null;
      const backImage = backBlob ? await loadImage(backBlob) : null;
      for (const face of ['front', 'back'] as const) {
        const canvas = document.createElement('canvas');
        renderCardPreview(card, frontImage, backImage, face, canvas, 300);
        faceCache.set(`${card.id}:${face}`, canvas.toDataURL('image/png'));
      }
    }
    setFaces(faceCache);
    setTable(table);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  useEffect(() => {
    if (table && canvasRef.current && !fittedRef.current) {
      fittedRef.current = true;
      fitView();
    }
  }, [table]);

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

  // Keyboard: Space = pan mode, Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
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
  }, []);

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

  function fitView() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const zoom = Math.min(rect.width / TABLE_WIDTH, rect.height / TABLE_HEIGHT);
    setCamera({ x: 0, y: 0, zoom: Math.max(MIN_ZOOM, zoom) });
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
    snapshot();
    const world = worldPoint(event.clientX, event.clientY);
    dragRef.current = {
      kind: 'object',
      pointerId: event.pointerId,
      id: object.id,
      dx: object.x - world.x,
      dy: object.y - world.y,
      moved: false,
      startClientX: event.clientX,
      startClientY: event.clientY
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    longPressRef.current = window.setTimeout(() => setSelectedId(object.id), 600);
  }

  function handleObjectPointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.kind !== 'object' || drag.pointerId !== event.pointerId) return;
    const world = worldPoint(event.clientX, event.clientY);
    const current = tableRef.current;
    if (!current) return;
    drag.moved = true;
    const x = Math.min(TABLE_WIDTH, Math.max(0, world.x + (drag.dx ?? 0)));
    const y = Math.min(TABLE_HEIGHT, Math.max(0, world.y + (drag.dy ?? 0)));
    setTable({
      ...current,
      objects: current.objects.map((o) => (o.id === drag.id ? { ...o, x, y } : o))
    });
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function handleObjectPointerUp(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    if (!drag || drag.kind !== 'object' || drag.pointerId !== event.pointerId) return;
    const current = tableRef.current;
    if (current && drag.moved) {
      const dragged = current.objects.find((o) => o.id === drag.id);
      if (dragged && dragged.type === 'card') {
        const target = current.objects.find(
          (o) =>
            o.id !== dragged.id &&
            o.type === 'stack' &&
            o.cardInstances.length > 0 &&
            Math.abs(dragged.x - o.x) <= cardSize(cards.get(o.cardInstances[o.cardInstances.length - 1].cardDefinitionId)).w / 2 &&
            Math.abs(dragged.y - o.y) <= cardSize(cards.get(o.cardInstances[o.cardInstances.length - 1].cardDefinitionId)).h / 2
        );
        if (target) {
          mutate(
            current.objects
              .filter((o) => o.id !== dragged.id)
              .map((o) => (o.id === target.id ? mergeStack(target, dragged) : o))
          );
        }
      }
    }
    dragRef.current = null;
  }

  function handleCanvasPointerDown(event: React.PointerEvent) {
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
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function launch(deck: DeckDefinition) {
    const current = tableRef.current;
    if (!current) return;
    const stack = launchDeck(
      deck.entries,
      deck.id,
      deck.name,
      TABLE_WIDTH / 2,
      TABLE_HEIGHT / 2 - (current.objects.length % 4) * 90
    );
    mutate([...current.objects, stack]);
  }

  function selectedObject(): TableObject | undefined {
    return tableRef.current?.objects.find((o) => o.id === selectedId);
  }

  function peekTop(object: TableObject) {
    const top = object.cardInstances[object.cardInstances.length - 1];
    if (!top) return;
    const url = faces.get(`${top.cardDefinitionId}:front`) ?? '';
    setPeek({ url, x: object.x, y: object.y - 140 });
    setTimeout(() => setPeek(null), 2500);
  }

  function flipSelected() {
    const object = selectedObject();
    const current = tableRef.current;
    if (!object || !current) return;
    mutate(current.objects.map((o) => (o.id === object.id ? flipTop(o) : o)));
  }

  function shuffleSelected() {
    const object = selectedObject();
    const current = tableRef.current;
    if (!object || !current) return;
    mutate(shuffleStack(object, current.objects));
  }

  function drawOne() {
    const object = selectedObject();
    const current = tableRef.current;
    if (!object || !current) return;
    mutate(drawFromStack(object, current.objects));
  }

  function dealN(n: number) {
    const object = selectedObject();
    const current = tableRef.current;
    if (!object || !current) return;
    mutate(dealFromStack(object, current.objects, n));
  }

  function gatherSelected() {
    const object = selectedObject();
    const current = tableRef.current;
    if (!object || !current) return;
    mutate(gatherInto(object, current.objects, 170));
  }

  function rotateSelected() {
    const object = selectedObject();
    const current = tableRef.current;
    if (!object || !current) return;
    mutate(current.objects.map((o) => (o.id === object.id ? rotateObject(o, 90) : o)));
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
          Surface
          <select value={table.background} onChange={(e) => setBackground(e.target.value)}>
            <option value="#4a5b4f">Felt green</option>
            <option value="#2f4858">Blue felt</option>
            <option value="#7a5c3f">Wood</option>
            <option value="#22262b">Dark</option>
            <option value="#e8e3d8">Light</option>
          </select>
        </label>
        <button type="button" className="btn btn-secondary" onClick={resetTable}>
          Reset table
        </button>
        <span className="save-status" aria-live="polite">{saveStatus || 'Synced'}</span>
      </header>

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
              {decks.map((deck) => (
                <div key={deck.id} className="tray-deck">
                  <div>
                    <strong>{deck.name}</strong>
                    <span className="muted"> · {deckCardCount(deck)} cards</span>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => launch(deck)}>
                    Launch
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        <div
          className="table-canvas"
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
        >
          <div
            className="table-world"
            style={{
              transform: `translate(${table.camera.x}px, ${table.camera.y}px) scale(${table.camera.zoom})`,
              background: table.background
            }}
          >
            {table.objects.map((object) => {
              const top = object.cardInstances[object.cardInstances.length - 1];
              const card = top ? cards.get(top.cardDefinitionId) : undefined;
              const { w, h } = cardSize(card);
              const url = top ? faces.get(`${top.cardDefinitionId}:${top.face}`) ?? '' : '';
              const isStack = object.type === 'stack';
              const layers = Math.min(3, Math.max(0, object.cardInstances.length - 1));
              return (
                <div
                  key={object.id}
                  className={`table-object ${object.id === selectedId ? 'selected' : ''} ${isStack ? 'stack' : ''}`}
                  style={{
                    left: object.x - w / 2,
                    top: object.y - h / 2,
                    width: w,
                    height: h,
                    transform: `rotate(${object.rotationDeg}deg)`,
                    zIndex: object.z + 1
                  }}
                  onPointerDown={(e) => handleObjectPointerDown(e, object)}
                  onPointerMove={handleObjectPointerMove}
                  onPointerUp={handleObjectPointerUp}
                  onDoubleClick={() => {
                    setSelectedId(object.id);
                    const current = tableRef.current;
                    if (current) mutate(current.objects.map((o) => (o.id === object.id ? flipTop(o) : o)));
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSelectedId(object.id);
                  }}
                >
                  {Array.from({ length: layers }, (_, i) => (
                    <div key={i} className={`stack-edge stack-edge-${i + 1}`} aria-hidden="true" />
                  ))}
                  {url && <img src={url} alt={card?.name ?? 'Card'} draggable={false} />}
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
            <button type="button" className="btn btn-secondary" onClick={() => fitView()}>
              Reset view
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                const canvas = canvasRef.current;
                if (canvas) zoomAt(canvas.getBoundingClientRect().left + 200, canvas.getBoundingClientRect().top + 200, 1.25);
              }}
            >
              Zoom +
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                const canvas = canvasRef.current;
                if (canvas) zoomAt(canvas.getBoundingClientRect().left + 200, canvas.getBoundingClientRect().top + 200, 0.8);
              }}
            >
              Zoom −
            </button>
          </div>

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
                  <button type="button" className="btn btn-primary" onClick={drawOne}>
                    Draw 1
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => dealN(3)}>
                    Draw 3
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
