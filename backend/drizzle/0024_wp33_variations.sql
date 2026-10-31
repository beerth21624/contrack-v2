CREATE TABLE "vo_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"variation_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"file_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"taken_at" timestamp with time zone,
	"author_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vo_evidence_kind_check" CHECK ("vo_evidence"."kind" in ('photo', 'note', 'document'))
);
--> statement-breakpoint
CREATE TABLE "vo_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"variation_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"cost_code_id" uuid,
	"section_no" integer NOT NULL,
	"line_key" text,
	"desc_th" text DEFAULT '' NOT NULL,
	"desc_en" text DEFAULT '' NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"qty_delta" numeric(16, 4) NOT NULL,
	"cost_mat_unit" numeric(16, 4) DEFAULT 0 NOT NULL,
	"cost_lab_unit" numeric(16, 4) DEFAULT 0 NOT NULL,
	"cost_amount" numeric(14, 2) NOT NULL,
	"sell_unit" numeric(16, 4) DEFAULT 0 NOT NULL,
	"sell_amount" numeric(14, 2) NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "vo_lines_source_check" CHECK ("vo_lines"."source" in ('manual', 'calculator'))
);
--> statement-breakpoint
CREATE TABLE "vo_variations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"seq_no" integer NOT NULL,
	"number" text,
	"title" text DEFAULT '' NOT NULL,
	"reason" text DEFAULT 'owner_request' NOT NULL,
	"requested_by_name" text DEFAULT '' NOT NULL,
	"requested_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"sandbox" jsonb DEFAULT '{"calculators":{},"boqOverrides":{}}'::jsonb NOT NULL,
	"cost_total" numeric(14, 2) DEFAULT 0 NOT NULL,
	"sell_total" numeric(14, 2) DEFAULT 0 NOT NULL,
	"vat" numeric(14, 2) DEFAULT 0 NOT NULL,
	"schedule_impact_days" integer DEFAULT 0 NOT NULL,
	"billing" text NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"customer_snapshot" jsonb,
	"accepted_at" timestamp with time zone,
	"accepted_by_name" text DEFAULT '' NOT NULL,
	"response_note" text DEFAULT '' NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vo_variations_contract_seq_key" UNIQUE("contract_id","seq_no"),
	CONSTRAINT "vo_variations_workspace_number_key" UNIQUE("workspace_id","number"),
	CONSTRAINT "vo_variations_status_check" CHECK ("vo_variations"."status" in ('draft', 'pending_approval', 'submitted', 'accepted', 'rejected', 'withdrawn', 'cancelled')),
	CONSTRAINT "vo_variations_reason_check" CHECK ("vo_variations"."reason" in ('owner_request', 'design_change', 'site_condition', 'omission', 'other')),
	CONSTRAINT "vo_variations_billing_check" CHECK ("vo_variations"."billing" in ('next_claim', 'spread', 'separate_milestone')),
	CONSTRAINT "vo_variations_language_check" CHECK ("vo_variations"."language" in ('th', 'en'))
);
--> statement-breakpoint
ALTER TABLE "vo_evidence" ADD CONSTRAINT "vo_evidence_variation_id_vo_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."vo_variations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vo_evidence" ADD CONSTRAINT "vo_evidence_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vo_lines" ADD CONSTRAINT "vo_lines_variation_id_vo_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."vo_variations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vo_lines" ADD CONSTRAINT "vo_lines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vo_variations" ADD CONSTRAINT "vo_variations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vo_variations" ADD CONSTRAINT "vo_variations_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vo_evidence_variation_idx" ON "vo_evidence" USING btree ("variation_id");--> statement-breakpoint
CREATE INDEX "vo_lines_variation_idx" ON "vo_lines" USING btree ("variation_id","sort");--> statement-breakpoint
CREATE INDEX "vo_variations_workspace_project_idx" ON "vo_variations" USING btree ("workspace_id","project_id");