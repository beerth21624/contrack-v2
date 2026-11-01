CREATE TABLE "ap_payment_allocations" (
	"payment_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"settled" numeric(14, 2) DEFAULT 0 NOT NULL,
	"wht" numeric(14, 2) DEFAULT 0 NOT NULL,
	"cash" numeric(14, 2) DEFAULT 0 NOT NULL,
	CONSTRAINT "ap_payment_allocations_pkey" PRIMARY KEY("payment_id","bill_id")
);
--> statement-breakpoint
CREATE TABLE "ap_payment_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"number" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"bill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pay_date" date NOT NULL,
	"method" text DEFAULT 'transfer' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"total_cash" numeric(14, 2) DEFAULT 0 NOT NULL,
	"total_wht" numeric(14, 2) DEFAULT 0 NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"paid_by" uuid,
	"cancelled_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ap_payment_runs_status_check" CHECK ("ap_payment_runs"."status" in ('draft', 'pending_approval', 'approved', 'paid', 'cancelled')),
	CONSTRAINT "ap_payment_runs_method_check" CHECK ("ap_payment_runs"."method" in ('transfer', 'cheque', 'cash'))
);
--> statement-breakpoint
CREATE TABLE "ap_payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"run_id" uuid,
	"supplier_id" uuid,
	"payee_name" text DEFAULT '' NOT NULL,
	"number" text NOT NULL,
	"pay_date" date NOT NULL,
	"method" text NOT NULL,
	"bank_ref" text DEFAULT '' NOT NULL,
	"cash_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"wht_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"wht_certificate_id" uuid,
	"status" text DEFAULT 'issued' NOT NULL,
	"file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ap_payments_status_check" CHECK ("ap_payments"."status" in ('issued', 'voided')),
	CONSTRAINT "ap_payments_method_check" CHECK ("ap_payments"."method" in ('transfer', 'cheque', 'cash'))
);
--> statement-breakpoint
CREATE TABLE "ap_wht_certificates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"number" text NOT NULL,
	"book_no" text DEFAULT '' NOT NULL,
	"payment_id" uuid NOT NULL,
	"payee_snapshot" jsonb NOT NULL,
	"payer_snapshot" jsonb NOT NULL,
	"form" text NOT NULL,
	"income_type" text NOT NULL,
	"income_desc" text DEFAULT '' NOT NULL,
	"pay_date" date NOT NULL,
	"base_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"wht_rate" numeric(7, 6) DEFAULT 0 NOT NULL,
	"wht_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"condition" text DEFAULT 'withheld' NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "ap_wht_certificates_form_check" CHECK ("ap_wht_certificates"."form" in ('pnd3', 'pnd53')),
	CONSTRAINT "ap_wht_certificates_income_type_check" CHECK ("ap_wht_certificates"."income_type" in ('service', 'transport', 'advertising', 'rent', 'other')),
	CONSTRAINT "ap_wht_certificates_condition_check" CHECK ("ap_wht_certificates"."condition" in ('withheld', 'paid_always', 'paid_once')),
	CONSTRAINT "ap_wht_certificates_status_check" CHECK ("ap_wht_certificates"."status" in ('issued', 'voided'))
);
--> statement-breakpoint
ALTER TABLE "ap_payment_allocations" ADD CONSTRAINT "ap_payment_allocations_payment_id_ap_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."ap_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ap_payment_allocations" ADD CONSTRAINT "ap_payment_allocations_bill_id_ap_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."ap_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ap_payment_allocations" ADD CONSTRAINT "ap_payment_allocations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ap_payment_runs" ADD CONSTRAINT "ap_payment_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ap_payments" ADD CONSTRAINT "ap_payments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ap_payments" ADD CONSTRAINT "ap_payments_run_id_ap_payment_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ap_payment_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ap_wht_certificates" ADD CONSTRAINT "ap_wht_certificates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ap_wht_certificates" ADD CONSTRAINT "ap_wht_certificates_payment_id_ap_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."ap_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ap_payment_allocations_bill_idx" ON "ap_payment_allocations" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "ap_payment_runs_workspace_status_idx" ON "ap_payment_runs" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ap_payments_workspace_number_key" ON "ap_payments" USING btree ("workspace_id","number");--> statement-breakpoint
CREATE INDEX "ap_payments_run_idx" ON "ap_payments" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ap_payments_workspace_supplier_idx" ON "ap_payments" USING btree ("workspace_id","supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ap_wht_certificates_workspace_number_key" ON "ap_wht_certificates" USING btree ("workspace_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "ap_wht_certificates_payment_key" ON "ap_wht_certificates" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "ap_wht_certificates_workspace_date_idx" ON "ap_wht_certificates" USING btree ("workspace_id","pay_date");