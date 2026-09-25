import type { Metadata } from "next";
import RebrandPage from "@/components/rebrand/RebrandPage";
export const revalidate = 300;
export const metadata: Metadata = { title: "Clear Science" };
export default function Page() {
  return <RebrandPage variant="v2" />;
}
