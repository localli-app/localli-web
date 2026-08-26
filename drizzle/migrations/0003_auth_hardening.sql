CREATE TYPE "public"."auth_event_kind" AS ENUM('link_requested', 'link_rate_limited', 'link_consumed', 'link_rejected', 'account_created', 'session_revoked', 'signed_out', 'data_exported', 'account_deleted');--> statement-breakpoint
CREATE TABLE "auth_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "auth_event_kind" NOT NULL,
	"email" text,
	"staff_id" uuid,
	"business_id" uuid,
	"ip" text,
	"user_agent" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_session" ADD COLUMN "ip" text;--> statement-breakpoint
ALTER TABLE "staff_session" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "staff_session" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_session" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "auth_event_email_idx" ON "auth_event" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "auth_event_staff_idx" ON "auth_event" USING btree ("staff_id","created_at");--> statement-breakpoint
CREATE INDEX "staff_session_staff_idx" ON "staff_session" USING btree ("staff_id");