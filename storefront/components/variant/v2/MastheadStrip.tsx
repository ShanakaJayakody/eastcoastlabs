/**
 * 00 / masthead strip — replaces the announcement bar. Emoji prefixes on the
 * shared settings copy are stripped so the dossier surface stays icon-free;
 * a single mono line, hairline-separated items.
 */
const stripEmoji = (s: string) =>
  s.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}️]+\s*/u, "").trim();

export default function MastheadStrip({ items }: { items: string[] }) {
  return (
    <div className="border-b border-line bg-ink-2">
      <div className="mx-auto flex max-w-[1200px] items-center justify-center gap-x-6 px-6 py-1.5 text-center font-data text-[11px] tracking-wide text-fg-2">
        {items.map((item, i) => (
          <span key={item} className={i === 0 ? "" : i === 1 ? "hidden sm:inline" : "hidden lg:inline"}>
            {i > 0 && <span className="mr-6 text-muted-2">/</span>}
            {stripEmoji(item)}
          </span>
        ))}
      </div>
    </div>
  );
}
