CREATE TABLE "ar_advance_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"invoice_id" uuid,
	"claim_id" uuid,
	"entry_date" date NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ar_advance_entries_kind_check" CHECK ("ar_advance_entries"."kind" in ('received', 'recovered'))
);
--> statement-breakpoint
CREATE TABLE "ar_claim_lines" (
	"claim_id" uuid NOT NULL,
	"cost_code_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"contract_amount" numeric(14, 2) NOT NULL,
	"prev_progress" numeric(7, 6) DEFAULT 0 NOT NULL,
	"cum_progress" numeric(7, 6) DEFAULT 0 NOT NULL,
	"prev_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"cum_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"this_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	CONSTRAINT "ar_claim_lines_pkey" PRIMARY KEY("claim_id","cost_code_id")
);
--> statement-breakpoint
CREATE TABLE "ar_claims" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"milestone_id" uuid,
	"mode" text NOT NULL,
	"claim_no" integer NOT NULL,
	"period_from" date,
	"period_to" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"work_value" numeric(14, 2) DEFAULT 0 NOT NULL,
	"cumulative_value" numeric(14, 2) DEFAULT 0 NOT NULL,
	"previous_value" numeric(14, 2) DEFAULT 0 NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	"advance_recovery" numeric(14, 2) DEFAULT 0 NOT NULL,
	"retention" numeric(14, 2) DEFAULT 0 NOT NULL,
	"penalty" numeric(14, 2) DEFAULT 0 NOT NULL,
	"penalty_days" integer DEFAULT 0 NOT NULL,
	"penalty_override" numeric(14, 2),
	"penalty_max" numeric(14, 2) DEFAULT 0 NOT NULL,
	"escalation" numeric(14, 2) DEFAULT 0 NOT NULL,
	"escalation_k" numeric(16, 4),
	"escalation_indices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"other_deduction" numeric(14, 2) DEFAULT 0 NOT NULL,
	"other_deduction_note" text DEFAULT '' NOT NULL,
	"vat_base" numeric(14, 2) DEFAULT 0 NOT NULL,
	"vat" numeric(14, 2) DEFAULT 0 NOT NULL,
	"wht" numeric(14, 2) DEFAULT 0 NOT NULL,
	"payable" numeric(14, 2) DEFAULT 0 NOT NULL,
	"certified_by_name" text DEFAULT '' NOT NULL,
	"certified_at" date,
	"certified_note" text DEFAULT '' NOT NULL,
	"invoice_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ar_claims_contract_no_key" UNIQUE("contract_id","claim_no"),
	CONSTRAINT "ar_claims_status_check" CHECK ("ar_claims"."status" in ('draft', 'pending_approval', 'submitted', 'certified', 'invoiced', 'cancelled')),
	CONSTRAINT "ar_claims_mode_check" CHECK ("ar_claims"."mode" in ('milestone', 'progress'))
);
--> statement-breakpoint
CREATE TABLE "ar_invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"contract_id" uuid,
	"claim_id" uuid,
	"milestone_id" uuid,
	"customer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"number" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"customer_snapshot" jsonb,
	"company_snapshot" jsonb,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"net" numeric(14, 2) DEFAULT 0 NOT NULL,
	"vat" numeric(14, 2) DEFAULT 0 NOT NULL,
	"total" numeric(14, 2) DEFAULT 0 NOT NULL,
	"retention" numeric(14, 2) DEFAULT 0 NOT NULL,
	"advance_recovery" numeric(14, 2) DEFAULT 0 NOT NULL,
	"penalty" numeric(14, 2) DEFAULT 0 NOT NULL,
	"wht_expected" numeric(14, 2) DEFAULT 0 NOT NULL,
	"payable" numeric(14, 2) DEFAULT 0 NOT NULL,
	"paid_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"related_invoice_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"void_reason" text DEFAULT '' NOT NULL,
	"issued_by" uuid,
	"issued_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ar_invoices_workspace_number_key" UNIQUE("workspace_id","number"),
	CONSTRAINT "ar_invoices_kind_check" CHECK ("ar_invoices"."kind" in ('advance_invoice', 'invoice', 'tax_invoice', 'credit_note')),
	CONSTRAINT "ar_invoices_source_check" CHECK ("ar_invoices"."source" in ('claim', 'advance', 'retention_release', 'receipt')),
	CONSTRAINT "ar_invoices_status_check" CHECK ("ar_invoices"."status" in ('draft', 'issued', 'partially_paid', 'paid', 'voided')),
	CONSTRAINT "ar_invoices_language_check" CHECK ("ar_invoices"."language" in ('th', 'en'))
);
--> statement-breakpoint
CREATE TABLE "ar_retention_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"claim_id" uuid,
	"invoice_id" uuid,
	"entry_date" date NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ar_retention_entries_kind_check" CHECK ("ar_retention_entries"."kind" in ('withheld', 'released', 'forfeited'))
);
--> statement-breakpoint
ALTER TABLE "ar_advance_entries" ADD CONSTRAINT "ar_advance_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_advance_entries" ADD CONSTRAINT "ar_advance_entries_contract_id_mc_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."mc_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_advance_entries" ADD CONSTRAINT "ar_advance_entries_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_claim_lines" ADD CONSTRAINT "ar_claim_lines_claim_id_ar_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."ar_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_claim_lines" ADD CONSTRAINT "ar_claim_lines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_claims" ADD CONSTRAINT "ar_claims_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_claims" ADD CONSTRAINT "ar_claims_contract_id_mc_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."mc_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_claims" ADD CONSTRAINT "ar_claims_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_invoices" ADD CONSTRAINT "ar_invoices_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_invoices" ADD CONSTRAINT "ar_invoices_contract_id_mc_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."mc_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_invoices" ADD CONSTRAINT "ar_invoices_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_retention_entries" ADD CONSTRAINT "ar_retention_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_retention_entries" ADD CONSTRAINT "ar_retention_entries_contract_id_mc_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."mc_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_retention_entries" ADD CONSTRAINT "ar_retention_entries_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ar_advance_entries_contract_idx" ON "ar_advance_entries" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ar_claims_one_open_idx" ON "ar_claims" USING btree ("contract_id") WHERE "ar_claims"."status" in ('draft', 'pending_approval', 'submitted');--> statement-breakpoint
CREATE INDEX "ar_claims_workspace_project_idx" ON "ar_claims" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "ar_invoices_workspace_project_idx" ON "ar_invoices" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "ar_invoices_contract_idx" ON "ar_invoices" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "ar_invoices_workspace_status_due_idx" ON "ar_invoices" USING btree ("workspace_id","status","due_date");--> statement-breakpoint
CREATE INDEX "ar_retention_entries_contract_idx" ON "ar_retention_entries" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ar_retention_entries_claim_withheld_idx" ON "ar_retention_entries" USING btree ("claim_id") WHERE "ar_retention_entries"."kind" = 'withheld';