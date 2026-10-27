CREATE TABLE "project_task_lags" (
	"project_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"task_id" text NOT NULL,
	"days" integer NOT NULL,
	"note" text,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_task_lags_project_id_task_id_pk" PRIMARY KEY("project_id","task_id"),
	CONSTRAINT "project_task_lags_days_check" CHECK ("project_task_lags"."days" between 0 and 90),
	CONSTRAINT "project_task_lags_task_check" CHECK ("project_task_lags"."task_id" ~ '^[1-9]\.[1-9][0-9]?$'),
	CONSTRAINT "project_task_lags_note_check" CHECK ("project_task_lags"."note" is null or char_length("project_task_lags"."note") <= 200)
);
--> statement-breakpoint
ALTER TABLE "project_task_lags" ADD CONSTRAINT "project_task_lags_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_task_lags_workspace_idx" ON "project_task_lags" USING btree ("workspace_id","project_id");