import { ImageAsset } from '../../domain/models';
import { Button } from '../../components/ui';
import { naturalCompare } from '../../domain/natural-sort';

export interface AssetBrowserProps {
  assets: ImageAsset[];
  thumbnails: Map<string, string>;
  search: string;
  onSearch: (value: string) => void;
  selected: Set<string>;
  onToggle: (assetId: string) => void;
  onPreview: (asset: ImageAsset) => void;
  onAddSelectedToDeck: () => void;
  onSelectAll: (assetIds: string[]) => void;
  onDeselectAll: () => void;
  selectedCount: number;
}

export function AssetBrowser(props: AssetBrowserProps) {
  const query = props.search.trim().toLowerCase();
  const filtered = props.assets
    .filter((asset) => !query || asset.filename.toLowerCase().includes(query))
    .sort((a, b) => naturalCompare(a.filename, b.filename));

  return (
    <section className="asset-browser">
      <div className="asset-browser-header">
        <h2>Asset library</h2>
        <input
          type="search"
          value={props.search}
          onChange={(e) => props.onSearch(e.target.value)}
          placeholder="Search by filename…"
          aria-label="Search assets"
        />
        <Button label="Add selected to deck" variant="secondary" onClick={props.onAddSelectedToDeck} disabled={props.selectedCount === 0} />
        <Button label="Select all" variant="secondary" onClick={() => props.onSelectAll(filtered.map((asset) => asset.id))} disabled={filtered.length === 0} />
        <Button label="Deselect all" variant="secondary" onClick={props.onDeselectAll} disabled={props.selectedCount === 0} />
      </div>
      {filtered.length === 0 ? (
        <p className="muted">No images in this project yet. Use Upload Images or Import ZIP above.</p>
      ) : (
        <div className="asset-grid">
          {filtered.map((asset) => (
            <div key={asset.id} className={`asset-card ${props.selected.has(asset.id) ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={props.selected.has(asset.id)}
                onChange={() => props.onToggle(asset.id)}
                aria-label={`Select ${asset.filename}`}
              />
              <button
                type="button"
                className="asset-thumb-button"
                onClick={() => props.onPreview(asset)}
                aria-label={`Preview ${asset.filename}`}
              >
                {props.thumbnails.get(asset.id) ? (
                  <img src={props.thumbnails.get(asset.id)} alt="" />
                ) : (
                  <span className="placeholder">{asset.filename}</span>
                )}
              </button>
              <span className="asset-name">{asset.filename}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
