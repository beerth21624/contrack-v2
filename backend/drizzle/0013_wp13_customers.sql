CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name_th" text DEFAULT '' NOT NULL,
	"name_en" text DEFAULT '' NOT NULL,
	"tax_id" text DEFAULT '' NOT NULL,
	"branch_code" text DEFAULT '' NOT NULL,
	"address_th" text DEFAULT '' NOT NULL,
	"address_en" text DEFAULT '' NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"line_id" text DEFAULT '' NOT NULL,
	"default_wht_rate" numeric(7, 6),
	"default_doc_language" text DEFAULT 'th' NOT NULL,
	"payment_term_days" integer DEFAULT 30 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_kind_check" CHECK ("customers"."kind" in ('individual', 'juristic', 'government')),
	CONSTRAINT "customers_default_doc_language_check" CHECK ("customers"."default_doc_language" in ('th', 'en')),
	CONSTRAINT "customers_name_check" CHECK ("customers"."name_th" <> '' or "customers"."name_en" <> '')
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_workspace_archived_idx" ON "customers" USING btree ("workspace_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tax_branch_key" ON "customers" USING btree ("workspace_id","tax_id","branch_code") WHERE "customers"."tax_id" <> '' and "customers"."archived_at" is null;