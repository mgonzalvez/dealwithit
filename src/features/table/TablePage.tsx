import { EmptyState } from '../../components/ui';

/**
 * M0 scaffold. The interactive tabletop (pan/zoom, stacks, draw, flip)
 * is implemented in M3.
 */
export function TablePage({ projectId }: { projectId?: string }) {
  return (
    <section className="table-page">
      <h1>Table</h1>
      {projectId ? (
        <EmptyState
          title="Table coming in M3"
          message="The interactive tabletop (shuffle, draw, flip, drag, stack) will live here."
        />
      ) : (
        <EmptyState
          title="Choose a project first"
          message="Open a project from the Library to play on the table."
        />
      )}
    </section>
  );
}
