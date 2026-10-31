CREATE TABLE "customer_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_viewed_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"responded_at" timestamp with time zone,
	"response" jsonb,
	CONSTRAINT "customer_links_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "customer_links_subject_type_check" CHECK ("customer_links"."subject_type" in ('quotation', 'variation', 'invoice'))
);
--> statement-breakpoint
ALTER TABLE "customer_links" ADD CONSTRAINT "customer_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_links" ADD CONSTRAINT "customer_links_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_links_subject_idx" ON "customer_links" USING btree ("workspace_id","subject_type","subject_id");