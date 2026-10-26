CREATE TABLE "activity_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"doc_key" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "invitations_role_check" CHECK ("invitations"."role" in ('admin', 'estimator', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "level_assignments" (
	"project_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"level_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "level_assignments_project_id_level_id_pk" PRIMARY KEY("project_id","level_id")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id"),
	CONSTRAINT "memberships_role_check" CHECK ("memberships"."role" in ('owner', 'admin', 'estimator', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "project_docs" (
	"project_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"doc_key" text NOT NULL,
	"data" jsonb,
	"version" integer NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_docs_project_id_doc_key_pk" PRIMARY KEY("project_id","doc_key"),
	CONSTRAINT "project_docs_version_check" CHECK ("project_docs"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "project_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"label" text NOT NULL,
	"note" text,
	"snapshot" jsonb NOT NULL,
	"totals" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start" text NOT NULL,
	"engine_version" text NOT NULL,
	"schema_version" integer NOT NULL,
	"summary" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "projects_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "projects_start_check" CHECK ("projects"."start" in ('blank', 'sample'))
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by" uuid
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_kind_check" CHECK ("workspaces"."kind" in ('personal', 'company'))
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_assignments" ADD CONSTRAINT "level_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_assignments" ADD CONSTRAINT "level_assignments_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_docs" ADD CONSTRAINT "project_docs_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_revisions" ADD CONSTRAINT "project_revisions_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_project_idx" ON "activity_log" USING btree ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invitations_workspace_idx" ON "invitations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_revisions_label_key" ON "project_revisions" USING btree ("project_id","label");--> statement-breakpoint
CREATE INDEX "project_revisions_project_idx" ON "project_revisions" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "projects_workspace_idx" ON "projects" USING btree ("workspace_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_hash_key" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");