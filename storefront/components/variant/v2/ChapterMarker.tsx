import Reveal from "@/components/Reveal";

/** The "01 / THE CLAIM" mono chapter marker with a hairline that draws in on view. */
export default function ChapterMarker({ n, title }: { n: string; title: string }) {
  return (
    <Reveal className="dossier-rule pt-6">
      <p className="font-data text-[11px] uppercase tracking-[0.15em] text-muted-2">
        {n} / {title}
      </p>
    </Reveal>
  );
}
