import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import "../../app/(store)/editorial.css";
import ReconstitutionCalculator from "../../components/ReconstitutionCalculator";

createRoot(document.getElementById("root")!).render(
  <div className="ecl-store min-h-screen">
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <p className="mb-6 text-xs uppercase tracking-widest text-muted">East Coast Labs · Local preview</p>
      <h1 className="sr-only">Research calculator preview</h1>
      <ReconstitutionCalculator />
    </main>
  </div>,
);
