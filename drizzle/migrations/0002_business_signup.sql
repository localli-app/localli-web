CREATE TABLE "auth_login_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"redirect_to" text,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_login_token_token_idx" ON "auth_login_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_login_token_email_idx" ON "auth_login_token" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "auth_login_token_ip_idx" ON "auth_login_token" USING btree ("ip","created_at");