import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, EmptyState } from '../../components/ui';
import {
  deleteCardDefinition,
  deleteDeck,
  ensureCardFromAsset,
  getProject,
  getImageBlob,
  listCardDefinitions,
  listDecks,
  listImageAssets,
  listThumbnails,
  saveCardDefinition,
  saveDeck,
  saveImageAsset,
  saveThumbnail,
  touchProject
} from '../../persistence/repositories';
import {
  addEntryToDeck,
  createDeck,
  deckCardCount,
  duplicateDeck,
  moveEntry,
  renameDeck,
  removeEntry,
  setDefaultBack,
  setEntryQuantity
} from '../../domain/deck-operations';
import { rotateTransform } from '../../domain/transforms';
import { CardDefinition, DeckDefinition, ImageAsset, Project } from '../../domain/models';
import { ImportDestination, ImportStaging } from '../import/ImportStaging';
import { AssetBrowser } from '../import/AssetBrowser';
import { commitStagedItems, stageEntries, ImportEntry, StagedItem } from '../import/pipeline';
import { parseImageZip, PairingInfo } from '../import/zipImport';
import { makeThumbnail, probeImage } from '../import/imageMeta';
import { CardEditor } from './CardEditor';
import { DeckBuilder } from './DeckBuilder';

type WorkshopTab = 'import' | 'cards' | 'decks';

/**
 * Workshop (M1 + M2): import images/ZIPs, build card definitions with
 * transforms and physical sizes, and assemble deck recipes. Everything
 * autosaves to IndexedDB.
 */
export function WorkshopPage({ projectId }: { projectId?: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<WorkshopTab>('import');

  // Import state
  const [staged, setStaged] = useState<StagedItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [zipErrors, setZipErrors] = useState<string[]>([]);
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [destination, setDestination] = useState<ImportDestination>('library');
  const [draftName, setDraftName] = useState('Draft deck');
  const [existingDeckId, setExistingDeckId] = useState('');
  const [committedMessage, setCommittedMessage] = useState<string | null>(null);

  // Library / cards / decks
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [cards, setCards] = useState<CardDefinition[]>([]);
  const [decks, setDecks] = useState<DeckDefinition[]>([]);
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<{ asset: ImageAsset; url: string } | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const zipInputRef = useRef<HTMLInputElement | null>(null);

  async function refresh() {
    if (!projectId) return;
    const [project, assets, decks, thumbnails, cards] = await Promise.all([
      getProject(projectId),
      listImageAssets(projectId),
      listDecks(projectId),
      listThumbnails(projectId),
      listCardDefinitions(projectId)
    ]);
    setProject(project ?? null);
    setAssets(assets);
    setDecks(decks);
    setThumbnails(new Map(thumbnails.map((t) => [t.assetId, t.dataUrl])));
    setCards(cards);
    if (decks.length > 0 && !activeDeckId) setActiveDeckId(decks[0].id);
    if (decks.length > 0 && !existingDeckId) setExistingDeckId(decks[0].id);
  }

  useEffect(() => {
    void refresh();
  }, [projectId]);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length > 0) {
        event.preventDefault();
        void handleFiles(files);
      }
    }
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [projectId]);

  function markSaved() {
    setSaveStatus('Saved ✓');
    setTimeout(() => setSaveStatus(null), 2000);
  }

  async function handleFiles(files: File[]) {
    if (!projectId || busy) return;
    setBusy(true);
    setCancelled(false);
    setCommittedMessage(null);
    setZipErrors([]);
    setPairing(null);
    setProgress({ processed: 0, total: files.length });

    const existingAssets = await listImageAssets(projectId);
    const existingHashes = new Set(existingAssets.map((a) => a.sha256));
    const stagingItems = [...staged];
    const newSelection = new Set(selected);

    for (const file of files) {
      if (cancelled) break;
      const bytes = new Uint8Array(await file.arrayBuffer());
      let entries: ImportEntry[];
      if (/\.zip$/i.test(file.name)) {
        const result = await parseImageZip(bytes.buffer as ArrayBuffer);
        entries = result.entries;
        setZipErrors(result.errors);
        if (result.pairing.hasFrontsBacks) setPairing(result.pairing);
      } else {
        entries = [
          {
            key: `upload:${file.name}:${crypto.randomUUID()}`,
            filename: file.name,
            source: 'upload',
            bytes
          }
        ];
      }

      for (let i = 0; i < entries.length; i += 20) {
        if (cancelled) break;
        const chunk = entries.slice(i, i + 20);
        const items = await stageEntries(chunk, existingHashes);
        for (const item of items) {
          if (item.status === 'valid' && item.mime) {
            const blob = new Blob([new Uint8Array(item.bytes)], { type: item.mime });
            const meta = await probeImage(blob);
            if (!meta) {
              item.status = 'invalid';
              item.error = 'Could not decode this image. It may be corrupted or not a real image.';
            } else {
              item.widthPx = meta.widthPx;
              item.heightPx = meta.heightPx;
              const thumb = await makeThumbnail(blob);
              if (thumb) item.previewUrl = thumb;
              newSelection.add(item.key);
            }
          }
          existingHashes.add(item.sha256 ?? item.key);
          stagingItems.push(item);
        }
        setStaged([...stagingItems]);
        setSelected(new Set(newSelection));
        setProgress({ processed: Math.min(i + 20, entries.length), total: entries.length });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    setBusy(false);
  }

  async function handleCommit() {
    if (!projectId) return;
    const toCommit = staged.filter((item) => selected.has(item.key) && item.status === 'valid');
    if (toCommit.length === 0) return;

    const created = await commitStagedItems(toCommit, projectId, { addAsset: saveImageAsset }, {
      isCancelled: () => cancelled
    });

    for (let i = 0; i < created.length; i++) {
      const item = toCommit[i];
      if (item.previewUrl) {
        await saveThumbnail({
          assetId: created[i].id,
          projectId,
          dataUrl: item.previewUrl,
          widthPx: item.widthPx ?? 0,
          heightPx: item.heightPx ?? 0
        });
      }
    }

    if (destination === 'draft' || destination === 'existing') {
      let deck =
        destination === 'draft'
          ? createDeck(projectId, draftName.trim() || 'Draft deck')
          : decks.find((d) => d.id === existingDeckId) ?? null;
      if (deck) {
        // Map staged entry keys to the assets actually created in this batch
        // (deduplicated items map to the existing asset instead).
        const assetForKey = new Map<string, ImageAsset>();
        for (let i = 0; i < created.length; i++) assetForKey.set(toCommit[i].key, created[i]);
        const assetForPath = (zipPath: string | undefined): ImageAsset | undefined => {
          if (!zipPath) return undefined;
          const byKey = assetForKey.get(`zip:${zipPath}`);
          if (byKey) return byKey;
          return assets.find((a) => a.filename === zipPath.split('/').pop());
        };

        if (pairing?.sharedBack) {
          const sharedAsset = assetForPath(pairing.sharedBack);
          if (sharedAsset) deck = setDefaultBack(deck, sharedAsset.id);
        }

        for (const item of toCommit) {
          const asset = assetForKey.get(item.key);
          if (!asset) continue;
          const isBackImage = Boolean(pairing?.hasFrontsBacks) && /^backs\//i.test(item.zipPath ?? '');
          if (isBackImage) continue; // backs become card backs, not deck entries
          const card = await ensureCardFromAsset(projectId, asset.id, stripExtension(asset.filename));
          const backPath = pairing?.pairs[item.key] ?? pairing?.sharedBack;
          const backAsset = assetForPath(backPath);
          if (backAsset && backAsset.id !== asset.id) {
            await saveCardDefinition({ ...card, backAssetId: backAsset.id });
          }
          deck = addEntryToDeck(deck, card.id, 1);
        }
        await saveDeck(deck);
        setActiveDeckId(deck.id);
      }
    }

    await touchProject(projectId);
    setCommittedMessage(
      `Imported ${created.length} image(s)${destination !== 'library' ? ' and added them to a deck' : ''}.`
    );
    setStaged([]);
    setSelected(new Set());
    await refresh();
  }

  function handleCancel() {
    setCancelled(true);
    setStaged([]);
    setSelected(new Set());
    setZipErrors([]);
    setPairing(null);
    setBusy(false);
  }

  async function handlePreview(asset: ImageAsset) {
    const blob = await getImageBlob(asset.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setPreview({ asset, url });
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  async function createCardsFromSelectedAssets() {
    if (!projectId) return;
    for (const assetId of selectedAssetIds) {
      const asset = assets.find((a) => a.id === assetId);
      if (asset) await ensureCardFromAsset(projectId, assetId, stripExtension(asset.filename));
    }
    setSelectedAssetIds(new Set());
    await refresh();
    setTab('cards');
  }

  async function batchRotateSelected() {
    if (!projectId) return;
    for (const card of cards) {
      if (!selectedCardIds.has(card.id)) continue;
      await saveCardDefinition({ ...card, frontTransform: rotateTransform(card.frontTransform, 90) });
    }
    await touchProject(projectId);
    markSaved();
    await refresh();
  }

  async function saveCard(card: CardDefinition) {
    if (!projectId) return;
    await saveCardDefinition(card);
    await touchProject(projectId);
    markSaved();
    setCards((current) => current.map((c) => (c.id === card.id ? card : c)));
  }

  async function deleteCard(card: CardDefinition) {
    if (!window.confirm(`Delete card definition "${card.name}"? The image stays in the library.`)) return;
    await deleteCardDefinition(card.id);
    for (const deck of decks) {
      const updated = removeEntry(deck, deck.entries.find((e) => e.cardDefinitionId === card.id)?.id ?? '');
      await saveDeck(updated);
    }
    setCards((current) => current.filter((c) => c.id !== card.id));
    setActiveCardId(null);
    markSaved();
    await refresh();
  }

  async function createDeckNamed(name: string) {
    if (!projectId) return;
    const deck = createDeck(projectId, name);
    await saveDeck(deck);
    setActiveDeckId(deck.id);
    markSaved();
    await refresh();
  }

  async function updateDeck(deck: DeckDefinition) {
    await saveDeck({ ...deck, updatedAt: Date.now() });
    markSaved();
    setDecks((current) => current.map((d) => (d.id === deck.id ? { ...deck, updatedAt: Date.now() } : d)));
  }

  async function duplicateDeckAction(deck: DeckDefinition) {
    if (!projectId) return;
    const copy = duplicateDeck(deck, projectId);
    await saveDeck(copy);
    setActiveDeckId(copy.id);
    markSaved();
    await refresh();
  }

  async function deleteDeckAction(deck: DeckDefinition) {
    if (!window.confirm(`Delete deck "${deck.name}"? Card definitions and images are not removed.`)) return;
    await deleteDeck(deck.id);
    setActiveDeckId(null);
    markSaved();
    await refresh();
  }

  async function addSelectedCardsToDeck(deck: DeckDefinition) {
    let updated = deck;
    for (const cardId of selectedCardIds) {
      updated = addEntryToDeck(updated, cardId, 1);
    }
    await saveDeck(updated);
    setSelectedCardIds(new Set());
    markSaved();
    await refresh();
  }

  if (!projectId) {
    return (
      <section className="workshop">
        <h1>Workshop</h1>
        <EmptyState
          title="Choose a project first"
          message="Open a project from the Library to import card images and build decks."
        />
      </section>
    );
  }

  const activeCard = cards.find((c) => c.id === activeCardId) ?? null;

  return (
    <section
      className={`workshop ${dragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <h1>Workshop{project ? ` — ${project.name}` : ''}</h1>
      {saveStatus && <p className="save-status">{saveStatus}</p>}

      <nav className="workshop-tabs" aria-label="Workshop sections">
        <button type="button" className={`tab ${tab === 'import' ? 'active' : ''}`} onClick={() => setTab('import')}>
          Import
        </button>
        <button type="button" className={`tab ${tab === 'cards' ? 'active' : ''}`} onClick={() => setTab('cards')}>
          Cards ({cards.length})
        </button>
        <button type="button" className={`tab ${tab === 'decks' ? 'active' : ''}`} onClick={() => setTab('decks')}>
          Decks ({decks.reduce((sum, d) => sum + deckCardCount(d), 0)} cards)
        </button>
      </nav>

      {tab === 'import' && (
        <>
          <div className="import-actions">
            <Button label="Upload images" onClick={() => imageInputRef.current?.click()} />
            <input
              ref={imageInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label="Choose image files to upload"
              onChange={(e) => {
                void handleFiles(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
            <Button label="Import ZIP" variant="secondary" onClick={() => zipInputRef.current?.click()} />
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              aria-label="Choose a ZIP archive of card images"
              onChange={(e) => {
                void handleFiles(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </div>
          <p className="muted">
            You can also drag images anywhere into this page, or paste an image from the clipboard.
            One image, a hundred, or any mix — repeat as often as you like.
          </p>

          <ImportStaging
            items={staged}
            selected={selected}
            onToggle={(key) =>
              setSelected((current) => {
                const next = new Set(current);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              })
            }
            onSelectAllValid={() =>
              setSelected(new Set(staged.filter((item) => item.status === 'valid').map((item) => item.key)))
            }
            onDeselectAll={() => setSelected(new Set())}
            busy={busy}
            progress={progress}
            zipErrors={zipErrors}
            pairing={pairing}
            onCommit={() => void handleCommit()}
            onCancel={handleCancel}
            destination={destination}
            setDestination={setDestination}
            draftName={draftName}
            setDraftName={setDraftName}
            existingDeckId={existingDeckId}
            setExistingDeckId={setExistingDeckId}
            decks={decks}
            committedMessage={committedMessage}
          />

          <div className="asset-browser-header-extra">
            <Button
              label="Create cards from selected images"
              variant="secondary"
              onClick={() => void createCardsFromSelectedAssets()}
              disabled={selectedAssetIds.size === 0}
            />
          </div>
          <AssetBrowser
            assets={assets}
            thumbnails={thumbnails}
            search={search}
            onSearch={setSearch}
            selected={selectedAssetIds}
            onToggle={(assetId) =>
              setSelectedAssetIds((current) => {
                const next = new Set(current);
                if (next.has(assetId)) next.delete(assetId);
                else next.add(assetId);
                return next;
              })
            }
            onPreview={handlePreview}
            onAddSelectedToDeck={() => setTab('decks')}
            selectedCount={selectedAssetIds.size}
          />
        </>
      )}

      {tab === 'cards' && (
        <>
          <div className="card-grid-actions">
            <Button
              label="Rotate selected 90°"
              variant="secondary"
              onClick={() => void batchRotateSelected()}
              disabled={selectedCardIds.size === 0}
            />
            <span className="muted">{selectedCardIds.size} selected</span>
          </div>
          {cards.length === 0 ? (
            <EmptyState
              title="No card definitions yet"
              message="Import images, then create cards from them. Cards reference images non-destructively."
            />
          ) : (
            <div className="card-grid">
              {cards.map((card) => (
                <div key={card.id} className={`card-grid-item ${card.id === activeCardId ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedCardIds.has(card.id)}
                    onChange={() =>
                      setSelectedCardIds((current) => {
                        const next = new Set(current);
                        if (next.has(card.id)) next.delete(card.id);
                        else next.add(card.id);
                        return next;
                      })
                    }
                    aria-label={`Select ${card.name}`}
                  />
                  {thumbnails.get(card.frontAssetId) ? (
                    <img src={thumbnails.get(card.frontAssetId)} alt="" />
                  ) : (
                    <span className="placeholder">{card.name}</span>
                  )}
                  <div className="card-grid-meta">
                    <strong>{card.name}</strong>
                    <span className="muted">
                      {card.widthMm}×{card.heightMm} mm · {card.frontTransform.rotationDeg}° ·{' '}
                      {card.backAssetId ? 'custom back' : 'no back'}
                    </span>
                  </div>
                  <Button label="Edit" variant="secondary" onClick={() => setActiveCardId(card.id)} />
                </div>
              ))}
            </div>
          )}

          {activeCard && (
            <CardEditor
              card={activeCard}
              assets={assets}
              onSave={(card) => void saveCard(card)}
              onDelete={deleteCard}
            />
          )}
        </>
      )}

      {tab === 'decks' && (
        <DeckBuilder
          decks={decks}
          activeDeckId={activeDeckId}
          setActiveDeckId={setActiveDeckId}
          onCreate={createDeckNamed}
          onRename={(deck, name) => void updateDeck(renameDeck(deck, name))}
          onDuplicate={duplicateDeckAction}
          onDelete={deleteDeckAction}
          onSetDefaultBack={(deck, assetId) => void updateDeck(setDefaultBack(deck, assetId))}
          onQuantity={(deck, entryId, quantity) => void updateDeck(setEntryQuantity(deck, entryId, quantity))}
          onMove={(deck, entryId, delta) => void updateDeck(moveEntry(deck, entryId, delta))}
          onRemove={(deck, entryId) => void updateDeck(removeEntry(deck, entryId))}
          onAddSelectedCards={(deck) => void addSelectedCardsToDeck(deck)}
          cards={cards}
          selectedCardIds={selectedCardIds}
          assets={assets}
          thumbnails={thumbnails}
        />
      )}

      <Dialog title={preview?.asset.filename ?? 'Preview'} open={preview !== null} onClose={closePreview}>
        {preview && <img src={preview.url} alt={preview.asset.filename} className="preview-image" />}
      </Dialog>
    </section>
  );
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[a-z0-9]+$/i, '');
}
