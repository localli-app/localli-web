CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TYPE "public"."actor_type" AS ENUM('customer', 'staff', 'system');--> statement-breakpoint
CREATE TYPE "public"."booking_source" AS ENUM('gmb', 'qr', 'ig', 'sms', 'web', 'direct', 'manual', 'marketplace');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending_payment', 'confirmed', 'in_progress', 'completed', 'no_show', 'cancelled_by_customer', 'cancelled_by_business');--> statement-breakpoint
CREATE TYPE "public"."identity_kind" AS ENUM('email', 'phone', 'device_token');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('deposit', 'balance', 'full', 'no_show_fee', 'refund');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'paid');--> statement-breakpoint
CREATE TYPE "public"."service_area_kind" AS ENUM('radius', 'polygon', 'postcodes');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('owner', 'manager', 'staff');--> statement-breakpoint
CREATE TABLE "blackout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"from_status" "booking_status",
	"to_status" "booking_status",
	"actor_type" "actor_type" NOT NULL,
	"actor_id" uuid,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"service_location_id" uuid,
	"travel_in_minutes" integer,
	"travel_out_minutes" integer,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"price_minor" integer NOT NULL,
	"deposit_minor" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"source" "booking_source" DEFAULT 'direct' NOT NULL,
	"source_detail" text,
	"customer_note" text,
	"staff_note" text,
	"policy_snapshot" jsonb NOT NULL,
	"access_token_hash" text NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_customer" (
	"business_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"display_name" text,
	"notes" text,
	"tags" text[],
	"first_booked_at" timestamp with time zone,
	"last_booked_at" timestamp with time zone,
	"total_bookings" integer DEFAULT 0 NOT NULL,
	"total_spend_minor" integer DEFAULT 0 NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "business_customer_business_id_customer_id_pk" PRIMARY KEY("business_id","customer_id")
);
--> statement-breakpoint
CREATE TABLE "business_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"opens_local" time NOT NULL,
	"closes_local" time NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"timezone" text NOT NULL,
	"currency" text NOT NULL,
	"address_location_id" uuid,
	"phone" text,
	"email" text NOT NULL,
	"logo_url" text,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"stripe_account_id" text,
	"stripe_subscription_id" text,
	"is_mobile_enabled" boolean DEFAULT false NOT NULL,
	"booking_settings" jsonb DEFAULT '{"slotGranularityMinutes":15,"minNoticeMinutes":120,"maxAdvanceDays":60,"cancellationWindowHours":24,"requireLastName":false,"contactField":"phone","autoCompleteAfterMinutes":60,"assignmentRule":"least_utilised"}'::jsonb NOT NULL,
	"availability_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_identity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"kind" "identity_kind" NOT NULL,
	"value" text NOT NULL,
	"confidence" integer DEFAULT 50 NOT NULL,
	"verified_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"phone" text,
	"first_name" text,
	"last_name" text,
	"email_verified_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"default_locale" text,
	"first_seen_business_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" text,
	"region" text,
	"postcode" text,
	"country" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"geog" geography(Point, 4326),
	"access_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "out_of_area_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"postcode" text,
	"service_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"stripe_payment_intent_id" text,
	"kind" "payment_kind" NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"sent_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"portal_visited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_area" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_id" uuid,
	"kind" "service_area_kind" NOT NULL,
	"label" text,
	"centre_geog" geography(Point, 4326),
	"radius_metres" integer,
	"postcodes" text[],
	"travel_surcharge_minor" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_staff" (
	"service_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	CONSTRAINT "service_staff_service_id_staff_id_pk" PRIMARY KEY("service_id","staff_id")
);
--> statement-breakpoint
CREATE TABLE "service" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"category" text,
	"name" text NOT NULL,
	"description" text,
	"duration_minutes" integer NOT NULL,
	"buffer_after_minutes" integer DEFAULT 0 NOT NULL,
	"setup_minutes" integer DEFAULT 0 NOT NULL,
	"packdown_minutes" integer DEFAULT 0 NOT NULL,
	"price_minor" integer NOT NULL,
	"deposit_percent" integer DEFAULT 0 NOT NULL,
	"rebook_interval_days" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"bio" text,
	"role" "staff_role" DEFAULT 'staff' NOT NULL,
	"email" text,
	"is_bookable" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"starts_local" time NOT NULL,
	"ends_local" time NOT NULL,
	"effective_from" date,
	"effective_to" date
);
--> statement-breakpoint
CREATE TABLE "staff_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "travel_estimate_cache" (
	"origin_cell" text NOT NULL,
	"dest_cell" text NOT NULL,
	"time_bucket" integer NOT NULL,
	"minutes" integer NOT NULL,
	"distance_metres" integer,
	"source" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "travel_estimate_cache_origin_cell_dest_cell_time_bucket_pk" PRIMARY KEY("origin_cell","dest_cell","time_bucket")
);
--> statement-breakpoint
CREATE TABLE "travel_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_id" uuid,
	"max_leg_minutes" integer DEFAULT 45 NOT NULL,
	"max_daily_drive_minutes" integer DEFAULT 180 NOT NULL,
	"road_factor" double precision DEFAULT 1.3 NOT NULL,
	"default_speed_kmh" double precision DEFAULT 25 NOT NULL,
	"fixed_overhead_minutes" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blackout" ADD CONSTRAINT "blackout_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blackout" ADD CONSTRAINT "blackout_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_event" ADD CONSTRAINT "booking_event_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_service_location_id_location_id_fk" FOREIGN KEY ("service_location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_customer" ADD CONSTRAINT "business_customer_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_customer" ADD CONSTRAINT "business_customer_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business" ADD CONSTRAINT "business_address_location_id_location_id_fk" FOREIGN KEY ("address_location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_identity" ADD CONSTRAINT "customer_identity_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_session" ADD CONSTRAINT "customer_session_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_first_seen_business_id_business_id_fk" FOREIGN KEY ("first_seen_business_id") REFERENCES "public"."business"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "out_of_area_request" ADD CONSTRAINT "out_of_area_request_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "out_of_area_request" ADD CONSTRAINT "out_of_area_request_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_area" ADD CONSTRAINT "service_area_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_area" ADD CONSTRAINT "service_area_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_staff" ADD CONSTRAINT "service_staff_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_staff" ADD CONSTRAINT "service_staff_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service" ADD CONSTRAINT "service_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_hours" ADD CONSTRAINT "staff_hours_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_session" ADD CONSTRAINT "staff_session_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_policy" ADD CONSTRAINT "travel_policy_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_policy" ADD CONSTRAINT "travel_policy_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blackout_business_range_idx" ON "blackout" USING btree ("business_id","starts_at");--> statement-breakpoint
CREATE INDEX "booking_event_booking_idx" ON "booking_event" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_business_range_idx" ON "booking" USING btree ("business_id","starts_at");--> statement-breakpoint
CREATE INDEX "booking_staff_range_idx" ON "booking" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "booking_customer_idx" ON "booking" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_token_idx" ON "booking" USING btree ("access_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_idempotency_idx" ON "booking" USING btree ("business_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "business_customer_customer_idx" ON "business_customer" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "business_hours_business_idx" ON "business_hours" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_slug_idx" ON "business" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_identity_lookup_idx" ON "customer_identity" USING btree ("kind","value");--> statement-breakpoint
CREATE INDEX "customer_identity_customer_idx" ON "customer_identity" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_session_token_idx" ON "customer_session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "customer_email_idx" ON "customer" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customer_phone_idx" ON "customer" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "location_postcode_idx" ON "location" USING btree ("postcode");--> statement-breakpoint
CREATE INDEX "out_of_area_business_idx" ON "out_of_area_request" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "payment_booking_idx" ON "payment" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_token_idx" ON "receipt" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_booking_idx" ON "receipt" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "service_area_business_idx" ON "service_area" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "service_staff_staff_idx" ON "service_staff" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "service_business_idx" ON "service" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "staff_business_idx" ON "staff" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "staff_hours_staff_idx" ON "staff_hours" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_session_token_idx" ON "staff_session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "travel_policy_business_idx" ON "travel_policy" USING btree ("business_id");