import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { renderTemplate } from "@/lib/email/templates";
import { samplePayload, ALL_TEMPLATES } from "@/lib/email/samples";
import type { EmailTemplate } from "@/lib/admin/email";

export const dynamic = "force-dynamic";

/**
 * Renders a single email template as raw HTML for the previewer's iframe.
 * Route handlers don't run the admin layout, so the session check is explicit.
 */
export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("t") ?? "";
  if (!ALL_TEMPLATES.some((t) => t.id === id)) {
    return new NextResponse("Unknown template", { status: 404 });
  }

  const template = id as EmailTemplate;
  const { html } = await renderTemplate(template, samplePayload(template));
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
