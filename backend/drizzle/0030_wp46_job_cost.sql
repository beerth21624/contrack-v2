CREATE TABLE "jc_alerts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"cost_code_id" uuid,
	"scope_key" text NOT NULL,
	"kind" text NOT NULL,
	"level" text NOT NULL,
	"value" numeric(20, 6) NOT NULL,
	"threshold" numeric(20, 6) NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	CONSTRAINT "jc_alerts_kind_check" CHECK ("jc_alerts"."kind" in ('cost_overrun', 'commitment_over_budget', 'negative_cash', 'margin_drop')),
	CONSTRAINT "jc_alerts_level_check" CHECK ("jc_alerts"."level" in ('warning', 'critical'))
);
--> statement-breakpoint
CREATE TABLE "jc_cash_settings" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"opening_balance" numeric(14, 2) DEFAULT 0 NOT NULL,
	"as_of" date NOT NULL,
	"min_balance" numeric(14, 2) DEFAULT 0 NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jc_forecasts" (
	"project_id" uuid NOT NULL,
	"cost_code_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"method" text DEFAULT 'auto' NOT NULL,
	"eac" numeric(14, 2) DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jc_forecasts_pkey" PRIMARY KEY("project_id","cost_code_id"),
	CONSTRAINT "jc_forecasts_method_check" CHECK ("jc_forecasts"."method" in ('auto', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "jc_unit_rates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"line_key" text NOT NULL,
	"desc_th" text DEFAULT '' NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"qty" numeric(16, 4) DEFAULT 0 NOT NULL,
	"actual_mat_unit" numeric(16, 4) DEFAULT 0 NOT NULL,
	"actual_lab_unit" numeric(16, 4) DEFAULT 0 NOT NULL,
	"observed_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jc_alerts" ADD CONSTRAINT "jc_alerts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jc_alerts" ADD CONSTRAINT "jc_alerts_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jc_cash_settings" ADD CONSTRAINT "jc_cash_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jc_forecasts" ADD CONSTRAINT "jc_forecasts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jc_forecasts" ADD CONSTRAINT "jc_forecasts_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jc_unit_rates" ADD CONSTRAINT "jc_unit_rates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jc_unit_rates" ADD CONSTRAINT "jc_unit_rates_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jc_alerts_open_key" ON "jc_alerts" USING btree ("project_id","scope_key","kind") WHERE "jc_alerts"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "jc_alerts_workspace_project_idx" ON "jc_alerts" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "jc_forecasts_workspace_project_idx" ON "jc_forecasts" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "jc_unit_rates_workspace_line_key_observed_date_idx" ON "jc_unit_rates" USING btree ("workspace_id","line_key","observed_date");