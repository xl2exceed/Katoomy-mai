-- Tracks per-customer device type and PWA install status.
-- Upserted on every customer dashboard visit; one row per customer.

create table if not exists customer_devices (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null unique references customers(id) on delete cascade,
  business_id    uuid not null references businesses(id) on delete cascade,
  device_type    text not null default 'unknown'
                   check (device_type in ('ios', 'android', 'desktop', 'unknown')),
  app_installed  boolean not null default false,
  user_agent     text,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);

create index if not exists idx_customer_devices_business
  on customer_devices (business_id);

-- Service role only — no public access needed
alter table customer_devices enable row level security;
create policy "deny_all" on customer_devices as restrictive for all using (false);
