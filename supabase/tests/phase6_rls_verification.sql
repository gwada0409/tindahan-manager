-- Run against a disposable local Supabase database after both migrations.
begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(4);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'phase6-owner-a@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'phase6-owner-b@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'phase6-cashier@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.stores (id, name, owner_user_id)
values
  (
    '20000000-0000-0000-0000-000000000001',
    'Phase 6 Store A',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'Phase 6 Store B',
    '10000000-0000-0000-0000-000000000002'
  );

insert into public.store_members (store_id, user_id, role)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'owner'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'owner'
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'cashier'
  );

insert into public.devices (device_key, store_id, user_id, name)
values
  (
    'phase6-owner-a-device',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Owner A test device'
  ),
  (
    'phase6-owner-b-device',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'Owner B test device'
  ),
  (
    'phase6-cashier-device',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'Cashier test device'
  );

insert into public.product_categories (
  id,
  store_id,
  name,
  updated_by,
  device_id
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Store A category',
    '10000000-0000-0000-0000-000000000001',
    'phase6-owner-a-device'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Store B category',
    '10000000-0000-0000-0000-000000000002',
    'phase6-owner-b-device'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

select extensions.is(
  (
    select count(*)
    from public.product_categories
    where store_id = '20000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'an owner cannot read another store category'
);

select extensions.throws_ok(
  $$insert into public.product_categories (
      id, store_id, name, updated_by, device_id
    )
    values (
      '30000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000002',
      'cross-store write',
      '10000000-0000-0000-0000-000000000001',
      'phase6-owner-a-device'
    )$$,
  '42501',
  null,
  'an owner cannot write another store'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000003',
  true
);

select extensions.throws_ok(
  $$insert into public.employees (
      id,
      store_id,
      name,
      role,
      contact,
      start_date,
      pay_type,
      default_rate,
      active,
      notes,
      updated_by,
      device_id
    )
    values (
      '40000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'Unauthorized employee',
      'Staff',
      '',
      now(),
      'daily',
      0,
      true,
      '',
      '10000000-0000-0000-0000-000000000003',
      'phase6-cashier-device'
    )$$,
  '42501',
  null,
  'cashiers cannot create employee records'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

insert into public.sync_operations (
  id,
  operation_id,
  store_id,
  entity_type,
  entity_id,
  operation,
  updated_by,
  device_id
)
values (
  '50000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'products',
  '70000000-0000-0000-0000-000000000001',
  'upsert',
  '10000000-0000-0000-0000-000000000001',
  'phase6-owner-a-device'
);

select extensions.throws_ok(
  $$insert into public.sync_operations (
      id,
      operation_id,
      store_id,
      entity_type,
      entity_id,
      operation,
      updated_by,
      device_id
    )
    values (
      '50000000-0000-0000-0000-000000000002',
      '60000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'products',
      '70000000-0000-0000-0000-000000000002',
      'upsert',
      '10000000-0000-0000-0000-000000000001',
      'phase6-owner-a-device'
    )$$,
  '23505',
  null,
  'duplicate operation IDs are rejected'
);

select * from extensions.finish();
rollback;
