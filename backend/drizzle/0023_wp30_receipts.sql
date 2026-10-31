CREATE TABLE "ar_receipt_allocations" (
	"receipt_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"cash" numeric(14, 2) DEFAULT 0 NOT NULL,
	"wht" numeric(14, 2) DEFAULT 0 NOT NULL,
	"settled" numeric(14, 2) NOT NULL,
	"tax_invoice_id" uuid,
	CONSTRAINT "ar_receipt_allocations_pkey" PRIMARY KEY("receipt_id","invoice_id")
);
--> statement-breakpoint
CREATE TABLE "ar_receipts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"project_id" uuid,
	"number" text NOT NULL,
	"receipt_date" date NOT NULL,
	"method" text NOT NULL,
	"bank_ref" text DEFAULT '' NOT NULL,
	"cash_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"wht_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"wht_certificate_no" text DEFAULT '' NOT NULL,
	"wht_certificate_file_id" uuid,
	"tax_invoice_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"customer_snapshot" jsonb,
	"company_snapshot" jsonb,
	"note" text DEFAULT '' NOT NULL,
	"void_reason" text DEFAULT '' NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ar_receipts_workspace_number_key" UNIQUE("workspace_id","number"),
	CONSTRAINT "ar_receipts_method_check" CHECK ("ar_receipts"."method" in ('transfer', 'cash', 'cheque', 'promptpay', 'other')),
	CONSTRAINT "ar_receipts_status_check" CHECK ("ar_receipts"."status" in ('issued', 'voided')),
	CONSTRAINT "ar_receipts_language_check" CHECK ("ar_receipts"."language" in ('th', 'en'))
);
--> statement-breakpoint
ALTER TABLE "ar_advance_entries" ADD COLUMN "receipt_id" uuid;--> statement-breakpoint
ALTER TABLE "ar_receipt_allocations" ADD CONSTRAINT "ar_receipt_allocations_receipt_id_ar_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."ar_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_receipt_allocations" ADD CONSTRAINT "ar_receipt_allocations_invoice_id_ar_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."ar_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_receipt_allocations" ADD CONSTRAINT "ar_receipt_allocations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_receipts" ADD CONSTRAINT "ar_receipts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_receipts" ADD CONSTRAINT "ar_receipts_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ar_receipt_allocations_invoice_idx" ON "ar_receipt_allocations" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "ar_receipts_workspace_customer_idx" ON "ar_receipts" USING btree ("workspace_id","customer_id");