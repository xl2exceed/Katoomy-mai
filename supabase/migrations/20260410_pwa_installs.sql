-- Track PWA installs per business
create table if not exists pwa_installs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  installed_at timestamptz not null default now(),
  user_agent text
);

create index if not exists pwa_installs_business_id_idx on pwa_installs(business_id);
