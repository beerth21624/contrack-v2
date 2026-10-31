CREATE TABLE "doc_number_counters" (
	"workspace_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"period_key" text NOT NULL,
	"last_seq" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doc_number_counters_workspace_id_doc_type_period_key_pk" PRIMARY KEY("workspace_id","doc_type","period_key")
);
--> statement-breakpoint
CREATE TABLE "doc_number_series" (
	"workspace_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"prefix" text NOT NULL,
	"pattern" text NOT NULL,
	"reset" text NOT NULL,
	"year_style" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doc_number_series_workspace_id_doc_type_pk" PRIMARY KEY("workspace_id","doc_type"),
	CONSTRAINT "doc_number_series_reset_check" CHECK ("doc_number_series"."reset" in ('yearly', 'monthly', 'never')),
	CONSTRAINT "doc_number_series_year_style_check" CHECK ("doc_number_series"."year_style" in ('ce', 'be'))
);
--> statement-breakpoint
CREATE TABLE "issued_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"number" text NOT NULL,
	"period_key" text NOT NULL,
	"seq" integer NOT NULL,
	"issue_date" date NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"project_id" uuid,
	"issued_by" uuid NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"voided_by" uuid,
	"voided_at" timestamp with time zone,
	"void_reason" text DEFAULT '' NOT NULL,
	CONSTRAINT "issued_documents_number_key" UNIQUE("workspace_id","doc_type","number"),
	CONSTRAINT "issued_documents_subject_key" UNIQUE("workspace_id","doc_type","subject_id"),
	CONSTRAINT "issued_documents_status_check" CHECK ("issued_documents"."status" in ('issued', 'voided'))
);
--> statement-breakpoint
ALTER TABLE "doc_number_counters" ADD CONSTRAINT "doc_number_counters_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_number_series" ADD CONSTRAINT "doc_number_series_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_documents" ADD CONSTRAINT "issued_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issued_documents_project_idx" ON "issued_documents" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "issued_documents_period_idx" ON "issued_documents" USING btree ("workspace_id","doc_type","period_key");