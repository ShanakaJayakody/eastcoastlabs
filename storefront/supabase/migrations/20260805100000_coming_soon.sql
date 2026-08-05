-- East Coast Labs — "coming soon" catalog entries.
--
-- These are compounds identified as catalog gaps against 12 AU competitors (see
-- SOURCING_LIST.md). Listing them BEFORE sourcing does two jobs at once:
--
--   1. It stops the catalog looking thin next to competitors carrying 25-150 SKUs.
--   2. It turns the existing stock_notifications waitlist into a demand meter.
--      Which coming-soon products people sign up for is first-party evidence of
--      what to source first — better than any competitor audit, because it is
--      ECL's own customers voting.
--
-- A coming_soon product deliberately has NO variants and NO inventory. That is
-- the safety property: with no variant row, resolveCart() cannot price it and
-- reserve_stock() has nothing to reserve, so it is unbuyable at the data layer
-- and not merely hidden in the UI.
--
-- Copy is research-framed only — compound class and research context, never use.

-- ---------------------------------------------------------------------------
-- 1. Allow the new status
-- ---------------------------------------------------------------------------
alter table public.products drop constraint if exists products_status_check;
alter table public.products
  add constraint products_status_check
  check (status in ('active','draft','archived','coming_soon'));

-- Ranking lets the owner order the coming-soon shelf by sourcing priority
-- rather than alphabetically. Lower sorts first.
alter table public.products
  add column if not exists coming_soon_rank int;

create index if not exists products_coming_soon_idx
  on public.products (status, coming_soon_rank)
  where status = 'coming_soon';

-- ---------------------------------------------------------------------------
-- 2. Seed the gap list
-- ---------------------------------------------------------------------------
-- `sku` carries the intended vial format so whoever sources it buys the right
-- thing; formats follow the AU market convention (10mg default, NAD+ 500mg).
insert into public.products (slug, name, sku, compound, status, coming_soon_rank, short_description, categories)
values
  -- Tier 1 — highest return per unit of sourcing effort
  ('bpc-157-tb-500', 'BPC-157 + TB-500', 'ECL-BPCTB-10', 'BPC-157 + TB-500', 'coming_soon', 10,
   'A two-peptide blend combining BPC-157 and TB-500 in a single vial. The most widely stocked repair blend in the Australian research market.',
   '["recovery-repair"]'::jsonb),

  ('nad-plus', 'NAD+', 'ECL-NAD-500', 'NAD+', 'coming_soon', 20,
   'Nicotinamide adenine dinucleotide, a coenzyme central to cellular energy metabolism and a common reference compound in mitochondrial research.',
   '["longevity-cellular"]'::jsonb),

  ('ipamorelin', 'Ipamorelin', 'ECL-IPA-10', 'Ipamorelin', 'coming_soon', 30,
   'A pentapeptide growth hormone secretagogue, studied for its receptor selectivity relative to earlier secretagogue compounds.',
   '["growth-performance"]'::jsonb),

  ('cjc-1295-no-dac', 'CJC-1295 (no DAC)', 'ECL-CJC-10', 'CJC-1295 no-DAC', 'coming_soon', 40,
   'A growth hormone releasing hormone analogue, also referenced in the literature as Modified GRF (1-29).',
   '["growth-performance"]'::jsonb),

  ('cjc-1295-ipamorelin', 'CJC-1295 + Ipamorelin', 'ECL-CJCIPA-10', 'CJC-1295 + Ipamorelin', 'coming_soon', 50,
   'A two-peptide blend pairing a GHRH analogue with a growth hormone secretagogue. The most commonly stocked growth-research blend in the Australian market.',
   '["growth-performance"]'::jsonb),

  ('kpv', 'KPV', 'ECL-KPV-10', 'KPV', 'coming_soon', 60,
   'A tripeptide fragment of alpha-MSH, studied in inflammation and epithelial research models. Already a component of the KLOW blend.',
   '["recovery-repair"]'::jsonb),

  -- Tier 2
  ('epitalon', 'Epitalon', 'ECL-EPI-10', 'Epitalon', 'coming_soon', 70,
   'A synthetic tetrapeptide (Ala-Glu-Asp-Gly) originating from Khavinson bioregulator research, studied in telomere and cellular ageing models.',
   '["longevity-cellular"]'::jsonb),

  ('pt-141', 'PT-141', 'ECL-PT141-10', 'PT-141 (Bremelanotide)', 'coming_soon', 80,
   'A melanocortin receptor agonist derived from the same peptide family as Melanotan II.',
   '["research-other"]'::jsonb),

  ('5-amino-1mq', '5-Amino-1MQ', 'ECL-5A1MQ-50', '5-Amino-1MQ', 'coming_soon', 90,
   'A small-molecule NNMT inhibitor studied in metabolic and adipocyte research models.',
   '["metabolic-weight"]'::jsonb),

  ('dsip', 'DSIP', 'ECL-DSIP-10', 'DSIP', 'coming_soon', 100,
   'Delta sleep-inducing peptide, a nonapeptide first isolated in the 1970s and referenced in sleep-architecture research.',
   '["research-other"]'::jsonb),

  ('cagrilintide', 'Cagrilintide', 'ECL-CAGRI-10', 'Cagrilintide', 'coming_soon', 110,
   'A long-acting amylin analogue studied alongside GLP-1 class compounds in metabolic research.',
   '["metabolic-weight"]'::jsonb),

  ('ss-31', 'SS-31', 'ECL-SS31-10', 'SS-31 (Elamipretide)', 'coming_soon', 120,
   'A mitochondria-targeting tetrapeptide studied for cardiolipin association in mitochondrial research.',
   '["longevity-cellular"]'::jsonb),

  ('glutathione', 'Glutathione', 'ECL-GSH-1500', 'Glutathione', 'coming_soon', 130,
   'A tripeptide antioxidant (Glu-Cys-Gly) widely used as a reference compound in oxidative-stress research.',
   '["longevity-cellular"]'::jsonb),

  ('aod-9604', 'AOD-9604', 'ECL-AOD-5', 'AOD-9604', 'coming_soon', 140,
   'A modified fragment of human growth hormone corresponding to residues 176-191.',
   '["metabolic-weight"]'::jsonb),

  ('melanotan-1', 'Melanotan I', 'ECL-MT1-10', 'Melanotan I (Afamelanotide)', 'coming_soon', 150,
   'A linear alpha-MSH analogue, structurally distinct from the cyclic Melanotan II already in the catalog.',
   '["skin-aesthetics"]'::jsonb),

  -- Tier 3 — niche / differentiating
  ('adamax', 'Adamax', 'ECL-ADA-10', 'Adamax', 'coming_soon', 160,
   'A newer nootropic-class peptide, an analogue within the same research family as Semax and Selank.',
   '["cognitive-focus"]'::jsonb),

  ('thymosin-alpha-1', 'Thymosin Alpha-1', 'ECL-TA1-10', 'Thymosin Alpha-1', 'coming_soon', 170,
   'A 28-amino-acid peptide derived from prothymosin alpha, studied extensively in immunological research.',
   '["recovery-repair"]'::jsonb),

  ('ara-290', 'ARA-290', 'ECL-ARA-10', 'ARA-290 (Cibinetide)', 'coming_soon', 180,
   'An 11-amino-acid peptide derived from the erythropoietin helix-B domain, studied in neuropathy research models.',
   '["recovery-repair"]'::jsonb),

  ('ll-37', 'LL-37', 'ECL-LL37-5', 'LL-37', 'coming_soon', 190,
   'A human cathelicidin-derived antimicrobial peptide studied in innate immunity research.',
   '["recovery-repair"]'::jsonb),

  ('snap-8', 'SNAP-8', 'ECL-SNAP8-10', 'SNAP-8', 'coming_soon', 200,
   'An octapeptide extension of Argireline, studied in topical cosmetic-science research.',
   '["skin-aesthetics"]'::jsonb),

  ('ahk-cu', 'AHK-Cu', 'ECL-AHKCU-100', 'AHK-Cu', 'coming_soon', 210,
   'A copper-binding tripeptide complex studied alongside GHK-Cu in dermal and follicular research.',
   '["skin-aesthetics"]'::jsonb),

  ('sermorelin', 'Sermorelin', 'ECL-SERM-5', 'Sermorelin', 'coming_soon', 220,
   'A 29-amino-acid GHRH analogue corresponding to the biologically active fragment of growth hormone releasing hormone.',
   '["growth-performance"]'::jsonb),

  ('tesamorelin-ipamorelin', 'Tesamorelin + Ipamorelin', 'ECL-TESIPA-10', 'Tesamorelin + Ipamorelin', 'coming_soon', 230,
   'A two-peptide blend pairing Tesamorelin, already in the ECL catalog, with a growth hormone secretagogue.',
   '["growth-performance"]'::jsonb)

on conflict (slug) do update
  set status           = excluded.status,
      coming_soon_rank = excluded.coming_soon_rank,
      compound         = excluded.compound,
      short_description= excluded.short_description,
      categories       = excluded.categories;
