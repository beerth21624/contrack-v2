CREATE TABLE "approval_policies" (
	"workspace_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"enabled" boolean NOT NULL,
	"min_amount" numeric(14, 2),
	"approver_roles" jsonb NOT NULL,
	"self_approve" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_policies_workspace_id_subject_pk" PRIMARY KEY("workspace_id","subject")
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"subject" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"title" text NOT NULL,
	"amount" numeric(14, 2),
	"status" text NOT NULL,
	"auto" boolean DEFAULT false NOT NULL,
	"auto_reason" text,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_requests_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "approval_requests_status_check" CHECK ("approval_requests"."status" in ('pending', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "approval_requests_auto_reason_check" CHECK ("approval_requests"."auto_reason" is null or "approval_requests"."auto_reason" in ('policy_off', 'below_threshold', 'self_approve', 'solo', 'no_approver'))
);
--> statement-breakpoint
CREATE TABLE "approval_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"approver_roles" jsonb NOT NULL,
	"status" text NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	CONSTRAINT "approval_steps_request_seq_key" UNIQUE("request_id","seq"),
	CONSTRAINT "approval_steps_status_check" CHECK ("approval_steps"."status" in ('pending', 'approved', 'rejected', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"actor_user_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_request_fk" FOREIGN KEY ("request_id","workspace_id") REFERENCES "public"."approval_requests"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "approval_requests_pending_key" ON "approval_requests" USING btree ("workspace_id","subject","subject_id") WHERE "approval_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "approval_requests_workspace_status_idx" ON "approval_requests" USING btree ("workspace_id","status","requested_at");--> statement-breakpoint
CREATE INDEX "approval_requests_subject_idx" ON "approval_requests" USING btree ("workspace_id","subject","subject_id");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("workspace_id","entity_type","entity_id","id");--> statement-breakpoint
CREATE INDEX "audit_events_workspace_at_idx" ON "audit_events" USING btree ("workspace_id","at");