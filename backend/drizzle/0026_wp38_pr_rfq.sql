CREATE TABLE "pc_request_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"cost_code_id" uuid,
	"desc_th" text DEFAULT '' NOT NULL,
	"desc_en" text DEFAULT '' NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"qty" numeric(16, 4) NOT NULL,
	"est_unit_price" numeric(16, 4) DEFAULT 0 NOT NULL,
	"est_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"ordered_qty" numeric(16, 4) DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pc_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"number" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"source" text DEFAULT 'site' NOT NULL,
	"required_date" date,
	"requested_by" uuid NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"est_total" numeric(14, 2) DEFAULT 0 NOT NULL,
	"budget_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"override_reason" text DEFAULT '' NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pc_requests_workspace_number_key" UNIQUE("workspace_id","number"),
	CONSTRAINT "pc_requests_status_check" CHECK ("pc_requests"."status" in ('draft', 'pending_approval', 'approved', 'rejected', 'partially_ordered', 'ordered', 'closed', 'cancelled')),
	CONSTRAINT "pc_requests_source_check" CHECK ("pc_requests"."source" in ('site', 'boq'))
);
--> statement-breakpoint
CREATE TABLE "pc_rfq_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"rfq_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_line_id" uuid,
	"cost_code_id" uuid,
	"desc_th" text DEFAULT '' NOT NULL,
	"desc_en" text DEFAULT '' NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"qty" numeric(16, 4) NOT NULL,
	"budget_unit_price" numeric(16, 4) DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pc_rfq_quotes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"rfq_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"quote_ref" text DEFAULT '' NOT NULL,
	"quote_date" date,
	"valid_until" date,
	"prices_include_vat" boolean DEFAULT false NOT NULL,
	"delivery_days" integer,
	"payment_term_days" integer,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT 0 NOT NULL,
	"vat" numeric(14, 2) DEFAULT 0 NOT NULL,
	"total" numeric(14, 2) DEFAULT 0 NOT NULL,
	"file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pc_rfq_quotes_rfq_supplier_key" UNIQUE("rfq_id","supplier_id")
);
--> statement-breakpoint
CREATE TABLE "pc_rfq_suppliers" (
	"rfq_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quoted_at" timestamp with time zone,
	CONSTRAINT "pc_rfq_suppliers_pkey" PRIMARY KEY("rfq_id","supplier_id"),
	CONSTRAINT "pc_rfq_suppliers_status_check" CHECK ("pc_rfq_suppliers"."status" in ('invited', 'quoted', 'declined'))
);
--> statement-breakpoint
CREATE TABLE "pc_rfqs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"number" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"due_date" date,
	"delivery_address" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"request_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"awarded_supplier_id" uuid,
	"awarded_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pc_rfqs_workspace_number_key" UNIQUE("workspace_id","number"),
	CONSTRAINT "pc_rfqs_status_check" CHECK ("pc_rfqs"."status" in ('draft', 'sent', 'awarded', 'closed', 'cancelled')),
	CONSTRAINT "pc_rfqs_language_check" CHECK ("pc_rfqs"."language" in ('th', 'en'))
);
--> statement-breakpoint
ALTER TABLE "pc_request_lines" ADD CONSTRAINT "pc_request_lines_request_id_pc_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."pc_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_request_lines" ADD CONSTRAINT "pc_request_lines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_requests" ADD CONSTRAINT "pc_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_requests" ADD CONSTRAINT "pc_requests_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_rfq_lines" ADD CONSTRAINT "pc_rfq_lines_rfq_id_pc_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."pc_rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_rfq_lines" ADD CONSTRAINT "pc_rfq_lines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_rfq_lines" ADD CONSTRAINT "pc_rfq_lines_request_line_id_pc_request_lines_id_fk" FOREIGN KEY ("request_line_id") REFERENCES "public"."pc_request_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_rfq_quotes" ADD CONSTRAINT "pc_rfq_quotes_rfq_id_pc_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."pc_rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_rfq_quotes" ADD CONSTRAINT "pc_rfq_quotes_supplier_id_sup_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."sup_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_rfq_quotes" ADD CONSTRAINT "pc_rfq_quotes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_rfq_suppliers" ADD CONSTRAINT "pc_rfq_suppliers_rfq_id_pc_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."pc_rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_rfq_suppliers" ADD CONSTRAINT "pc_rfq_suppliers_supplier_id_sup_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."sup_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_rfq_suppliers" ADD CONSTRAINT "pc_rfq_suppliers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_rfqs" ADD CONSTRAINT "pc_rfqs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_rfqs" ADD CONSTRAINT "pc_rfqs_awarded_supplier_id_sup_suppliers_id_fk" FOREIGN KEY ("awarded_supplier_id") REFERENCES "public"."sup_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_rfqs" ADD CONSTRAINT "pc_rfqs_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pc_request_lines_request_idx" ON "pc_request_lines" USING btree ("request_id","sort");--> statement-breakpoint
CREATE INDEX "pc_request_lines_cost_code_idx" ON "pc_request_lines" USING btree ("workspace_id","cost_code_id");--> statement-breakpoint
CREATE INDEX "pc_requests_workspace_project_idx" ON "pc_requests" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "pc_rfq_lines_rfq_idx" ON "pc_rfq_lines" USING btree ("rfq_id","sort");--> statement-breakpoint
CREATE INDEX "pc_rfqs_workspace_project_idx" ON "pc_rfqs" USING btree ("workspace_id","project_id");