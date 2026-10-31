CREATE TABLE "boq_version_lines" (
	"version_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"line_key" text NOT NULL,
	"section_no" integer NOT NULL,
	"sort" integer NOT NULL,
	"item_no" text DEFAULT '' NOT NULL,
	"desc_th" text NOT NULL,
	"unit" text NOT NULL,
	"qty" numeric(16, 4) NOT NULL,
	"gross_qty" numeric(16, 4),
	"waste" numeric(12, 6) NOT NULL,
	"mat_unit" numeric(16, 4) NOT NULL,
	"lab_unit" numeric(16, 4) NOT NULL,
	"mat_total" numeric(14, 2) NOT NULL,
	"lab_total" numeric(14, 2) NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"material_basis" text NOT NULL,
	"labour_basis" text NOT NULL,
	CONSTRAINT "boq_version_lines_pkey" PRIMARY KEY("version_id","line_key")
);
--> statement-breakpoint
CREATE TABLE "boq_version_sections" (
	"version_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"section_no" integer NOT NULL,
	"title_th" text NOT NULL,
	"in_construction_total" boolean NOT NULL,
	"mat_total" numeric(14, 2) NOT NULL,
	"lab_total" numeric(14, 2) NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	CONSTRAINT "boq_version_sections_pkey" PRIMARY KEY("version_id","section_no")
);
--> statement-breakpoint
CREATE TABLE "boq_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"kind" text DEFAULT 'snapshot' NOT NULL,
	"engine_version" text NOT NULL,
	"construction_total" numeric(14, 2) NOT NULL,
	"pre_construction_total" numeric(14, 2) NOT NULL,
	"mat_total" numeric(14, 2) NOT NULL,
	"lab_total" numeric(14, 2) NOT NULL,
	"line_count" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boq_versions_revision_id_key" UNIQUE("revision_id"),
	CONSTRAINT "boq_versions_project_version_no_key" UNIQUE("project_id","version_no"),
	CONSTRAINT "boq_versions_kind_check" CHECK ("boq_versions"."kind" in ('snapshot', 'baseline'))
);
--> statement-breakpoint
ALTER TABLE "boq_version_lines" ADD CONSTRAINT "boq_version_lines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_version_lines" ADD CONSTRAINT "boq_version_lines_version_fk" FOREIGN KEY ("version_id") REFERENCES "public"."boq_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_version_sections" ADD CONSTRAINT "boq_version_sections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_version_sections" ADD CONSTRAINT "boq_version_sections_version_fk" FOREIGN KEY ("version_id") REFERENCES "public"."boq_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_versions" ADD CONSTRAINT "boq_versions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_versions" ADD CONSTRAINT "boq_versions_revision_id_project_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."project_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_versions" ADD CONSTRAINT "boq_versions_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boq_versions_workspace_project_idx" ON "boq_versions" USING btree ("workspace_id","project_id");