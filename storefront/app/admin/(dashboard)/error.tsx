"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Admin error boundary, with one specific job beyond looking tidy.
 *
 * Next.js content-hashes its client chunks, so a deploy replaces them. A tab
 * left open across a deploy still holds the old filenames; the next in-app
 * navigation asks for a chunk that no longer exists and React unmounts the
 * whole tree into "a client-side exception has occurred". Nothing is actually
 * broken — the page just needs fetching again — but the operator is left on a
 * blank screen with no way forward but a manual hard reload.
 *
 * So: recognise that specific failure and reload once, guarded by a
 * sessionStorage flag so a genuinely broken build cannot put us in a loop.
 * Every other error gets a readable message and a retry button.
 */

const STALE_PATTERNS = [
  "ChunkLoadError",
  "Loading chunk",
  "Loading CSS chunk",
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed",
];

const RELOAD_FLAG = "ecl-admin-reloaded-for-stale-chunk";

function isStaleChunkError(error: Error): boolean {
  const haystack = `${error.name} ${error.message}`;
  return STALE_PATTERNS.some((pattern) => haystack.includes(pattern));
}

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!isStaleChunkError(error)) return;
    // Only once per tab: if the reload does not fix it, the build really is
    // broken and looping would just hide that.
    if (sessionStorage.getItem(RELOAD_FLAG)) return;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    setRecovering(true);
    window.location.reload();
  }, [error]);

  useEffect(() => {
    // A render that succeeded means we are past it; let the next deploy use
    // its own single retry.
    if (!isStaleChunkError(error)) sessionStorage.removeItem(RELOAD_FLAG);
  }, [error]);

  if (recovering) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="flex items-center gap-2 text-sm text-muted">
          <RefreshCw size={15} className="animate-spin" />
          A new version was deployed — reloading…
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warn/10 text-warn">
        <AlertTriangle size={22} />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-fg">This screen hit an error</h2>
        <p className="mt-1 text-sm text-muted">
          Nothing you did caused it and nothing was saved. Try again — if it keeps happening, the
          detail below is what to report.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-95"
        >
          <RefreshCw size={15} /> Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-line-2 px-4 py-2 text-sm text-fg-2 transition hover:text-fg"
        >
          Reload the page
        </button>
      </div>

      <p className="max-w-full break-words rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[11px] text-muted-2">
        {error.message || error.name}
        {error.digest && <span className="block">digest {error.digest}</span>}
      </p>
    </div>
  );
}
