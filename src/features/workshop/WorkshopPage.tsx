import { useEffect, useState } from 'react';
import { Dialog, EmptyState } from '../../components/ui';
import {
  ensureCardFromAsset,
  getProject,
  getImageBlob,
  listDecks,
  listImageAssets,
  listThumbnails,
  saveDeck,
  saveImageAsset,
  saveThumbnail,
  touchProject
} from '../../persistence/repositories';
import { addEntryToDeck, createDeck } from '../../domain/deck-operations';
import { DeckDefinition, ImageAsset, Project } from '../../domain/models';
import { ImportDestination, ImportStaging } from '../import/ImportStaging';
import { AssetBrowser } from '../import/AssetBrowser';
import { commitStagedItems, stageEntries, ImportEntry, StagedItem } from '../import/pipeline';
import { parseImageZip, PairingInfo } from '../import/zipImport';
import { makeThumbnail, probeImage } from '../import/imageMeta';

/**
 * Workshop M1: Upload Images and Import ZIP are equal first-class entry
 * points. Drag/drop works anywhere in the Workshop and clipboard paste where
 * supported. Both paths feed the same staging/validation pipeline.
 */
export function WorkshopPage({ projectId }: { projectId?: string }) {
  const [project, setProject] = useState<Project | null>(null);
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
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [decks, setDecks] = useState<DeckDefinition[]>([]);
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<{ asset: ImageAsset; url: string } | null>(null);
  const [addDeckOpen, setAddDeckOpen] = useState(false);
  const [addDeckName, setAddDeckName] = useState('New deck');
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());

  async function refresh() {
    if (!projectId) return;
    const [project, assets, decks, thumbnails] = await Promise.all([
      getProject(projectId),
      listImageAssets(projectId),
      listDecks(projectId),
      listThumbnails(projectId)
    ]);
    setProject(project ?? null);
    setAssets(assets);
    setDecks(decks);
    setThumbnails(new Map(thumbnails.map((t) => [t.assetId, t.dataUrl])));
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

      // Stage in small batches so a 100-file import never freezes the UI.
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
        for (const asset of created) {
          const card = await ensureCardFromAsset(projectId, asset.id, stripExtension(asset.filename));
          deck = addEntryToDeck(deck, card.id, 1);
        }
        await saveDeck(deck);
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

  async function addSelectedToDeck() {
    if (!projectId) return;
    const chosen = assets.filter((asset) => selectedAssetIds.has(asset.id));
    if (chosen.length === 0) return;
    let deck =
      decks.find((d) => d.id === existingDeckId) ?? createDeck(projectId, addDeckName.trim() || 'New deck');
    for (const asset of chosen) {
      const card = await ensureCardFromAsset(projectId, asset.id, stripExtension(asset.filename));
      deck = addEntryToDeck(deck, card.id, 1);
    }
    await saveDeck(deck);
    await touchProject(projectId);
    setAddDeckOpen(false);
    setSelectedAssetIds(new Set());
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

      <div className="import-actions">
        <label className="btn btn-primary import-action">
          Upload Images
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => void handleFiles(Array.from(e.target.files ?? []))}
          />
        </label>
        <label className="btn btn-primary import-action">
          Import ZIP
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => void handleFiles(Array.from(e.target.files ?? []))}
          />
        </label>
        <a
          className="btn btn-secondary import-action"
          href="https://extractor.gonzhome.us"
          target="_blank"
          rel="noopener noreferrer"
        >
          Use Card Extractor
        </a>
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
          setSelected(
            new Set(staged.filter((item) => item.status === 'valid').map((item) => item.key))
          )
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
        onAddSelectedToDeck={() => setAddDeckOpen(true)}
        selectedCount={selectedAssetIds.size}
      />

      <Dialog title="Add selected images to a deck" open={addDeckOpen} onClose={() => setAddDeckOpen(false)}>
        <label>
          New deck name
          <input type="text" value={addDeckName} onChange={(e) => setAddDeckName(e.target.value)} />
        </label>
        <p className="muted">Or use the deck selected in the staging panel above.</p>
        <button type="button" className="btn btn-primary" onClick={() => void addSelectedToDeck()}>
          Add to deck
        </button>
      </Dialog>

      <Dialog title={preview?.asset.filename ?? 'Preview'} open={preview !== null} onClose={closePreview}>
        {preview && (
          <img src={preview.url} alt={preview.asset.filename} className="preview-image" />
        )}
      </Dialog>
    </section>
  );
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[a-z0-9]+$/i, '');
}
