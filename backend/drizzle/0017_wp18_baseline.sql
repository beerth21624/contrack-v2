CREATE TABLE "project_baselines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"contract_id" uuid,
	"locked_by" uuid NOT NULL,
	"locked_at" timestamp with time zone NOT NULL,
	"unlocked_by" uuid,
	"unlocked_at" timestamp with time zone,
	"unlock_reason" text DEFAULT '' NOT NULL,
	CONSTRAINT "project_baselines_status_check" CHECK ("project_baselines"."status" in ('active', 'unlocked')),
	CONSTRAINT "project_baselines_reason_check" CHECK ("project_baselines"."reason" in ('contract_signed', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "project_cost_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"code" text NOT NULL,
	"source" text NOT NULL,
	"source_ref" uuid,
	"section_no" integer NOT NULL,
	"line_key" text,
	"desc_th" text NOT NULL,
	"desc_en" text DEFAULT '' NOT NULL,
	"unit" text NOT NULL,
	"sort" integer NOT NULL,
	"baseline_qty" numeric(16, 4) DEFAULT 0 NOT NULL,
	"baseline_mat_unit" numeric(16, 4) DEFAULT 0 NOT NULL,
	"baseline_lab_unit" numeric(16, 4) DEFAULT 0 NOT NULL,
	"baseline_mat" numeric(14, 2) DEFAULT 0 NOT NULL,
	"baseline_lab" numeric(14, 2) DEFAULT 0 NOT NULL,
	"baseline_total" numeric(14, 2) DEFAULT 0 NOT NULL,
	"vo_qty" numeric(16, 4) DEFAULT 0 NOT NULL,
	"vo_cost" numeric(14, 2) DEFAULT 0 NOT NULL,
	"budget_total" numeric(14, 2) DEFAULT 0 NOT NULL,
	"contract_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"vo_contract_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"reported_progress" numeric(7, 6) DEFAULT 0 NOT NULL,
	"certified_progress" numeric(7, 6) DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_cost_codes_project_code_key" UNIQUE("project_id","code"),
	CONSTRAINT "project_cost_codes_source_check" CHECK ("project_cost_codes"."source" in ('baseline', 'variation', 'manual')),
	CONSTRAINT "project_cost_codes_status_check" CHECK ("project_cost_codes"."status" in ('active', 'omitted'))
);
--> statement-breakpoint
ALTER TABLE "project_baselines" ADD CONSTRAINT "project_baselines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_baselines" ADD CONSTRAINT "project_baselines_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_baselines" ADD CONSTRAINT "project_baselines_version_fk" FOREIGN KEY ("version_id") REFERENCES "public"."boq_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost_codes" ADD CONSTRAINT "project_cost_codes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost_codes" ADD CONSTRAINT "project_cost_codes_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_baselines_active_key" ON "project_baselines" USING btree ("project_id") WHERE "project_baselines"."status" = 'active';--> statement-breakpoint
CREATE INDEX "project_baselines_workspace_project_idx" ON "project_baselines" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "project_cost_codes_workspace_project_idx" ON "project_cost_codes" USING btree ("workspace_id","project_id");