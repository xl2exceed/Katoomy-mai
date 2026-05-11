-- Tracks which customers have redeemed which network offers.
-- One redemption allowed per (offer_id, customer_phone) pair.

create table if not exists network_offer_redemptions (
  id              uuid primary key default gen_random_uuid(),
  offer_id        uuid not null references network_offers(id) on delete cascade,
  customer_phone  text not null,
  business_id     uuid not null references businesses(id),
  booking_id      uuid references bookings(id),
  redeemed_at     timestamptz not null default now()
);

create unique index if not exists network_offer_redemptions_unique
  on network_offer_redemptions (offer_id, customer_phone);

create index if not exists idx_offer_redemptions_offer on network_offer_redemptions (offer_id);
create index if not exists idx_offer_redemptions_phone on network_offer_redemptions (customer_phone);
