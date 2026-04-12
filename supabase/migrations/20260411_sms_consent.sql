-- Add SMS consent tracking to customers table
alter table customers
  add column if not exists sms_consent boolean not null default false,
  add column if not exists sms_consent_at timestamptz;
