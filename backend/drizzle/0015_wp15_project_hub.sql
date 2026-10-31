ALTER TABLE "projects" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "status" text DEFAULT 'estimating' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "project_type" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "planned_start" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "planned_finish" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "actual_start" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "actual_finish" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "manager_user_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_workspace_code_key" ON "projects" USING btree ("workspace_id","code") WHERE "projects"."code" is not null;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_status_check" CHECK ("projects"."status" in ('lead', 'estimating', 'quoted', 'won', 'in_progress', 'handover', 'warranty', 'closed', 'lost', 'cancelled'));--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_type_check" CHECK ("projects"."project_type" in ('residential_new', 'residential_renovation', 'government', 'commercial'));