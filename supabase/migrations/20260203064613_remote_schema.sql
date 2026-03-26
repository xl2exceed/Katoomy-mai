drop policy "Business owners can delete their staff" on "public"."staff";

drop policy "Business owners can insert their staff" on "public"."staff";

drop policy "Business owners can update their staff" on "public"."staff";

drop policy "Business owners can view their staff" on "public"."staff";

drop policy "Public can view active staff" on "public"."staff";


  create table "public"."sms_messages" (
    "id" uuid not null default gen_random_uuid(),
    "business_id" uuid,
    "direction" text not null,
    "from_number" text not null,
    "to_number" text not null,
    "body" text not null,
    "provider" text not null default 'twilio'::text,
    "provider_message_id" text,
    "status" text not null default 'queued'::text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."businesses" add column "phone" text;

CREATE UNIQUE INDEX businesses_slug_unique ON public.businesses USING btree (slug);

CREATE INDEX sms_messages_business_id_idx ON public.sms_messages USING btree (business_id);

CREATE INDEX sms_messages_created_at_idx ON public.sms_messages USING btree (created_at DESC);

CREATE INDEX sms_messages_from_number_idx ON public.sms_messages USING btree (from_number);

CREATE UNIQUE INDEX sms_messages_pkey ON public.sms_messages USING btree (id);

CREATE INDEX sms_messages_to_number_idx ON public.sms_messages USING btree (to_number);

alter table "public"."sms_messages" add constraint "sms_messages_pkey" PRIMARY KEY using index "sms_messages_pkey";

alter table "public"."sms_messages" add constraint "sms_messages_direction_check" CHECK ((direction = ANY (ARRAY['outbound'::text, 'inbound'::text]))) not valid;

alter table "public"."sms_messages" validate constraint "sms_messages_direction_check";

alter table "public"."sms_messages" add constraint "sms_messages_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'failed'::text, 'received'::text]))) not valid;

alter table "public"."sms_messages" validate constraint "sms_messages_status_check";

create or replace view "public"."customer_loyalty_summary" as  SELECT c.id AS customer_id,
    c.business_id,
    c.full_name,
    c.phone,
    COALESCE(sum(ll.points_delta), (0)::bigint) AS total_points,
    COALESCE(sum(r.reward_points_awarded), (0)::bigint) AS referral_points,
    COALESCE(count(*) FILTER (WHERE (r.status = 'completed'::text)), (0)::bigint) AS referral_count
   FROM ((public.customers c
     LEFT JOIN public.loyalty_ledger ll ON ((ll.customer_id = c.id)))
     LEFT JOIN public.referrals r ON ((r.referrer_customer_id = c.id)))
  GROUP BY c.id, c.business_id, c.full_name, c.phone;


grant delete on table "public"."sms_messages" to "anon";

grant insert on table "public"."sms_messages" to "anon";

grant references on table "public"."sms_messages" to "anon";

grant select on table "public"."sms_messages" to "anon";

grant trigger on table "public"."sms_messages" to "anon";

grant truncate on table "public"."sms_messages" to "anon";

grant update on table "public"."sms_messages" to "anon";

grant delete on table "public"."sms_messages" to "authenticated";

grant insert on table "public"."sms_messages" to "authenticated";

grant references on table "public"."sms_messages" to "authenticated";

grant select on table "public"."sms_messages" to "authenticated";

grant trigger on table "public"."sms_messages" to "authenticated";

grant truncate on table "public"."sms_messages" to "authenticated";

grant update on table "public"."sms_messages" to "authenticated";

grant delete on table "public"."sms_messages" to "service_role";

grant insert on table "public"."sms_messages" to "service_role";

grant references on table "public"."sms_messages" to "service_role";

grant select on table "public"."sms_messages" to "service_role";

grant trigger on table "public"."sms_messages" to "service_role";

grant truncate on table "public"."sms_messages" to "service_role";

grant update on table "public"."sms_messages" to "service_role";


  create policy "Premium owners can delete their staff"
  on "public"."staff"
  as permissive
  for delete
  to authenticated
using ((business_id IN ( SELECT b.id
   FROM public.businesses b
  WHERE ((b.owner_user_id = auth.uid()) AND ((b.subscription_plan = ANY (ARRAY['premium'::text, 'pro'::text])) OR ((b.features ->> 'staff_management'::text) = 'true'::text))))));



  create policy "Premium owners can insert staff"
  on "public"."staff"
  as permissive
  for insert
  to authenticated
with check ((business_id IN ( SELECT b.id
   FROM public.businesses b
  WHERE ((b.owner_user_id = auth.uid()) AND ((b.subscription_plan = ANY (ARRAY['premium'::text, 'pro'::text])) OR ((b.features ->> 'staff_management'::text) = 'true'::text))))));



  create policy "Premium owners can update their staff"
  on "public"."staff"
  as permissive
  for update
  to authenticated
using ((business_id IN ( SELECT b.id
   FROM public.businesses b
  WHERE ((b.owner_user_id = auth.uid()) AND ((b.subscription_plan = ANY (ARRAY['premium'::text, 'pro'::text])) OR ((b.features ->> 'staff_management'::text) = 'true'::text))))))
with check ((business_id IN ( SELECT b.id
   FROM public.businesses b
  WHERE ((b.owner_user_id = auth.uid()) AND ((b.subscription_plan = ANY (ARRAY['premium'::text, 'pro'::text])) OR ((b.features ->> 'staff_management'::text) = 'true'::text))))));



  create policy "Premium owners can view their staff"
  on "public"."staff"
  as permissive
  for select
  to authenticated
using ((business_id IN ( SELECT b.id
   FROM public.businesses b
  WHERE ((b.owner_user_id = auth.uid()) AND ((b.subscription_plan = ANY (ARRAY['premium'::text, 'pro'::text])) OR ((b.features ->> 'staff_management'::text) = 'true'::text))))));



  create policy "Public can view active staff for premium businesses"
  on "public"."staff"
  as permissive
  for select
  to anon, authenticated
using (((is_active = true) AND (business_id IN ( SELECT b.id
   FROM public.businesses b
  WHERE ((b.subscription_plan = ANY (ARRAY['premium'::text, 'pro'::text])) OR ((b.features ->> 'staff_management'::text) = 'true'::text))))));

/*
 CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();

 CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();

 CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();

 CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();

 CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();
*/

