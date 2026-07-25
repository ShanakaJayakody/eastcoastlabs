"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { createPortal } from "react-dom";
import { Command } from "cmdk";

/**
 * A single actionable entry in the command palette.
 *
 * - `href` navigates the browser on select.
 * - `onSelect` fires a callback instead (used when there is no `href`).
 * - `keywords` feed cmdk's fuzzy filter alongside `label`.
 */
export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group: string;
  href?: string;
  onSelect?: () => void;
  keywords?: string[];
}

interface CommandGroup {
  group: string;
  items: CommandItem[];
}

/**
 * Group items by their `group` field while preserving first-seen order, so the
 * rendered sections are stable and predictable regardless of input ordering.
 */
function groupItems(items: CommandItem[]): CommandGroup[] {
  const order: string[] = [];
  const byGroup = new Map<string, CommandItem[]>();

  for (const item of items) {
    const existing = byGroup.get(item.group);
    if (existing) {
      existing.push(item);
    } else {
      byGroup.set(item.group, [item]);
      order.push(item.group);
    }
  }

  // `byGroup.get` is always populated for keys in `order`; the fallback keeps
  // the type non-nullable without introducing `any`.
  return order.map((group) => ({ group, items: byGroup.get(group) ?? [] }));
}

/**
 * Keyboard-first admin command palette built on `cmdk`.
 *
 * Toggle with ⌘K / Ctrl+K, dismiss with Esc. Renders a blurred full-screen
 * overlay with a centered dialog. Selecting an item navigates (`href`) or
 * invokes `onSelect`, then closes. SSR-safe: the portal is only created on the
 * client, after mount.
 */
export interface CommandPaletteProps {
  items: CommandItem[];
  /** Optional async data search (orders/products/customers). Debounced client-side;
   *  results are merged ahead of the static nav items so they surface first. */
  onSearch?: (query: string) => Promise<CommandItem[]>;
}

export function CommandPalette({ items, onSearch }: CommandPaletteProps): JSX.Element {
  const [mounted, setMounted] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const [query, setQuery] = useState("");
  const [dynamicItems, setDynamicItems] = useState<CommandItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced async search: fires 250ms after typing stops, cancelled on unmount
  // or the next keystroke. Two chars minimum keeps single-key noise off the wire.
  useEffect(() => {
    if (!onSearch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setDynamicItems([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      onSearch(q)
        .then(setDynamicItems)
        .catch(() => setDynamicItems([]));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, onSearch]);

  const groups = useMemo(
    () => groupItems([...dynamicItems, ...items]),
    [items, dynamicItems],
  );

  // Mark as mounted so the portal is never created during SSR / first paint.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Global shortcut: ⌘K / Ctrl+K toggles, Esc closes. Listener is removed on
  // unmount so it never leaks across route changes.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((previous) => !previous);
        return;
      }
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
        setDynamicItems([]);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // While open: lock body scroll and focus the input. The cleanup restores the
  // exact prior overflow value and cancels the pending focus frame — it runs on
  // close AND on unmount-while-open, so scroll is always restored.
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(focusFrame);
    };
  }, [open]);

  const close = useCallback((): void => {
    setOpen(false);
    setQuery("");
    setDynamicItems([]);
  }, []);

  const handleSelect = useCallback(
    (item: CommandItem): void => {
      if (item.href) {
        window.location.href = item.href;
      } else {
        item.onSelect?.();
      }
      close();
    },
    [close],
  );

  const dialog = (
    <div
      role="presentation"
      onClick={close}
      className="fixed inset-0 z-[100] flex items-start justify-center bg-ink/70 px-4 pt-[12vh] backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[640px] overflow-hidden rounded-xl border border-line-2 bg-surface shadow-2xl"
      >
        <Command
          label="Command palette"
          loop
          className="flex flex-col text-fg"
        >
          <div className="flex items-center gap-2 border-b border-line px-4">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4 shrink-0 text-accent"
            >
              <path
                fill="currentColor"
                d="M9 3a6 6 0 1 0 4.472 10.03l3.249 3.248a.75.75 0 1 0 1.06-1.06l-3.248-3.249A6 6 0 0 0 9 3ZM4.5 9a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Z"
              />
            </svg>
            <Command.Input
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder="Search orders, products, customers…"
              className="w-full bg-transparent py-4 text-sm text-fg placeholder:text-muted focus:outline-none"
            />
          </div>

          <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted">
              No results found.
            </Command.Empty>

            {groups.map(({ group, items: groupEntries }) => (
              <Command.Group
                key={group}
                heading={group}
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted"
              >
                {groupEntries.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} ${item.id}`}
                    keywords={item.keywords}
                    onSelect={() => handleSelect(item)}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-fg-2 aria-selected:bg-surface-2 aria-selected:text-fg data-[selected=true]:bg-surface-2 data-[selected=true]:text-fg"
                  >
                    <span className="truncate">{item.label}</span>
                    {item.hint ? (
                      <span className="shrink-0 text-xs text-muted">{item.hint}</span>
                    ) : null}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>

          <div className="border-t border-line px-4 py-2.5 text-xs text-muted">
            ↑↓ navigate · ↵ open · esc close
          </div>
        </Command>
      </div>
    </div>
  );

  return <>{mounted && open ? createPortal(dialog, document.body) : null}</>;
}
