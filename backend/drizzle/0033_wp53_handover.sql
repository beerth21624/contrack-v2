CREATE TABLE "ho_closeouts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"as_of" date,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lessons" text DEFAULT '' NOT NULL,
	"finalized_by" uuid,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ho_closeouts_project_key" UNIQUE("project_id"),
	CONSTRAINT "ho_closeouts_status_check" CHECK ("ho_closeouts"."status" in ('draft', 'final'))
);
--> statement-breakpoint
CREATE TABLE "ho_handover_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"handover_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"file_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ho_handover_documents_kind_check" CHECK ("ho_handover_documents"."kind" in ('as_built', 'manual', 'warranty_card', 'test_report', 'other'))
);
--> statement-breakpoint
CREATE TABLE "ho_handovers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"number" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_date" date,
	"inspection_date" date,
	"handover_date" date,
	"attendees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"defects_note" text DEFAULT '' NOT NULL,
	"accepted_by_name" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ho_handovers_project_key" UNIQUE("project_id"),
	CONSTRAINT "ho_handovers_workspace_number_key" UNIQUE("workspace_id","number"),
	CONSTRAINT "ho_handovers_status_check" CHECK ("ho_handovers"."status" in ('draft', 'scheduled', 'inspected', 'accepted', 'rejected')),
	CONSTRAINT "ho_handovers_language_check" CHECK ("ho_handovers"."language" in ('th', 'en'))
);
--> statement-breakpoint
CREATE TABLE "ho_warranties" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"handover_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ho_warranties_project_key" UNIQUE("project_id"),
	CONSTRAINT "ho_warranties_status_check" CHECK ("ho_warranties"."status" in ('active', 'expired', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "ho_warranty_claims" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"warranty_id" uuid NOT NULL,
	"number" text,
	"reported_date" date NOT NULL,
	"reported_by_name" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT 'phone' NOT NULL,
	"description" text NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assignee_user_id" uuid,
	"assignee_supplier_id" uuid,
	"due_date" date,
	"resolution_note" text DEFAULT '' NOT NULL,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"cost_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ho_warranty_claims_workspace_number_key" UNIQUE("workspace_id","number"),
	CONSTRAINT "ho_warranty_claims_status_check" CHECK ("ho_warranty_claims"."status" in ('open', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected')),
	CONSTRAINT "ho_warranty_claims_channel_check" CHECK ("ho_warranty_claims"."channel" in ('phone', 'line', 'site', 'link', 'other')),
	CONSTRAINT "ho_warranty_claims_severity_check" CHECK ("ho_warranty_claims"."severity" in ('low', 'medium', 'high')),
	CONSTRAINT "ho_warranty_claims_cost_check" CHECK ("ho_warranty_claims"."cost_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ho_closeouts" ADD CONSTRAINT "ho_closeouts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ho_closeouts" ADD CONSTRAINT "ho_closeouts_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ho_handover_documents" ADD CONSTRAINT "ho_handover_documents_handover_id_ho_handovers_id_fk" FOREIGN KEY ("handover_id") REFERENCES "public"."ho_handovers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ho_handover_documents" ADD CONSTRAINT "ho_handover_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ho_handovers" ADD CONSTRAINT "ho_handovers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ho_handovers" ADD CONSTRAINT "ho_handovers_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ho_warranties" ADD CONSTRAINT "ho_warranties_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ho_warranties" ADD CONSTRAINT "ho_warranties_handover_id_ho_handovers_id_fk" FOREIGN KEY ("handover_id") REFERENCES "public"."ho_handovers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ho_warranties" ADD CONSTRAINT "ho_warranties_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ho_warranty_claims" ADD CONSTRAINT "ho_warranty_claims_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ho_warranty_claims" ADD CONSTRAINT "ho_warranty_claims_warranty_id_ho_warranties_id_fk" FOREIGN KEY ("warranty_id") REFERENCES "public"."ho_warranties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ho_warranty_claims" ADD CONSTRAINT "ho_warranty_claims_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ho_handover_documents_handover_idx" ON "ho_handover_documents" USING btree ("handover_id");--> statement-breakpoint
CREATE INDEX "ho_warranties_status_end_idx" ON "ho_warranties" USING btree ("status","end_date");--> statement-breakpoint
CREATE INDEX "ho_warranty_claims_workspace_project_idx" ON "ho_warranty_claims" USING btree ("workspace_id","project_id","status");