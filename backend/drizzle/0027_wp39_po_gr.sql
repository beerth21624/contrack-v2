CREATE TABLE "pc_order_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"cost_code_id" uuid,
	"request_line_id" uuid,
	"desc_th" text DEFAULT '' NOT NULL,
	"desc_en" text DEFAULT '' NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"qty" numeric(16, 4) NOT NULL,
	"unit_price" numeric(16, 4) DEFAULT 0 NOT NULL,
	"amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"received_qty" numeric(16, 4) DEFAULT 0 NOT NULL,
	"billed_qty" numeric(16, 4) DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pc_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"rfq_id" uuid,
	"number" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"order_date" date,
	"delivery_date" date,
	"delivery_address" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"supplier_snapshot" jsonb,
	"vat_rate" numeric(7, 6) DEFAULT 0.07 NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT 0 NOT NULL,
	"discount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"vat" numeric(14, 2) DEFAULT 0 NOT NULL,
	"total" numeric(14, 2) DEFAULT 0 NOT NULL,
	"wht_preset" text DEFAULT 'none' NOT NULL,
	"payment_term_days" integer,
	"terms" text DEFAULT '' NOT NULL,
	"budget_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"override_reason" text DEFAULT '' NOT NULL,
	"issued_by" uuid,
	"issued_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pc_orders_workspace_number_key" UNIQUE("workspace_id","number"),
	CONSTRAINT "pc_orders_status_check" CHECK ("pc_orders"."status" in ('draft', 'pending_approval', 'issued', 'partially_received', 'received', 'closed', 'cancelled')),
	CONSTRAINT "pc_orders_language_check" CHECK ("pc_orders"."language" in ('th', 'en')),
	CONSTRAINT "pc_orders_discount_check" CHECK ("pc_orders"."discount" >= 0 and "pc_orders"."discount" <= "pc_orders"."subtotal")
);
--> statement-breakpoint
CREATE TABLE "pc_receipt_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"receipt_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"qty_received" numeric(16, 4) DEFAULT 0 NOT NULL,
	"qty_rejected" numeric(16, 4) DEFAULT 0 NOT NULL,
	"condition" text DEFAULT 'ok' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pc_receipt_lines_condition_check" CHECK ("pc_receipt_lines"."condition" in ('ok', 'damaged', 'short')),
	CONSTRAINT "pc_receipt_lines_qty_check" CHECK ("pc_receipt_lines"."qty_received" >= 0 and "pc_receipt_lines"."qty_rejected" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pc_receipts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"number" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"received_date" date NOT NULL,
	"received_by" uuid NOT NULL,
	"delivery_note_no" text DEFAULT '' NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pc_receipts_workspace_number_key" UNIQUE("workspace_id","number"),
	CONSTRAINT "pc_receipts_status_check" CHECK ("pc_receipts"."status" in ('draft', 'confirmed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "pc_order_lines" ADD CONSTRAINT "pc_order_lines_order_id_pc_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."pc_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_order_lines" ADD CONSTRAINT "pc_order_lines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_order_lines" ADD CONSTRAINT "pc_order_lines_request_line_id_pc_request_lines_id_fk" FOREIGN KEY ("request_line_id") REFERENCES "public"."pc_request_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_orders" ADD CONSTRAINT "pc_orders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_orders" ADD CONSTRAINT "pc_orders_supplier_id_sup_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."sup_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_orders" ADD CONSTRAINT "pc_orders_rfq_id_pc_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."pc_rfqs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_orders" ADD CONSTRAINT "pc_orders_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_receipt_lines" ADD CONSTRAINT "pc_receipt_lines_receipt_id_pc_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."pc_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_receipt_lines" ADD CONSTRAINT "pc_receipt_lines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_receipt_lines" ADD CONSTRAINT "pc_receipt_lines_order_line_id_pc_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."pc_order_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_receipts" ADD CONSTRAINT "pc_receipts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_receipts" ADD CONSTRAINT "pc_receipts_order_id_pc_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."pc_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_receipts" ADD CONSTRAINT "pc_receipts_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pc_order_lines_order_idx" ON "pc_order_lines" USING btree ("order_id","sort");--> statement-breakpoint
CREATE INDEX "pc_order_lines_cost_code_idx" ON "pc_order_lines" USING btree ("workspace_id","cost_code_id");--> statement-breakpoint
CREATE INDEX "pc_orders_workspace_project_idx" ON "pc_orders" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "pc_orders_workspace_status_idx" ON "pc_orders" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "pc_orders_supplier_idx" ON "pc_orders" USING btree ("workspace_id","supplier_id");--> statement-breakpoint
CREATE INDEX "pc_receipt_lines_receipt_idx" ON "pc_receipt_lines" USING btree ("receipt_id","sort");--> statement-breakpoint
CREATE INDEX "pc_receipts_order_idx" ON "pc_receipts" USING btree ("order_id","created_at");