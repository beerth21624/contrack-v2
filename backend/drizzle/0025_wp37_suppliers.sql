CREATE TABLE "sup_ratings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"supplier_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	"score" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sup_ratings_score_check" CHECK ("sup_ratings"."score" between 1 and 5),
	CONSTRAINT "sup_ratings_source_type_check" CHECK ("sup_ratings"."source_type" in ('manual', 'purchase_order', 'goods_receipt', 'subcontract'))
);
--> statement-breakpoint
CREATE TABLE "sup_suppliers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text DEFAULT 'material' NOT NULL,
	"name_th" text DEFAULT '' NOT NULL,
	"name_en" text DEFAULT '' NOT NULL,
	"tax_id" text DEFAULT '' NOT NULL,
	"branch_code" text DEFAULT '' NOT NULL,
	"is_juristic" boolean DEFAULT true NOT NULL,
	"vat_registered" boolean DEFAULT true NOT NULL,
	"address_th" text DEFAULT '' NOT NULL,
	"address_en" text DEFAULT '' NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"line_id" text DEFAULT '' NOT NULL,
	"credit_term_days" integer DEFAULT 30 NOT NULL,
	"default_wht_preset" text DEFAULT 'none' NOT NULL,
	"bank_accounts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"trades" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sc_vendor_list_entry_id" uuid,
	"vendor_workspace_id" uuid,
	"rating" numeric(3, 2),
	"rating_count" integer DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sup_suppliers_kind_check" CHECK ("sup_suppliers"."kind" in ('material', 'subcontractor', 'service', 'equipment_rental', 'other')),
	CONSTRAINT "sup_suppliers_wht_preset_check" CHECK ("sup_suppliers"."default_wht_preset" in ('none', 'government', 'transport', 'advertising', 'service', 'rent')),
	CONSTRAINT "sup_suppliers_name_check" CHECK ("sup_suppliers"."name_th" <> '' or "sup_suppliers"."name_en" <> '')
);
--> statement-breakpoint
ALTER TABLE "sup_ratings" ADD CONSTRAINT "sup_ratings_supplier_id_sup_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."sup_suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sup_ratings" ADD CONSTRAINT "sup_ratings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sup_suppliers" ADD CONSTRAINT "sup_suppliers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sup_ratings_supplier_idx" ON "sup_ratings" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "sup_suppliers_workspace_archived_idx" ON "sup_suppliers" USING btree ("workspace_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sup_suppliers_tax_branch_key" ON "sup_suppliers" USING btree ("workspace_id","tax_id","branch_code") WHERE "sup_suppliers"."tax_id" <> '' and "sup_suppliers"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "sup_suppliers_sc_entry_key" ON "sup_suppliers" USING btree ("workspace_id","sc_vendor_list_entry_id") WHERE "sup_suppliers"."sc_vendor_list_entry_id" is not null;