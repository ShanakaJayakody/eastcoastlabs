import type { Metadata } from "next";
import RebrandPage from "@/components/rebrand/RebrandPage";
export const revalidate = 300;
export const metadata: Metadata = { title: "A New Perspective" };
export default function Page() {
  return <RebrandPage variant="v3" />;
}
