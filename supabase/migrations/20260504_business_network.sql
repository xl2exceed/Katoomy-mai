-- Business Network feature
-- network_settings: one row per business, controls participation
create table if not exists network_settings (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null unique references businesses(id) on delete cascade,
  enabled                  boolean not null default false,
  auto_approve_partners    boolean not null default true,
  allow_katoomy_suggestions boolean not null default true,
  max_monthly_spend_cents  integer not null default 10000,
  referral_reward_cents    integer not null default 500,
  onboarding_complete      boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- network_offers: discount offers a business creates for partner customers
create table if not exists network_offers (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references businesses(id) on delete cascade,
  title            text not null,
  offer_type       text not null check (offer_type in ('dollar_off', 'percent_off')),
  amount           integer not null, -- cents for dollar_off; percentage points for percent_off
  min_spend_cents  integer,
  expires_at       timestamptz,
  active           boolean not null default true,
  used_count       integer not null default 0,
  total_cost_cents integer not null default 0,
  budget_cents     integer,
  created_at       timestamptz not null default now()
);

create index if not exists idx_network_offers_business on network_offers (business_id);

-- network_partners: bidirectional business partnerships
-- business_a_id is the initiator; status is shared between both
create table if not exists network_partners (
  id             uuid primary key default gen_random_uuid(),
  business_a_id  uuid not null references businesses(id) on delete cascade,
  business_b_id  uuid not null references businesses(id) on delete cascade,
  status         text not null default 'pending'
                   check (status in ('pending', 'active', 'rejected', 'removed')),
  initiated_by   uuid not null references businesses(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint network_partners_unique unique (business_a_id, business_b_id),
  constraint network_partners_no_self check (business_a_id != business_b_id)
);

create index if not exists idx_network_partners_a on network_partners (business_a_id);
create index if not exists idx_network_partners_b on network_partners (business_b_id);

-- network_referrals: tracks when a customer books using a partner's offer
create table if not exists network_referrals (
  id                    uuid primary key default gen_random_uuid(),
  offer_id              uuid not null references network_offers(id) on delete cascade,
  referring_business_id uuid not null references businesses(id),
  receiving_business_id uuid not null references businesses(id),
  customer_id           uuid references customers(id),
  booking_id            uuid references bookings(id),
  status                text not null default 'pending'
                          check (status in ('pending', 'completed', 'credited')),
  discount_applied_cents integer not null default 0,
  reward_cents           integer not null default 0,
  created_at            timestamptz not null default now(),
  completed_at          timestamptz
);

create index if not exists idx_network_referrals_offer    on network_referrals (offer_id);
create index if not exists idx_network_referrals_referring on network_referrals (referring_business_id);
create index if not exists idx_network_referrals_receiving on network_referrals (receiving_business_id);

-- network_credits: Katoomy billing credits earned by businesses via referrals
create table if not exists network_credits (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references businesses(id) on delete cascade,
  amount_cents         integer not null,
  reason               text not null,
  network_referral_id  uuid references network_referrals(id),
  created_at           timestamptz not null default now()
);

-- Service role only — no public access
alter table network_settings  enable row level security;
alter table network_offers    enable row level security;
alter table network_partners  enable row level security;
alter table network_referrals enable row level security;
alter table network_credits   enable row level security;

create policy "deny_all" on network_settings  as restrictive for all using (false);
create policy "deny_all" on network_offers    as restrictive for all using (false);
create policy "deny_all" on network_partners  as restrictive for all using (false);
create policy "deny_all" on network_referrals as restrictive for all using (false);
create policy "deny_all" on network_credits   as restrictive for all using (false);
