DO $$
DECLARE
  -- Shared password
  ph TEXT := '$2a$10$CplfH1ubspNVxf30d9BpdezV9FUvW3WERHIIAz40N3GgReTjsQcpq';

  -- Customers (fixed IDs)
  c1 UUID := '87632c2c-2b04-4cb2-9ee8-4246a30c4238';
  c2 UUID := '678e4bcf-5541-4025-b2c7-8120e1a1f1f4';
  c3 UUID := '617c6b68-1e8e-4e8a-8074-d43380d9fe8d';
  c4 UUID := 'f91c2956-9789-43ce-94cf-2acc5b17bc72';

  -- Workers
  w0 UUID := '64d66047-2153-419c-bdf6-d40a4ac1df1a';
  w1 UUID := '11111111-1111-1111-1111-111111111111';
  w2 UUID := '22222222-2222-2222-2222-222222222222';
  w3 UUID := '33333333-3333-3333-3333-333333333333';
  w4 UUID := '44444444-4444-4444-4444-444444444444';
  w5 UUID := '55555555-5555-5555-5555-555555555555';

  -- Job IDs
  j1 UUID := gen_random_uuid();
  j2 UUID := gen_random_uuid();
  j3 UUID := gen_random_uuid();
  j4 UUID := gen_random_uuid();
  j5 UUID := gen_random_uuid();
  j6 UUID := gen_random_uuid();
  j7 UUID := gen_random_uuid();
  j8 UUID := gen_random_uuid();
  j9 UUID := gen_random_uuid();
  j10 UUID := gen_random_uuid();
  j11 UUID := gen_random_uuid();
  j12 UUID := gen_random_uuid();
  j13 UUID := gen_random_uuid();
  j14 UUID := gen_random_uuid();

-- Categories (from DB)
cat_plumbing UUID := 'b00d43ee-1e31-47c7-903f-443d72760292';
cat_elec     UUID := '3c36ae14-3023-49f3-a78e-00f4c22eeb7d';
cat_carp     UUID := 'acf61bff-707e-4490-a3ff-2737fccc0e2c';
cat_clean    UUID := '49be9c57-3909-4275-9e2e-0b294e7bf8c2';
cat_paint    UUID := '0723a3ce-0012-4588-85bf-a2d34e180bc3';
cat_tile     UUID := '9222e72e-dffb-4850-9490-04fc1732f06a';
cat_weld     UUID := '4e14573e-8f46-4447-8f89-32620234f662';
cat_ac       UUID := 'bebcd72c-58eb-45ce-a4bf-0cabe960a66f';
cat_land     UUID := '0b045ea3-db58-44ab-9ca5-f28b3e790a62';
cat_gen      UUID := 'f986a7f6-0aad-4b4b-bbc9-3d2785ed3d4d';

BEGIN

  --  CLEAN (safe reset)
  TRUNCATE TABLE reviews, jobs CASCADE;

  --  USERS (idempotent)
  INSERT INTO users (id, email, password_hash, full_name, role, is_email_verified, force_verified)
  VALUES
    (c2, 'nimal@demo.lk', ph, 'Nimal Silva', 'customer', true, true),
    (c3, 'kamal@demo.lk', ph, 'Kamal Perera', 'customer', true, true),
    (c4, 'sunil@demo.lk', ph, 'Sunil Fernando', 'customer', true, true),

    (w1, 'ravi@demo.lk', ph, 'Ravi Perera', 'worker', true, true),
    (w2, 'saman@demo.lk', ph, 'Saman Fernando', 'worker', true, true),
    (w3, 'kasun@demo.lk', ph, 'Kasun Silva', 'worker', true, true),
    (w4, 'nuwan@demo.lk', ph, 'Nuwan Jayawardena', 'worker', true, true),
    (w5, 'lasith@demo.lk', ph, 'Lasith Bandara', 'worker', true, true)

  ON CONFLICT (id) DO NOTHING;

  --  JOBS
  INSERT INTO jobs (
    id, customer_id, title, description, category_id,
    district, town, urgency, pricing_mode,
    fixed_budget, status, assigned_worker_id, final_price
  )
  VALUES
    (j1, c1, 'Fix toilet flush system', 'Flush broken', cat_plumbing, 'Colombo', 'Nugegoda', 'this_week', 'fixed', 3500, 'reviewed', w1, 3200),
    (j2, c2, 'Replace electrical sockets', 'Socket sparks', cat_elec, 'Gampaha', 'Kelaniya', 'flexible', 'fixed', 4000, 'reviewed', w2, 3800),
    (j3, c3, 'Build shelf', 'Custom shelf', cat_carp, 'Colombo', 'Dehiwala', 'this_week', 'ask_quotes', NULL, 'reviewed', w3, 8500),
    (j4, c4, 'Deep clean house', '3 bedroom cleaning', cat_clean, 'Galle', 'Hikkaduwa', 'today', 'fixed', 7000, 'reviewed', w4, 7000),
    (j5, c1, 'Paint exterior', 'Full repaint', cat_paint, 'Colombo', 'Homagama', 'flexible', 'ask_quotes', NULL, 'reviewed', w5, 22000),
    (j6, c2, 'Retile bathroom', 'Cracked tiles', cat_tile, 'Gampaha', 'Negombo', 'this_week', 'fixed', 12000, 'reviewed', w1, 11500),
    (j7, c3, 'Weld gate', 'Broken welds', cat_weld, 'Kandy', 'Peradeniya', 'today', 'fixed', 5000, 'reviewed', w2, 4500),
    (j8, c4, 'Service AC', 'Not cooling', cat_ac, 'Matara', 'Weligama', 'today', 'fixed', 4500, 'reviewed', w3, 4200),
    (j9, c1, 'Trim hedges', 'Overgrown garden', cat_land, 'Colombo', 'Kottawa', 'flexible', 'fixed', 3000, 'reviewed', w4, 2800),
    (j10, c2, 'Move furniture', 'House move', cat_gen, 'Gampaha', 'Ja-Ela', 'tomorrow', 'fixed', 5000, 'reviewed', w5, 5000),
    (j11, c3, 'Fix water pump', 'Pump issue', cat_plumbing, 'Kandy', 'Katugastota', 'today', 'ask_quotes', NULL, 'reviewed', w0, 6500),
    (j12, c4, 'Install LED lights', 'Outdoor lights', cat_elec, 'Galle', 'Unawatuna', 'this_week', 'fixed', 6000, 'reviewed', w1, 5800),
    (j13, c1, 'Repair staircase', 'Loose steps', cat_carp, 'Colombo', 'Maharagama', 'this_week', 'fixed', 7500, 'reviewed', w2, 7000),
    (j14, c2, 'Clean kitchen', 'Deep clean', cat_clean, 'Gampaha', 'Wattala', 'today', 'fixed', 9000, 'reviewed', w3, 9000);

  --  REVIEWS
  INSERT INTO reviews (job_id, customer_id, worker_id, rating, feedback)
  VALUES
    (j1, c1, w1, 5, 'Excellent work!'),
    (j2, c2, w2, 4, 'Good job'),
    (j3, c3, w3, 5, 'Perfect result'),
    (j4, c4, w4, 4, 'Very clean'),
    (j5, c1, w5, 3, 'Okay work'),
    (j6, c2, w1, 5, 'Great tiling'),
    (j7, c3, w2, 4, 'Solid weld'),
    (j8, c4, w3, 5, 'AC fixed'),
    (j9, c1, w4, 4, 'Nice garden'),
    (j10, c2, w5, 5, 'Smooth move'),
    (j11, c3, w0, 4, 'Pump fixed'),
    (j12, c4, w1, 5, 'Nice lights'),
    (j13, c1, w2, 4, 'Stable stairs'),
    (j14, c2, w3, 5, 'Very clean');

  RAISE NOTICE 'Demo seed complete';

END $$;