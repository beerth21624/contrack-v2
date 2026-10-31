CREATE TABLE "cost_ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"cost_code_id" uuid,
	"entry_date" date NOT NULL,
	"kind" text NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"qty" numeric(16, 4),
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"source_line_id" uuid,
	"commitment_ref" uuid,
	"reverses_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_ledger_entries_kind_check" CHECK ("cost_ledger_entries"."kind" in ('commit', 'commit_release', 'actual')),
	CONSTRAINT "cost_ledger_entries_category_check" CHECK ("cost_ledger_entries"."category" in ('material', 'labour', 'subcontract', 'equipment', 'other'))
);
--> statement-breakpoint
CREATE TABLE "fin_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"event_date" date NOT NULL,
	"event_type" text NOT NULL,
	"direction" text NOT NULL,
	"counterparty_type" text NOT NULL,
	"counterparty_id" uuid,
	"counterparty_name" text NOT NULL,
	"counterparty_tax_id" text DEFAULT '' NOT NULL,
	"counterparty_branch" text DEFAULT '' NOT NULL,
	"doc_type" text,
	"doc_number" text,
	"doc_date" date,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"net" numeric(14, 2) NOT NULL,
	"vat" numeric(14, 2) NOT NULL,
	"wht" numeric(14, 2) NOT NULL,
	"retention" numeric(14, 2) NOT NULL,
	"cash" numeric(14, 2) NOT NULL,
	"reverses_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fin_events_event_type_check" CHECK ("fin_events"."event_type" in ('ar.advance_invoiced', 'ar.invoiced', 'ar.tax_invoiced', 'ar.credit_noted', 'ar.receipt', 'ar.wht_withheld_by_customer', 'ar.retention_withheld', 'ar.retention_released', 'ar.advance_recovered', 'ar.penalty', 'ap.bill_posted', 'ap.payment', 'ap.wht_withheld', 'ap.retention_withheld', 'ap.retention_released', 'lb.wages_paid', 'lb.advance_paid', 'lb.advance_recovered', 'sc.claim_paid')),
	CONSTRAINT "fin_events_direction_check" CHECK ("fin_events"."direction" in ('in', 'out', 'none')),
	CONSTRAINT "fin_events_counterparty_type_check" CHECK ("fin_events"."counterparty_type" in ('customer', 'supplier', 'subcontractor', 'worker', 'government', 'other'))
);
--> statement-breakpoint
ALTER TABLE "cost_ledger_entries" ADD CONSTRAINT "cost_ledger_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_ledger_entries" ADD CONSTRAINT "cost_ledger_entries_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_events" ADD CONSTRAINT "fin_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cost_ledger_entries_workspace_project_cost_code_idx" ON "cost_ledger_entries" USING btree ("workspace_id","project_id","cost_code_id");--> statement-breakpoint
CREATE INDEX "cost_ledger_entries_workspace_source_idx" ON "cost_ledger_entries" USING btree ("workspace_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "cost_ledger_entries_workspace_commitment_ref_idx" ON "cost_ledger_entries" USING btree ("workspace_id","commitment_ref") WHERE "cost_ledger_entries"."commitment_ref" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "cost_ledger_entries_reverses_id_key" ON "cost_ledger_entries" USING btree ("reverses_id") WHERE "cost_ledger_entries"."reverses_id" is not null;--> statement-breakpoint
CREATE INDEX "fin_events_workspace_date_idx" ON "fin_events" USING btree ("workspace_id","event_date");--> statement-breakpoint
CREATE INDEX "fin_events_workspace_project_date_idx" ON "fin_events" USING btree ("workspace_id","project_id","event_date");--> statement-breakpoint
CREATE INDEX "fin_events_workspace_type_date_idx" ON "fin_events" USING btree ("workspace_id","event_type","event_date");--> statement-breakpoint
CREATE INDEX "fin_events_workspace_source_idx" ON "fin_events" USING btree ("workspace_id","source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fin_events_reverses_id_key" ON "fin_events" USING btree ("reverses_id") WHERE "fin_events"."reverses_id" is not null;