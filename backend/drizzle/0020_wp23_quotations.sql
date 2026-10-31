CREATE TABLE "qt_quotation_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"section_no" integer NOT NULL,
	"sort" integer NOT NULL,
	"kind" text NOT NULL,
	"line_key" text,
	"desc_th" text DEFAULT '' NOT NULL,
	"desc_en" text DEFAULT '' NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"qty" numeric(16, 4) NOT NULL,
	"cost_mat_unit" numeric(16, 4) NOT NULL,
	"cost_lab_unit" numeric(16, 4) NOT NULL,
	"cost_amount" numeric(14, 2) NOT NULL,
	"sell_mat_unit" numeric(16, 4) NOT NULL,
	"sell_lab_unit" numeric(16, 4) NOT NULL,
	"sell_unit" numeric(16, 4) NOT NULL,
	"sell_amount" numeric(14, 2) NOT NULL,
	CONSTRAINT "qt_quotation_lines_kind_check" CHECK ("qt_quotation_lines"."kind" in ('boq', 'custom', 'note'))
);
--> statement-breakpoint
CREATE TABLE "qt_quotation_sections" (
	"version_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"section_no" integer NOT NULL,
	"title_th" text DEFAULT '' NOT NULL,
	"title_en" text DEFAULT '' NOT NULL,
	"included" boolean DEFAULT true NOT NULL,
	"sort" integer NOT NULL,
	"cost_mat" numeric(14, 2) NOT NULL,
	"cost_lab" numeric(14, 2) NOT NULL,
	"cost_total" numeric(14, 2) NOT NULL,
	"markup_rate" numeric(7, 6) NOT NULL,
	"overhead_rate" numeric(7, 6) NOT NULL,
	"profit_rate" numeric(7, 6) NOT NULL,
	"vat_rate" numeric(7, 6),
	"sell_total" numeric(14, 2) NOT NULL,
	CONSTRAINT "qt_quotation_sections_pkey" PRIMARY KEY("version_id","section_no")
);
--> statement-breakpoint
CREATE TABLE "qt_quotation_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quotation_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"boq_version_id" uuid,
	"format" text NOT NULL,
	"detail_level" text NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"issue_date" date,
	"valid_until" date,
	"number" text,
	"customer_snapshot" jsonb,
	"company_snapshot" jsonb,
	"pricing" jsonb NOT NULL,
	"totals" jsonb NOT NULL,
	"payment_terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"terms_th" text DEFAULT '' NOT NULL,
	"terms_en" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_name" text DEFAULT '' NOT NULL,
	"response_note" text DEFAULT '' NOT NULL,
	"issued_by" uuid,
	"issued_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qt_quotation_versions_quotation_version_no_key" UNIQUE("quotation_id","version_no"),
	CONSTRAINT "qt_quotation_versions_status_check" CHECK ("qt_quotation_versions"."status" in ('draft', 'pending_approval', 'issued', 'accepted', 'change_requested', 'rejected', 'expired', 'superseded', 'cancelled')),
	CONSTRAINT "qt_quotation_versions_format_check" CHECK ("qt_quotation_versions"."format" in ('lump_sum_by_category', 'detailed', 'government')),
	CONSTRAINT "qt_quotation_versions_detail_level_check" CHECK ("qt_quotation_versions"."detail_level" in ('full', 'per_category', 'lump_sum')),
	CONSTRAINT "qt_quotation_versions_language_check" CHECK ("qt_quotation_versions"."language" in ('th', 'en'))
);
--> statement-breakpoint
CREATE TABLE "qt_quotations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"customer_id" uuid,
	"title" text DEFAULT '' NOT NULL,
	"number" text,
	"current_version_id" uuid,
	"accepted_version_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "qt_quotation_lines" ADD CONSTRAINT "qt_quotation_lines_version_id_qt_quotation_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."qt_quotation_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qt_quotation_lines" ADD CONSTRAINT "qt_quotation_lines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qt_quotation_sections" ADD CONSTRAINT "qt_quotation_sections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qt_quotation_sections" ADD CONSTRAINT "qt_quotation_sections_version_fk" FOREIGN KEY ("version_id") REFERENCES "public"."qt_quotation_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qt_quotation_versions" ADD CONSTRAINT "qt_quotation_versions_quotation_id_qt_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."qt_quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qt_quotation_versions" ADD CONSTRAINT "qt_quotation_versions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qt_quotation_versions" ADD CONSTRAINT "qt_quotation_versions_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qt_quotations" ADD CONSTRAINT "qt_quotations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qt_quotations" ADD CONSTRAINT "qt_quotations_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "qt_quotation_lines_version_idx" ON "qt_quotation_lines" USING btree ("version_id","sort");--> statement-breakpoint
CREATE UNIQUE INDEX "qt_quotation_versions_one_draft_idx" ON "qt_quotation_versions" USING btree ("quotation_id") WHERE "qt_quotation_versions"."status" in ('draft', 'pending_approval');--> statement-breakpoint
CREATE INDEX "qt_quotation_versions_workspace_project_idx" ON "qt_quotation_versions" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "qt_quotation_versions_status_valid_until_idx" ON "qt_quotation_versions" USING btree ("status","valid_until");--> statement-breakpoint
CREATE INDEX "qt_quotations_workspace_project_idx" ON "qt_quotations" USING btree ("workspace_id","project_id");