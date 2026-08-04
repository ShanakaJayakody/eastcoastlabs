import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import NewProductForm from "@/components/admin/NewProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireAdmin();
  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-fg"
        >
          <ChevronLeft size={15} /> Products
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-fg">Add product</h1>
        <p className="mt-1 text-sm text-muted">
          Creates the 1-vial, 3-pack and 6-pack tiers with inventory in one step.
        </p>
      </div>
      <NewProductForm />
    </div>
  );
}
