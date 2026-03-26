revoke delete on table "public"."automated_messages" from "anon";

revoke insert on table "public"."automated_messages" from "anon";

revoke references on table "public"."automated_messages" from "anon";

revoke select on table "public"."automated_messages" from "anon";

revoke trigger on table "public"."automated_messages" from "anon";

revoke truncate on table "public"."automated_messages" from "anon";

revoke update on table "public"."automated_messages" from "anon";

revoke delete on table "public"."automated_messages" from "authenticated";

revoke insert on table "public"."automated_messages" from "authenticated";

revoke references on table "public"."automated_messages" from "authenticated";

revoke select on table "public"."automated_messages" from "authenticated";

revoke trigger on table "public"."automated_messages" from "authenticated";

revoke truncate on table "public"."automated_messages" from "authenticated";

revoke update on table "public"."automated_messages" from "authenticated";

revoke delete on table "public"."automated_messages" from "service_role";

revoke insert on table "public"."automated_messages" from "service_role";

revoke references on table "public"."automated_messages" from "service_role";

revoke select on table "public"."automated_messages" from "service_role";

revoke trigger on table "public"."automated_messages" from "service_role";

revoke truncate on table "public"."automated_messages" from "service_role";

revoke update on table "public"."automated_messages" from "service_role";

alter table "public"."automated_messages" drop constraint "automated_messages_business_id_fkey";

alter table "public"."automated_messages" drop constraint "automated_messages_business_id_key";

alter table "public"."automated_messages" drop constraint "automated_messages_pkey";

drop index if exists "public"."automated_messages_business_id_key";

drop index if exists "public"."automated_messages_pkey";

drop table "public"."automated_messages";


  create table "public"."notification_rules" (
    "id" uuid not null default gen_random_uuid(),
    "business_id" uuid not null,
    "channel" text not null,
    "kind" text not null,
    "offset_minutes" integer,
    "inactive_days" integer,
    "applies_to" text not null default 'all'::text,
    "service_ids" uuid[],
    "staff_ids" uuid[],
    "template" text not null,
    "enabled" boolean not null default true,
    "max_per_customer_per_day" integer not null default 3,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."scheduled_messages" (
    "id" uuid not null default gen_random_uuid(),
    "business_id" uuid,
    "to_number" text not null,
    "body" text not null,
    "run_at" timestamp with time zone not null,
    "status" text not null default 'scheduled'::text,
    "sent_message_id" uuid,
    "appointment_id" uuid,
    "rule_id" uuid,
    "customer_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."businesses" add column "stripe_customer_id" text;

alter table "public"."businesses" add column "stripe_subscription_id" text;

alter table "public"."businesses" add column "subscription_current_period_end" timestamp with time zone;

alter table "public"."businesses" add column "subscription_status" text default 'active'::text;

CREATE INDEX idx_businesses_stripe_customer ON public.businesses USING btree (stripe_customer_id);

CREATE INDEX notification_rules_business_idx ON public.notification_rules USING btree (business_id);

CREATE INDEX notification_rules_enabled_idx ON public.notification_rules USING btree (business_id, enabled) WHERE (enabled = true);

CREATE INDEX notification_rules_kind_idx ON public.notification_rules USING btree (business_id, kind, enabled) WHERE (enabled = true);

CREATE UNIQUE INDEX notification_rules_pkey ON public.notification_rules USING btree (id);

CREATE INDEX scheduled_messages_appt_idx ON public.scheduled_messages USING btree (appointment_id);

CREATE INDEX scheduled_messages_business_id_idx ON public.scheduled_messages USING btree (business_id);

CREATE INDEX scheduled_messages_customer_idx ON public.scheduled_messages USING btree (customer_id);

CREATE UNIQUE INDEX scheduled_messages_pkey ON public.scheduled_messages USING btree (id);

CREATE INDEX scheduled_messages_rule_idx ON public.scheduled_messages USING btree (rule_id);

CREATE INDEX scheduled_messages_run_at_idx ON public.scheduled_messages USING btree (run_at) WHERE (status = 'scheduled'::text);

CREATE INDEX scheduled_messages_status_idx ON public.scheduled_messages USING btree (status);

CREATE UNIQUE INDEX scheduled_messages_unique_rule_appt ON public.scheduled_messages USING btree (appointment_id, rule_id);

alter table "public"."notification_rules" add constraint "notification_rules_pkey" PRIMARY KEY using index "notification_rules_pkey";

alter table "public"."scheduled_messages" add constraint "scheduled_messages_pkey" PRIMARY KEY using index "scheduled_messages_pkey";

alter table "public"."notification_rules" add constraint "notification_rules_applies_to_check" CHECK ((applies_to = ANY (ARRAY['all'::text, 'confirmed_only'::text, 'services'::text, 'staff'::text]))) not valid;

alter table "public"."notification_rules" validate constraint "notification_rules_applies_to_check";

alter table "public"."notification_rules" add constraint "notification_rules_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE not valid;

alter table "public"."notification_rules" validate constraint "notification_rules_business_id_fkey";

alter table "public"."notification_rules" add constraint "notification_rules_channel_check" CHECK ((channel = 'sms'::text)) not valid;

alter table "public"."notification_rules" validate constraint "notification_rules_channel_check";

alter table "public"."notification_rules" add constraint "notification_rules_inactive_days_check" CHECK ((inactive_days > 0)) not valid;

alter table "public"."notification_rules" validate constraint "notification_rules_inactive_days_check";

alter table "public"."notification_rules" add constraint "notification_rules_kind_check" CHECK ((kind = ANY (ARRAY['appointment_reminder'::text, 'winback'::text]))) not valid;

alter table "public"."notification_rules" validate constraint "notification_rules_kind_check";

alter table "public"."notification_rules" add constraint "notification_rules_max_per_customer_per_day_check" CHECK ((max_per_customer_per_day > 0)) not valid;

alter table "public"."notification_rules" validate constraint "notification_rules_max_per_customer_per_day_check";

alter table "public"."notification_rules" add constraint "notification_rules_offset_minutes_check" CHECK ((offset_minutes > 0)) not valid;

alter table "public"."notification_rules" validate constraint "notification_rules_offset_minutes_check";

alter table "public"."scheduled_messages" add constraint "scheduled_messages_appointment_id_fkey" FOREIGN KEY (appointment_id) REFERENCES public.bookings(id) ON DELETE CASCADE not valid;

alter table "public"."scheduled_messages" validate constraint "scheduled_messages_appointment_id_fkey";

alter table "public"."scheduled_messages" add constraint "scheduled_messages_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE not valid;

alter table "public"."scheduled_messages" validate constraint "scheduled_messages_business_id_fkey";

alter table "public"."scheduled_messages" add constraint "scheduled_messages_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE not valid;

alter table "public"."scheduled_messages" validate constraint "scheduled_messages_customer_id_fkey";

alter table "public"."scheduled_messages" add constraint "scheduled_messages_rule_id_fkey" FOREIGN KEY (rule_id) REFERENCES public.notification_rules(id) ON DELETE SET NULL not valid;

alter table "public"."scheduled_messages" validate constraint "scheduled_messages_rule_id_fkey";

alter table "public"."scheduled_messages" add constraint "scheduled_messages_sent_message_id_fkey" FOREIGN KEY (sent_message_id) REFERENCES public.sms_messages(id) not valid;

alter table "public"."scheduled_messages" validate constraint "scheduled_messages_sent_message_id_fkey";

alter table "public"."scheduled_messages" add constraint "scheduled_messages_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'canceled'::text]))) not valid;

alter table "public"."scheduled_messages" validate constraint "scheduled_messages_status_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."notification_rules" to "anon";

grant insert on table "public"."notification_rules" to "anon";

grant references on table "public"."notification_rules" to "anon";

grant select on table "public"."notification_rules" to "anon";

grant trigger on table "public"."notification_rules" to "anon";

grant truncate on table "public"."notification_rules" to "anon";

grant update on table "public"."notification_rules" to "anon";

grant delete on table "public"."notification_rules" to "authenticated";

grant insert on table "public"."notification_rules" to "authenticated";

grant references on table "public"."notification_rules" to "authenticated";

grant select on table "public"."notification_rules" to "authenticated";

grant trigger on table "public"."notification_rules" to "authenticated";

grant truncate on table "public"."notification_rules" to "authenticated";

grant update on table "public"."notification_rules" to "authenticated";

grant delete on table "public"."notification_rules" to "service_role";

grant insert on table "public"."notification_rules" to "service_role";

grant references on table "public"."notification_rules" to "service_role";

grant select on table "public"."notification_rules" to "service_role";

grant trigger on table "public"."notification_rules" to "service_role";

grant truncate on table "public"."notification_rules" to "service_role";

grant update on table "public"."notification_rules" to "service_role";

grant delete on table "public"."scheduled_messages" to "anon";

grant insert on table "public"."scheduled_messages" to "anon";

grant references on table "public"."scheduled_messages" to "anon";

grant select on table "public"."scheduled_messages" to "anon";

grant trigger on table "public"."scheduled_messages" to "anon";

grant truncate on table "public"."scheduled_messages" to "anon";

grant update on table "public"."scheduled_messages" to "anon";

grant delete on table "public"."scheduled_messages" to "authenticated";

grant insert on table "public"."scheduled_messages" to "authenticated";

grant references on table "public"."scheduled_messages" to "authenticated";

grant select on table "public"."scheduled_messages" to "authenticated";

grant trigger on table "public"."scheduled_messages" to "authenticated";

grant truncate on table "public"."scheduled_messages" to "authenticated";

grant update on table "public"."scheduled_messages" to "authenticated";

grant delete on table "public"."scheduled_messages" to "service_role";

grant insert on table "public"."scheduled_messages" to "service_role";

grant references on table "public"."scheduled_messages" to "service_role";

grant select on table "public"."scheduled_messages" to "service_role";

grant trigger on table "public"."scheduled_messages" to "service_role";

grant truncate on table "public"."scheduled_messages" to "service_role";

grant update on table "public"."scheduled_messages" to "service_role";

CREATE TRIGGER update_notification_rules_updated_at BEFORE UPDATE ON public.notification_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_messages_updated_at BEFORE UPDATE ON public.scheduled_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


