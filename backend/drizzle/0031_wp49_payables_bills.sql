CREATE TABLE "ap_bill_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"bill_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"order_line_id" uuid,
	"cost_code_id" uuid,
	"category" text DEFAULT 'material' NOT NULL,
	"desc" text DEFAULT '' NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"qty" numeric(16, 4) NOT NULL,
	"unit_price" numeric(16, 4) DEFAULT 0 NOT NULL,
	"amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"match" text DEFAULT 'no_po' NOT NULL,
	"billed_qty" numeric(16, 4) DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ap_bill_lines_category_check" CHECK ("ap_bill_lines"."category" in ('material', 'labour', 'subcontract', 'equipment', 'other')),
	CONSTRAINT "ap_bill_lines_match_check" CHECK ("ap_bill_lines"."match" in ('matched', 'qty_exceeds_received', 'price_differs', 'no_po'))
);
--> statement-breakpoint
CREATE TABLE "ap_bills" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"supplier_id" uuid,
	"pay_period_id" uuid,
	"kind" text NOT NULL,
	"number" text,
	"bill_date" date NOT NULL,
	"supplier_invoice_no" text DEFAULT '' NOT NULL,
	"supplier_invoice_date" date,
	"tax_invoice_no" text DEFAULT '' NOT NULL,
	"tax_invoice_date" date,
	"input_vat_claimable" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"due_date" date NOT NULL,
	"order_id" uuid,
	"sc_claim_id" uuid,
	"vat_rate" numeric(7, 6) DEFAULT 0 NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT 0 NOT NULL,
	"discount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"vat" numeric(14, 2) DEFAULT 0 NOT NULL,
	"total" numeric(14, 2) DEFAULT 0 NOT NULL,
	"wht_preset" text DEFAULT 'none' NOT NULL,
	"wht_rate" numeric(7, 6) DEFAULT 0 NOT NULL,
	"wht_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"retention_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"payable" numeric(14, 2) DEFAULT 0 NOT NULL,
	"paid_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"match_status" text DEFAULT 'not_applicable' NOT NULL,
	"file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"void_reason" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ap_bills_kind_check" CHECK ("ap_bills"."kind" in ('material', 'subcontract', 'service', 'labour', 'expense')),
	CONSTRAINT "ap_bills_status_check" CHECK ("ap_bills"."status" in ('draft', 'pending_approval', 'approved', 'scheduled', 'paid', 'voided')),
	CONSTRAINT "ap_bills_match_status_check" CHECK ("ap_bills"."match_status" in ('not_applicable', 'matched', 'exceptions')),
	CONSTRAINT "ap_bills_wht_preset_check" CHECK ("ap_bills"."wht_preset" in ('none', 'government', 'transport', 'advertising', 'service', 'rent')),
	CONSTRAINT "ap_bills_supplier_check" CHECK ("ap_bills"."supplier_id" is not null or "ap_bills"."kind" = 'labour'),
	CONSTRAINT "ap_bills_discount_check" CHECK ("ap_bills"."discount" >= 0 and "ap_bills"."discount" <= "ap_bills"."subtotal")
);
--> statement-breakpoint
ALTER TABLE "ap_bill_lines" ADD CONSTRAINT "ap_bill_lines_bill_id_ap_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."ap_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ap_bill_lines" ADD CONSTRAINT "ap_bill_lines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ap_bills" ADD CONSTRAINT "ap_bills_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ap_bills" ADD CONSTRAINT "ap_bills_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ap_bill_lines_bill_idx" ON "ap_bill_lines" USING btree ("bill_id","sort");--> statement-breakpoint
CREATE UNIQUE INDEX "ap_bills_workspace_number_key" ON "ap_bills" USING btree ("workspace_id","number") WHERE "ap_bills"."number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ap_bills_supplier_invoice_key" ON "ap_bills" USING btree ("workspace_id","supplier_id","supplier_invoice_no") WHERE "ap_bills"."supplier_invoice_no" <> '' and "ap_bills"."status" <> 'voided';--> statement-breakpoint
CREATE UNIQUE INDEX "ap_bills_pay_period_key" ON "ap_bills" USING btree ("pay_period_id") WHERE "ap_bills"."pay_period_id" is not null and "ap_bills"."status" <> 'voided';--> statement-breakpoint
CREATE UNIQUE INDEX "ap_bills_sc_claim_key" ON "ap_bills" USING btree ("sc_claim_id") WHERE "ap_bills"."sc_claim_id" is not null and "ap_bills"."status" <> 'voided';--> statement-breakpoint
CREATE INDEX "ap_bills_workspace_status_idx" ON "ap_bills" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "ap_bills_workspace_project_idx" ON "ap_bills" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "ap_bills_order_idx" ON "ap_bills" USING btree ("workspace_id","order_id");--> statement-breakpoint
CREATE INDEX "ap_bills_due_idx" ON "ap_bills" USING btree ("status","due_date");