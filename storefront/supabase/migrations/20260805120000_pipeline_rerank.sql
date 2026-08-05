-- Re-rank the coming-soon pipeline against measured demand data.
--
-- The original ranking (20260805100000) came from a competitor-catalog audit:
-- how many of 12 AU vendors stock each compound. That is good evidence of table
-- stakes but says nothing about which compounds people actually want.
--
-- A second research pass added three measurable signals: Wikipedia pageview
-- counts (global, hard counts via the Wikimedia REST API), AU-localised Google
-- autocomplete breadth, and AU vendor BESTSELLER orderings — the last being
-- revealed purchase preference, the strongest of the three.
--
-- Three findings drove the changes below:
--
--   1. Blends consistently outrank their own components sold separately across
--      every AU vendor surveyed. BPC-157+TB-500 and CJC-1295+Ipamorelin both
--      rank above either half alone, so both move up.
--   2. Sermorelin is absent from every AU vendor despite decent global interest —
--      a US signal with no Australian pull-through. Demoted.
--   3. SNAP-8 sits at #5 in one vendor's bestsellers despite near-zero
--      informational search. Cosmetic buyers don't read Wikipedia; the vendor
--      signal is the true one. Promoted within Tier 3.
--
-- Survodutide and Mazdutide were deliberately never listed and remain unlisted:
-- Survodutide returns ZERO Australian autocomplete on both probes and no AU
-- vendor stocks either. The brief assumed newer GLP-1s would be the gap; the
-- Australian data says otherwise.

update public.products set coming_soon_rank = case slug
  -- Tier 1 — highest-confidence gaps, all backed by revealed purchase preference
  when 'bpc-157-tb-500'        then 10   -- #1 bestseller PepC.Labs; outranks standalone TB-500 everywhere
  when 'cjc-1295-ipamorelin'   then 20   -- #2 Top Sellers Aussie Peptide; outranks both components alone
  when 'cjc-1295-no-dac'       then 30   -- max AU autocomplete breadth (15/15); no-DAC outsells DAC
  when 'nad-plus'              then 40   -- stocked by ~every AU vendor (global interest is softening)
  when 'pt-141'                then 50   -- sold out at 3 AU vendors — supply-constrained demand
  when 'ipamorelin'            then 60   -- unlocks the GH cluster
  when 'tesamorelin-ipamorelin' then 70  -- free SKU the moment Ipamorelin lands; Tesamorelin already stocked

  -- Tier 2
  when 'epitalon'              then 80   -- +42% YoY; in VCP's Longevity Starter bundle
  when 'kpv'                   then 90   -- out of stock at 2 AU vendors; already a KLOW input
  when 'ss-31'                 then 100  -- +66% YoY
  when 'cagrilintide'          then 110  -- AU autocomplete now pairs it with retatrutide — a blend signal
  when '5-amino-1mq'           then 120
  when 'glutathione'           then 130  -- OOS at 2 AU vendors, but demand is mainstream retail not research
  when 'aod-9604'              then 140
  when 'dsip'                  then 150
  when 'melanotan-1'           then 160  -- in VCP's Summer Glow bundle
  when 'sermorelin'            then 170  -- DEMOTED: absent from every AU vendor despite US interest

  -- Tier 3 — niche, first-mover, or vendor-signal-only
  when 'adamax'                then 180  -- newest compound in the set; only ONE AU vendor carries it
  when 'snap-8'                then 190  -- PROMOTED: #5 in PepC.Labs bestsellers despite near-zero search
  when 'thymosin-alpha-1'      then 200
  when 'ara-290'               then 210  -- +110% YoY off a tiny base
  when 'ahk-cu'                then 220
  when 'll-37'                 then 230  -- strong US intent, no AU pull-through
  else coming_soon_rank
end
where status = 'coming_soon';
