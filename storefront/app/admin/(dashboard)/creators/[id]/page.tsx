import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CreatorApplicationDetail from "@/components/admin/CreatorApplicationDetail";
import { getCreatorApplication } from "@/lib/admin/creators";
import { reviewCreatorApplication } from "../actions";

export const metadata: Metadata = { title: "Creator application — ECL Admin" };
export const dynamic = "force-dynamic";

export default async function CreatorApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const application = await getCreatorApplication(id);
  if (!application) notFound();
  return <CreatorApplicationDetail application={application} review={reviewCreatorApplication} />;
}
