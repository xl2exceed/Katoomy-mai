-- Hub PWA install tracking + ipad device type

-- hub_installs: one row per install event from the Business Hub
create table if not exists hub_installs (
  id             uuid primary key default gen_random_uuid(),
  installed_at   timestamptz not null default now(),
  device_type    text not null default 'unknown'
                   check (device_type in ('ios', 'ipad', 'android', 'desktop', 'unknown')),
  referrer_slug  text,   -- which business QR/link drove the install
  user_agent     text
);

create index if not exists idx_hub_installs_device on hub_installs (device_type);
create index if not exists idx_hub_installs_date   on hub_installs (installed_at);
create index if not exists idx_hub_installs_ref    on hub_installs (referrer_slug);

alter table hub_installs enable row level security;
create policy "deny_all" on hub_installs as restrictive for all using (false);

-- Add ipad to customer_devices constraint (handles case where migration was already run)
do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'customer_devices'
  ) then
    alter table customer_devices
      drop constraint if exists customer_devices_device_type_check;
    alter table customer_devices
      add constraint customer_devices_device_type_check
      check (device_type in ('ios', 'ipad', 'android', 'desktop', 'unknown'));
  end if;
end $$;
