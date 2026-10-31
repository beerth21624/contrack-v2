ALTER TABLE "users" ADD COLUMN "locale" text DEFAULT 'th' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_locale_check" CHECK ("users"."locale" in ('th', 'en'));