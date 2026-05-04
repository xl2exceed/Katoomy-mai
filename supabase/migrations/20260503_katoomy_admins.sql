-- Katoomy super-admin portal access table
-- Only service_role can read/write this table (deny-all RLS)

create table if not exists katoomy_admins (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text not null,
  role        text not null default 'employee' check (role in ('owner', 'employee')),
  created_at  timestamptz not null default now()
);

-- Deny all access via public/anon/authenticated roles — service_role only
alter table katoomy_admins enable row level security;
create policy "deny_all" on katoomy_admins as restrictive
  for all using (false);

-- Seed the owner account
insert into katoomy_admins (email, name, role)
values ('pattersonab3@gmail.com', 'Alvin Patterson', 'owner')
on conflict (email) do nothing;
