import type { Metadata } from "next";
import { directions } from "@/components/rebrand/content";
import RebrandPage from "@/components/rebrand/RebrandPage";
export const revalidate = 300;
export const metadata: Metadata = { title: directions.v3.name };
export default function Page() {
  return <RebrandPage variant="v3" />;
}
