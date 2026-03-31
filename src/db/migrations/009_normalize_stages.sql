-- Migration: Normalize deal_metadata->>'stage' to canonical forms
-- This fixes historical inconsistency where stages were stored as raw HubSpot values
-- (numeric IDs, short labels, or inconsistently prefixed names).

BEGIN;

-- ============================================================
-- Agency New Sales (pipeline 9297003)
-- ============================================================

-- S1 - Needs Discovered
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S1 - Needs Discovered (Agency New Sales)"')
WHERE pipeline = '9297003'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Agency New Sales)'
  AND deal_metadata->>'stage' IN ('26497054', 'Needs discovered', 'Needs Discovered', 'S1 - Needs Discovered', 'S1 - Needs discovered');

-- S2 - Buy-in from wider team
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S2 - Buy-in from wider team (Agency New Sales)"')
WHERE pipeline = '9297003'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Agency New Sales)'
  AND deal_metadata->>'stage' IN ('26497055', 'Buy-in from wider team', 'S2 - Buy-in from wider team');

-- S3 - Trial
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S3 - Trial (Agency New Sales)"')
WHERE pipeline = '9297003'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Agency New Sales)'
  AND deal_metadata->>'stage' IN ('26497056', 'Trial', 'S3 - Trial');

-- S4 - Decision Maker Buy-in
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S4 - Decision Maker Buy-in (Agency New Sales)"')
WHERE pipeline = '9297003'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Agency New Sales)'
  AND deal_metadata->>'stage' IN ('26497057', 'Decision Maker Buy-in', 'S4 - Decision Maker Buy-in');

-- S5 - Commercials
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S5 - Commercials (Agency New Sales)"')
WHERE pipeline = '9297003'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Agency New Sales)'
  AND deal_metadata->>'stage' IN ('49153958', 'Commercials', 'S5 - Commercials');

-- S6 - Legal & IT & Security
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S6 - Legal & IT & Security (Agency New Sales)"')
WHERE pipeline = '9297003'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Agency New Sales)'
  AND deal_metadata->>'stage' IN ('26497058', 'Legal', 'Security', 'S6 - Legal & IT & Security');

-- S7 - Draft Contract
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S7- Draft Contract (Agency New Sales)"')
WHERE pipeline = '9297003'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Agency New Sales)'
  AND deal_metadata->>'stage' IN ('199756209', 'Draft Contract', 'S7- Draft Contract');

-- S8 - Pending Payment
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S8 - Pending Payment (Agency New Sales)"')
WHERE pipeline = '9297003'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Agency New Sales)'
  AND deal_metadata->>'stage' IN ('48484985', 'Pending Payment', 'S8 - Pending Payment');

-- Closed won / lost
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"Closed won (Agency New Sales)"')
WHERE pipeline = '9297003'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Agency New Sales)'
  AND deal_metadata->>'stage' IN ('26497059', 'Closed won');

UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"Closed lost (Agency New Sales)"')
WHERE pipeline = '9297003'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Agency New Sales)'
  AND deal_metadata->>'stage' IN ('26497060', 'Closed lost');

-- ============================================================
-- Enterprise New Sales (pipeline 9308023)
-- ============================================================

-- S1 - Needs discovered
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S1 - Needs discovered (Enterprise New Sales)"')
WHERE pipeline = '9308023'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Enterprise New Sales)'
  AND deal_metadata->>'stage' IN ('26589195', 'Needs discovered', 'Needs Discovered', 'S1 - Needs discovered', 'S1 - Needs Discovered');

-- S2 - Buy-in from wider team
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S2 - Buy-in from wider team (Enterprise New Sales)"')
WHERE pipeline = '9308023'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Enterprise New Sales)'
  AND deal_metadata->>'stage' IN ('26589196', 'Buy-in from wider team', 'S2 - Buy-in from wider team');

-- S3 - Trial
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S3 - Trial (Enterprise New Sales)"')
WHERE pipeline = '9308023'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Enterprise New Sales)'
  AND deal_metadata->>'stage' IN ('26589197', 'Trial', 'S3 - Trial');

-- S4 - Commercial Negotiations
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S4 - Commercial Negotiations (Enterprise New Sales)"')
WHERE pipeline = '9308023'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Enterprise New Sales)'
  AND deal_metadata->>'stage' IN ('26589198', 'Commercial Negotiations', 'S4 - Commercial Negotiations');

-- S5 - Decision Maker Buy-in
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S5 - Decision Maker Buy-in (Enterprise New Sales)"')
WHERE pipeline = '9308023'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Enterprise New Sales)'
  AND deal_metadata->>'stage' IN ('26589199', 'Decision Maker Buy-in', 'S5 - Decision Maker Buy-in');

-- S6 - Security
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S6 - Security (Enterprise New Sales)"')
WHERE pipeline = '9308023'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Enterprise New Sales)'
  AND deal_metadata->>'stage' IN ('26588039', 'S6 - Security');

-- S7 - Legal
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S7 - Legal (Enterprise New Sales)"')
WHERE pipeline = '9308023'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Enterprise New Sales)'
  AND deal_metadata->>'stage' IN ('26588040', 'Legal', 'S7 - Legal');

-- Closed won / lost
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"Closed won (Enterprise New Sales)"')
WHERE pipeline = '9308023'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Enterprise New Sales)'
  AND deal_metadata->>'stage' IN ('26589200', 'Closed won');

UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"Closed lost (Enterprise New Sales)"')
WHERE pipeline = '9308023'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Enterprise New Sales)'
  AND deal_metadata->>'stage' IN ('26589201', 'Closed lost');

-- ============================================================
-- Europe New Sales (pipeline 89892425)
-- ============================================================

-- S1 - Needs Discovered
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S1 - Needs Discovered (Europe New Sales)"')
WHERE pipeline = '89892425'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Europe New Sales)'
  AND deal_metadata->>'stage' IN ('166590829', 'Needs discovered', 'Needs Discovered', 'S1 - Needs Discovered', 'S1 - Needs discovered');

-- S2 - Buy-in from wider team
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S2 - Buy-in from wider team (Europe New Sales)"')
WHERE pipeline = '89892425'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Europe New Sales)'
  AND deal_metadata->>'stage' IN ('166590830', 'Buy-in from wider team', 'S2 - Buy-in from wider team');

-- S3 - Trial
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S3 - Trial (Europe New Sales)"')
WHERE pipeline = '89892425'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Europe New Sales)'
  AND deal_metadata->>'stage' IN ('166590831', 'Trial', 'S3 - Trial');

-- S4 - Decision Maker Buy-in
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S4 - Decision Maker Buy-in (Europe New Sales)"')
WHERE pipeline = '89892425'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Europe New Sales)'
  AND deal_metadata->>'stage' IN ('166590832', 'Decision Maker Buy-in', 'S4 - Decision Maker Buy-in');

-- S5 - Commercials
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S5 - Commercials (Europe New Sales)"')
WHERE pipeline = '89892425'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Europe New Sales)'
  AND deal_metadata->>'stage' IN ('166590833', 'Commercials', 'S5 - Commercials');

-- S6 - Legal & IT & Security
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S6 - Legal & IT & Security (Europe New Sales)"')
WHERE pipeline = '89892425'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Europe New Sales)'
  AND deal_metadata->>'stage' IN ('166636099', 'S6 - Legal & IT & Security');

-- S7 - Draft Contract
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S7- Draft Contract (Europe New Sales)"')
WHERE pipeline = '89892425'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Europe New Sales)'
  AND deal_metadata->>'stage' IN ('199765128', 'Draft Contract', 'S7- Draft Contract');

-- S8 - Pending Payment
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"S8 - Pending Payment (Europe New Sales)"')
WHERE pipeline = '89892425'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Europe New Sales)'
  AND deal_metadata->>'stage' IN ('166636100', 'Pending Payment', 'S8 - Pending Payment');

-- Closed won / lost
UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"Closed won (Europe New Sales)"')
WHERE pipeline = '89892425'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Europe New Sales)'
  AND deal_metadata->>'stage' IN ('166590834', 'Closed won');

UPDATE risk_evaluations
SET deal_metadata = jsonb_set(deal_metadata, '{stage}', '"Closed lost (Europe New Sales)"')
WHERE pipeline = '89892425'
  AND deal_metadata->>'stage' IS NOT NULL
  AND deal_metadata->>'stage' NOT LIKE '% (Europe New Sales)'
  AND deal_metadata->>'stage' IN ('166590835', 'Closed lost');

COMMIT;
