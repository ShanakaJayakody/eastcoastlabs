import { PGlite } from "@electric-sql/pglite";
import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

const migrationPath = "supabase/migrations/20260913110000_ss31_50mg.sql";

it("corrects the inherited SS-31 10mg SKU and image description to 50mg", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table products (
        slug text primary key,
        sku text,
        images jsonb,
        updated_at timestamptz default now()
      );
      insert into products (slug, sku, images) values
        ('ss-31', 'ECL-SS31-10', '[{"src":"https://example.test/ss-31/primary.png","alt":"SS-31 10mg research peptide vial – East Coast Labs Australia"}]'),
        ('control', 'ECL-CONTROL-10', '[{"src":"https://example.test/control.png","alt":"Control 10mg vial"}]');
    `);

    if (existsSync(migrationPath)) await db.exec(readFileSync(migrationPath, "utf8"));

    if (existsSync(migrationPath)) await db.exec(readFileSync(migrationPath, "utf8"));

    const { rows } = await db.query<{ slug: string; sku: string; src: string; alt: string }>(`
      select slug, sku, images->0->>'src' as src, images->0->>'alt' as alt
      from products
      order by slug
    `);

    expect(rows).toEqual([
      {
        slug: "control",
        sku: "ECL-CONTROL-10",
        src: "https://example.test/control.png",
        alt: "Control 10mg vial",
      },
      {
        slug: "ss-31",
        sku: "ECL-SS31-50",
        src: "https://example.test/ss-31/primary.png",
        alt: "SS-31 50mg research peptide vial – East Coast Labs Australia",
      },
    ]);
  } finally {
    await db.close();
  }
});
