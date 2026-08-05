-- Final pipeline ranking — synthesis of three independent research passes.
--
-- Pass 1 (competitor audit): how many of 12 AU vendors stock each compound.
-- Pass 2 (search/trend): Wikipedia pageview counts, AU autocomplete, vendor
--   BESTSELLER orderings — revealed purchase preference.
-- Pass 3 (community): a 962-comment census of the six r/Peptides threads where
--   the community explicitly ranks compounds, plus stack co-occurrence.
--
-- Pass 3 overturned the premise the other two were built on. It went looking for
-- compounds "discussed a lot but rarely stocked" — the white space a catalog
-- audit structurally cannot find — and found none. Every candidate tested,
-- including deliberately obscure ones, is already carried by 8-10+ AU vendors.
-- PE-22-28 has ZERO mentions across 962 comments and is still stocked by eight
-- Australian vendors.
--
-- So these are PARITY gaps, not white space. The value of adding them is
-- basket completion — ECL currently loses the entire order when someone wants
-- MOTS-C *and* SS-31 — not capturing an uncontested niche. Ranking is therefore
-- weighted toward adjacency with SKUs ECL ALREADY SELLS.
--
-- The single biggest change: SS-31 moves from 10th to 1st. It is rank 2 by
-- community volume (35 mentions, more than TB-500 which ECL stocks), and 49% of
-- those comments also mention MOTS-C — which ECL sells. Three separate threads
-- ask what pairs with MOTS-C, and the answer is a compound ECL doesn't carry.
--
-- Confirmed by two independent passes and deliberately NOT listed: Survodutide
-- and Mazdutide. Zero community mentions in 962 comments, zero AU autocomplete,
-- no AU vendor stocks either.

-- Oxytocin was missed in the first pass. Community census ranks it 11th
-- (14 mentions) — above Epitalon and Cagrilintide, both already listed.
insert into public.products (slug, name, sku, compound, status, coming_soon_rank, short_description, categories)
values
  ('oxytocin', 'Oxytocin', 'ECL-OXY-10', 'Oxytocin', 'coming_soon', 160,
   'A nonapeptide hormone and one of the most extensively studied compounds in neuroendocrine research.',
   '["research-other"]'::jsonb)
on conflict (slug) do update
  set status = excluded.status, coming_soon_rank = excluded.coming_soon_rank;

update public.products set coming_soon_rank = case slug
  -- Tier 1 — basket completion against SKUs ECL already sells
  when 'ss-31'                  then 10   -- rank 2 community; 49% co-occurrence with MOTS-C (ECL sells it)
  when 'bpc-157-tb-500'         then 20   -- #1 vendor bestseller; both inputs already in the warehouse
  when 'ipamorelin'             then 30   -- rank 1 by community volume (40/962)
  when 'cjc-1295-no-dac'        then 40   -- rank 3 community; max AU autocomplete breadth
  when 'cjc-1295-ipamorelin'    then 50   -- #2 vendor Top Sellers; outranks either component alone
  when 'kpv'                    then 60   -- rank 4 community; ALREADY sourced as a KLOW input
  when 'tesamorelin-ipamorelin' then 70   -- Tesamorelin adjacency; free SKU once Ipamorelin lands

  -- Tier 2
  when 'dsip'                   then 80   -- rank 5 community (23 mentions) — was badly underranked
  when 'nad-plus'               then 90   -- rank 6 community; stocked by ~every AU vendor
  when 'pt-141'                 then 100  -- sold out at 3 AU vendors — supply-constrained
  when 'glutathione'            then 110  -- rank 9 community
  when 'aod-9604'               then 120  -- rank 10 community
  when 'epitalon'               then 130  -- rank 12 community; +42% YoY
  when 'cagrilintide'           then 140  -- rank 13; pairs with Retatrutide (ECL's #1 seller)
  when 'melanotan-1'            then 150  -- MT2 adjacency; the one candidate whose AU stocking is UNVERIFIED
  when 'oxytocin'               then 160  -- rank 11 community

  -- Tier 3 — adjacency-driven line extensions, low volume but cheap
  when 'ahk-cu'                 then 170  -- 0 mentions alone, but GHK-Cu in 4 of 7 titles (ECL sells GHK-Cu)
  when 'adamax'                 then 180  -- discussed almost only as a Semax comparator (ECL sells Semax)
  when 'snap-8'                 then 190  -- co-occurs with GHK-Cu / KLOW / GLOW — all ECL SKUs
  when 'thymosin-alpha-1'       then 200
  when 'ara-290'                then 210  -- +110% YoY off a tiny base
  when 'sermorelin'             then 220  -- absent from every AU vendor despite US interest
  when 'll-37'                  then 230  -- strong US intent, no AU pull-through
  when '5-amino-1mq'            then 240  -- DEMOTED: zero mentions across 962 community comments
  else coming_soon_rank
end
where status = 'coming_soon';
