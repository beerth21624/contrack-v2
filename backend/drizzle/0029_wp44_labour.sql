CREATE TABLE "lb_advance_recoveries" (
	"advance_id" uuid NOT NULL,
	"pay_line_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	CONSTRAINT "lb_advance_recoveries_advance_id_pay_line_id_pk" PRIMARY KEY("advance_id","pay_line_id"),
	CONSTRAINT "lb_advance_recoveries_amount_check" CHECK ("lb_advance_recoveries"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "lb_advances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"advance_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"recovered_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_by" uuid,
	"payment_method" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lb_advances_status_check" CHECK ("lb_advances"."status" in ('open', 'partially_recovered', 'recovered', 'written_off')),
	CONSTRAINT "lb_advances_amount_check" CHECK ("lb_advances"."amount" > 0 and "lb_advances"."recovered_amount" >= 0 and "lb_advances"."recovered_amount" <= "lb_advances"."amount"),
	CONSTRAINT "lb_advances_payment_method_check" CHECK ("lb_advances"."payment_method" is null or "lb_advances"."payment_method" in ('cash', 'transfer'))
);
--> statement-breakpoint
CREATE TABLE "lb_pay_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"person_name" text DEFAULT '' NOT NULL,
	"days" numeric(5, 2) DEFAULT 0 NOT NULL,
	"ot_hours" numeric(6, 1) DEFAULT 0 NOT NULL,
	"gross" numeric(14, 2) DEFAULT 0 NOT NULL,
	"advance_deduction" numeric(14, 2) DEFAULT 0 NOT NULL,
	"other_deduction" numeric(14, 2) DEFAULT 0 NOT NULL,
	"net" numeric(14, 2) DEFAULT 0 NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	CONSTRAINT "lb_pay_lines_period_person_key" UNIQUE("period_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "lb_pay_periods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"gross" numeric(14, 2) DEFAULT 0 NOT NULL,
	"advance_deduction" numeric(14, 2) DEFAULT 0 NOT NULL,
	"net" numeric(14, 2) DEFAULT 0 NOT NULL,
	"built_at" timestamp with time zone,
	"built_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"paid_date" date,
	"paid_at" timestamp with time zone,
	"paid_by" uuid,
	"payment_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lb_pay_periods_key" UNIQUE("workspace_id","period_key"),
	CONSTRAINT "lb_pay_periods_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "lb_pay_periods_status_check" CHECK ("lb_pay_periods"."status" in ('open', 'pending_approval', 'approved', 'paid')),
	CONSTRAINT "lb_pay_periods_key_check" CHECK ("lb_pay_periods"."period_key" ~ '^[0-9]{4}-(0[1-9]|1[0-2])-[AB]$'),
	CONSTRAINT "lb_pay_periods_payment_method_check" CHECK ("lb_pay_periods"."payment_method" is null or "lb_pay_periods"."payment_method" in ('cash', 'transfer'))
);
--> statement-breakpoint
CREATE TABLE "lb_timesheet_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"crew_id" uuid,
	"cost_code_id" uuid,
	"days" numeric(3, 2) NOT NULL,
	"ot_hours" numeric(4, 1) DEFAULT 0 NOT NULL,
	"daily_wage" numeric(14, 2) NOT NULL,
	"ot_rate" numeric(14, 2) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approval_batch_id" uuid,
	"pay_period_id" uuid,
	"source" text DEFAULT 'manual' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"recorded_by" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lb_timesheet_entries_person_date_project_key" UNIQUE("person_id","work_date","project_id"),
	CONSTRAINT "lb_timesheet_entries_days_check" CHECK ("lb_timesheet_entries"."days" in (0.5, 1)),
	CONSTRAINT "lb_timesheet_entries_ot_hours_check" CHECK ("lb_timesheet_entries"."ot_hours" between 0 and 24),
	CONSTRAINT "lb_timesheet_entries_status_check" CHECK ("lb_timesheet_entries"."status" in ('draft', 'approved', 'paid')),
	CONSTRAINT "lb_timesheet_entries_source_check" CHECK ("lb_timesheet_entries"."source" in ('manual', 'site_diary'))
);
--> statement-breakpoint
ALTER TABLE "lb_advance_recoveries" ADD CONSTRAINT "lb_advance_recoveries_advance_id_lb_advances_id_fk" FOREIGN KEY ("advance_id") REFERENCES "public"."lb_advances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lb_advance_recoveries" ADD CONSTRAINT "lb_advance_recoveries_pay_line_id_lb_pay_lines_id_fk" FOREIGN KEY ("pay_line_id") REFERENCES "public"."lb_pay_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lb_advance_recoveries" ADD CONSTRAINT "lb_advance_recoveries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lb_advances" ADD CONSTRAINT "lb_advances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lb_advances" ADD CONSTRAINT "lb_advances_person_tenant_fk" FOREIGN KEY ("person_id","workspace_id") REFERENCES "public"."people"("id","workspace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lb_pay_lines" ADD CONSTRAINT "lb_pay_lines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lb_pay_lines" ADD CONSTRAINT "lb_pay_lines_period_id_lb_pay_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."lb_pay_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lb_pay_periods" ADD CONSTRAINT "lb_pay_periods_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lb_timesheet_entries" ADD CONSTRAINT "lb_timesheet_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lb_timesheet_entries" ADD CONSTRAINT "lb_timesheet_entries_pay_period_id_lb_pay_periods_id_fk" FOREIGN KEY ("pay_period_id") REFERENCES "public"."lb_pay_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lb_timesheet_entries" ADD CONSTRAINT "lb_timesheet_entries_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lb_timesheet_entries" ADD CONSTRAINT "lb_timesheet_entries_person_tenant_fk" FOREIGN KEY ("person_id","workspace_id") REFERENCES "public"."people"("id","workspace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lb_advance_recoveries_line_idx" ON "lb_advance_recoveries" USING btree ("pay_line_id");--> statement-breakpoint
CREATE INDEX "lb_advances_workspace_person_idx" ON "lb_advances" USING btree ("workspace_id","person_id","advance_date");--> statement-breakpoint
CREATE INDEX "lb_pay_lines_workspace_person_idx" ON "lb_pay_lines" USING btree ("workspace_id","person_id");--> statement-breakpoint
CREATE INDEX "lb_timesheet_entries_project_date_idx" ON "lb_timesheet_entries" USING btree ("workspace_id","project_id","work_date");--> statement-breakpoint
CREATE INDEX "lb_timesheet_entries_person_date_idx" ON "lb_timesheet_entries" USING btree ("workspace_id","person_id","work_date");--> statement-breakpoint
CREATE INDEX "lb_timesheet_entries_workspace_date_idx" ON "lb_timesheet_entries" USING btree ("workspace_id","work_date","status");--> statement-breakpoint
CREATE INDEX "lb_timesheet_entries_period_idx" ON "lb_timesheet_entries" USING btree ("pay_period_id");--> statement-breakpoint
CREATE INDEX "lb_timesheet_entries_batch_idx" ON "lb_timesheet_entries" USING btree ("approval_batch_id");