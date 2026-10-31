CREATE TABLE "sd_issues" (
	"id" uuid PRIMARY KEY NOT NULL,
	"report_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sd_issues_kind_check" CHECK ("sd_issues"."kind" in ('delay', 'safety', 'quality', 'material', 'weather', 'customer', 'other')),
	CONSTRAINT "sd_issues_severity_check" CHECK ("sd_issues"."severity" in ('low', 'medium', 'high')),
	CONSTRAINT "sd_issues_status_check" CHECK ("sd_issues"."status" in ('open', 'resolved'))
);
--> statement-breakpoint
CREATE TABLE "sd_manpower" (
	"id" uuid PRIMARY KEY NOT NULL,
	"report_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"crew_id" uuid,
	"supplier_id" uuid,
	"crew_name" text DEFAULT '' NOT NULL,
	"trade" text DEFAULT '' NOT NULL,
	"skilled_count" integer DEFAULT 0 NOT NULL,
	"labourer_count" integer DEFAULT 0 NOT NULL,
	"hours" numeric(4, 1) DEFAULT 8 NOT NULL,
	"cost_code_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sd_photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"report_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"taken_at" timestamp with time zone,
	"caption" text DEFAULT '' NOT NULL,
	"cost_code_id" uuid,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sd_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"report_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"weather_morning" text,
	"weather_afternoon" text,
	"rain_hours" numeric(4, 1) DEFAULT 0 NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"submitted_by" uuid,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sd_reports_project_date_key" UNIQUE("project_id","report_date"),
	CONSTRAINT "sd_reports_status_check" CHECK ("sd_reports"."status" in ('draft', 'submitted')),
	CONSTRAINT "sd_reports_weather_morning_check" CHECK ("sd_reports"."weather_morning" in ('sunny', 'cloudy', 'rain', 'storm')),
	CONSTRAINT "sd_reports_weather_afternoon_check" CHECK ("sd_reports"."weather_afternoon" in ('sunny', 'cloudy', 'rain', 'storm'))
);
--> statement-breakpoint
CREATE TABLE "sd_work_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"report_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"cost_code_id" uuid NOT NULL,
	"qty_done" numeric(16, 4),
	"progress_after" numeric(7, 6) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sd_work_items_report_cost_code_key" UNIQUE("report_id","cost_code_id")
);
--> statement-breakpoint
ALTER TABLE "sd_issues" ADD CONSTRAINT "sd_issues_report_id_sd_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."sd_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_issues" ADD CONSTRAINT "sd_issues_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_issues" ADD CONSTRAINT "sd_issues_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_manpower" ADD CONSTRAINT "sd_manpower_report_id_sd_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."sd_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_manpower" ADD CONSTRAINT "sd_manpower_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_photos" ADD CONSTRAINT "sd_photos_report_id_sd_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."sd_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_photos" ADD CONSTRAINT "sd_photos_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_reports" ADD CONSTRAINT "sd_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_reports" ADD CONSTRAINT "sd_reports_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_work_items" ADD CONSTRAINT "sd_work_items_report_id_sd_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."sd_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sd_work_items" ADD CONSTRAINT "sd_work_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sd_issues_report_idx" ON "sd_issues" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "sd_issues_workspace_project_status_idx" ON "sd_issues" USING btree ("workspace_id","project_id","status");--> statement-breakpoint
CREATE INDEX "sd_manpower_report_idx" ON "sd_manpower" USING btree ("report_id","sort");--> statement-breakpoint
CREATE INDEX "sd_photos_report_idx" ON "sd_photos" USING btree ("report_id","sort");--> statement-breakpoint
CREATE INDEX "sd_reports_workspace_project_date_idx" ON "sd_reports" USING btree ("workspace_id","project_id","report_date");--> statement-breakpoint
CREATE INDEX "sd_work_items_workspace_cost_code_idx" ON "sd_work_items" USING btree ("workspace_id","cost_code_id");