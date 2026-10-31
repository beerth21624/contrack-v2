CREATE TABLE "mc_contracts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"quotation_id" uuid,
	"quotation_version_id" uuid,
	"quoted_margin_pct" numeric(7, 6),
	"number" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"sign_date" date,
	"start_date" date,
	"finish_date" date,
	"duration_days" integer,
	"billing_mode" text DEFAULT 'milestone' NOT NULL,
	"original_value" numeric(14, 2) NOT NULL,
	"current_value" numeric(14, 2) NOT NULL,
	"vat_rate" numeric(7, 6) NOT NULL,
	"extension_days" integer DEFAULT 0 NOT NULL,
	"terms" jsonb NOT NULL,
	"body_th" text DEFAULT '' NOT NULL,
	"body_en" text DEFAULT '' NOT NULL,
	"customer_snapshot" jsonb,
	"company_snapshot" jsonb,
	"signed_scan_file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_at" date,
	"closed_at" date,
	"terminated_at" date,
	"termination_reason" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mc_contracts_workspace_number_key" UNIQUE("workspace_id","number"),
	CONSTRAINT "mc_contracts_status_check" CHECK ("mc_contracts"."status" in ('draft', 'signed', 'completed', 'closed', 'cancelled', 'terminated')),
	CONSTRAINT "mc_contracts_billing_mode_check" CHECK ("mc_contracts"."billing_mode" in ('milestone', 'progress')),
	CONSTRAINT "mc_contracts_language_check" CHECK ("mc_contracts"."language" in ('th', 'en'))
);
--> statement-breakpoint
CREATE TABLE "mc_guarantees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contract_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"form" text NOT NULL,
	"issuer" text DEFAULT '' NOT NULL,
	"ref_no" text DEFAULT '' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"issue_date" date,
	"expiry_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"returned_at" date,
	"file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mc_guarantees_kind_check" CHECK ("mc_guarantees"."kind" in ('performance', 'advance_payment', 'warranty')),
	CONSTRAINT "mc_guarantees_form_check" CHECK ("mc_guarantees"."form" in ('bank_guarantee', 'cash', 'cheque', 'bond')),
	CONSTRAINT "mc_guarantees_status_check" CHECK ("mc_guarantees"."status" in ('active', 'returned', 'claimed', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "mc_milestones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contract_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"no" integer NOT NULL,
	"label_th" text DEFAULT '' NOT NULL,
	"label_en" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"pct" numeric(7, 6) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"trigger" text NOT NULL,
	"trigger_progress" numeric(7, 6),
	"due_date" date,
	"cost_code_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"source" text DEFAULT 'contract' NOT NULL,
	"variation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mc_milestones_contract_no_key" UNIQUE("contract_id","no"),
	CONSTRAINT "mc_milestones_kind_check" CHECK ("mc_milestones"."kind" in ('advance', 'work', 'final')),
	CONSTRAINT "mc_milestones_trigger_check" CHECK ("mc_milestones"."trigger" in ('signing', 'progress', 'date', 'handover', 'manual')),
	CONSTRAINT "mc_milestones_status_check" CHECK ("mc_milestones"."status" in ('planned', 'claimable', 'claimed', 'invoiced', 'paid')),
	CONSTRAINT "mc_milestones_source_check" CHECK ("mc_milestones"."source" in ('contract', 'variation'))
);
--> statement-breakpoint
ALTER TABLE "mc_contracts" ADD CONSTRAINT "mc_contracts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mc_contracts" ADD CONSTRAINT "mc_contracts_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mc_guarantees" ADD CONSTRAINT "mc_guarantees_contract_id_mc_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."mc_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mc_guarantees" ADD CONSTRAINT "mc_guarantees_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mc_guarantees" ADD CONSTRAINT "mc_guarantees_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mc_milestones" ADD CONSTRAINT "mc_milestones_contract_id_mc_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."mc_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mc_milestones" ADD CONSTRAINT "mc_milestones_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mc_milestones" ADD CONSTRAINT "mc_milestones_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mc_contracts_one_effective_idx" ON "mc_contracts" USING btree ("project_id") WHERE "mc_contracts"."status" not in ('cancelled', 'terminated');--> statement-breakpoint
CREATE INDEX "mc_contracts_workspace_project_idx" ON "mc_contracts" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "mc_guarantees_contract_idx" ON "mc_guarantees" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "mc_guarantees_status_expiry_idx" ON "mc_guarantees" USING btree ("status","expiry_date");--> statement-breakpoint
CREATE INDEX "mc_milestones_workspace_project_idx" ON "mc_milestones" USING btree ("workspace_id","project_id");