CREATE TABLE "workspace_entitlements" (
	"workspace_id" uuid NOT NULL,
	"module" text NOT NULL,
	"status" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"trial_used_at" timestamp with time zone,
	"granted_by" uuid,
	"note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_entitlements_workspace_id_module_pk" PRIMARY KEY("workspace_id","module"),
	CONSTRAINT "workspace_entitlements_status_check" CHECK ("workspace_entitlements"."status" in ('purchased', 'trial', 'beta', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "workspace_entitlements" ADD CONSTRAINT "workspace_entitlements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;