import Link from "next/link";
import { renderTemplate } from "@/lib/email/templates";
import { samplePayload, TEMPLATE_GROUPS, ALL_TEMPLATES } from "@/lib/email/samples";
import type { EmailTemplate } from "@/lib/admin/email";

export const dynamic = "force-dynamic";

/**
 * Email template previewer. These templates live in code, not in Resend — the
 * Resend dashboard only ever shows the send log. This is where you read them.
 */
export default async function EmailTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const selected = (ALL_TEMPLATES.some((x) => x.id === t) ? t : ALL_TEMPLATES[0].id) as EmailTemplate;
  const meta = ALL_TEMPLATES.find((x) => x.id === selected)!;
  const { subject } = await renderTemplate(selected, samplePayload(selected));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fg">Email templates</h1>
        <p className="mt-1 text-sm text-muted">
          All {ALL_TEMPLATES.length} templates render from{" "}
          <code className="rounded bg-ink-2 px-1.5 py-0.5 text-xs">lib/email/templates.ts</code>. Resend
          sends them but doesn&apos;t store them — its dashboard shows only the send log.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav className="space-y-5">
          {TEMPLATE_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.templates.map((tpl) => (
                  <li key={tpl.id}>
                    <Link
                      href={`?t=${tpl.id}`}
                      className={`block rounded-lg px-3 py-2 text-sm transition ${
                        tpl.id === selected
                          ? "bg-accent/15 font-medium text-accent"
                          : "text-muted hover:bg-ink-2 hover:text-fg"
                      }`}
                    >
                      {tpl.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="min-w-0 space-y-3">
          <div className="rounded-lg border border-line bg-ink-2 p-4">
            <p className="text-xs uppercase tracking-widest text-muted">Subject</p>
            <p className="mt-1 font-medium text-fg">{subject}</p>
            <p className="mt-3 text-xs uppercase tracking-widest text-muted">Trigger</p>
            <p className="mt-1 text-sm text-muted">{meta.trigger}</p>
          </div>
          <iframe
            key={selected}
            src={`/admin/email-templates/preview?t=${selected}`}
            title={`${meta.name} preview`}
            className="h-[720px] w-full rounded-lg border border-line bg-white"
          />
        </div>
      </div>
    </div>
  );
}
