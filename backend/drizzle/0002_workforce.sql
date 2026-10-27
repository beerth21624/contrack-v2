CREATE TABLE "crew_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"crew_id" uuid NOT NULL,
	"task_id" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crew_assignments_dates_check" CHECK ("crew_assignments"."start_date" <= "crew_assignments"."end_date"),
	CONSTRAINT "crew_assignments_task_check" CHECK ("crew_assignments"."task_id" ~ '^[1-9]\.[1-9][0-9]?$')
);
--> statement-breakpoint
CREATE TABLE "crew_members" (
	"crew_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "crew_members_crew_id_person_id_pk" PRIMARY KEY("crew_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "crews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"trade" text NOT NULL,
	"leader_id" uuid,
	"skilled_count" integer NOT NULL,
	"labourer_count" integer NOT NULL,
	"rate_card_id" uuid,
	"daily_cost_override" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "crews_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "crews_name_check" CHECK (char_length("crews"."name") between 1 and 80),
	CONSTRAINT "crews_skilled_count_check" CHECK ("crews"."skilled_count" between 0 and 200),
	CONSTRAINT "crews_labourer_count_check" CHECK ("crews"."labourer_count" between 0 and 200),
	CONSTRAINT "crews_daily_cost_override_check" CHECK ("crews"."daily_cost_override" is null or "crews"."daily_cost_override" between 0 and 100000)
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"nickname" text,
	"phone" text,
	"role" text NOT NULL,
	"employment" text NOT NULL,
	"trades" text[] DEFAULT '{}'::text[] NOT NULL,
	"daily_wage" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "people_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "people_name_check" CHECK (char_length("people"."name") between 1 and 80),
	CONSTRAINT "people_role_check" CHECK ("people"."role" in ('foreman', 'supervisor', 'engineer', 'skilled', 'labourer')),
	CONSTRAINT "people_employment_check" CHECK ("people"."employment" in ('permanent', 'daily', 'subcontractor')),
	CONSTRAINT "people_daily_wage_check" CHECK ("people"."daily_wage" is null or "people"."daily_wage" between 0 and 100000)
);
--> statement-breakpoint
CREATE TABLE "project_supervisors" (
	"project_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "project_supervisors_project_id_person_id_pk" PRIMARY KEY("project_id","person_id")
);
--> statement-breakpoint
ALTER TABLE "crew_assignments" ADD CONSTRAINT "crew_assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_assignments" ADD CONSTRAINT "crew_assignments_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_assignments" ADD CONSTRAINT "crew_assignments_crew_tenant_fk" FOREIGN KEY ("crew_id","workspace_id") REFERENCES "public"."crews"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_crew_tenant_fk" FOREIGN KEY ("crew_id","workspace_id") REFERENCES "public"."crews"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_person_tenant_fk" FOREIGN KEY ("person_id","workspace_id") REFERENCES "public"."people"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crews" ADD CONSTRAINT "crews_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crews" ADD CONSTRAINT "crews_leader_tenant_fk" FOREIGN KEY ("leader_id","workspace_id") REFERENCES "public"."people"("id","workspace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crews" ADD CONSTRAINT "crews_rate_card_tenant_fk" FOREIGN KEY ("rate_card_id","workspace_id") REFERENCES "public"."rate_cards"("id","workspace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_supervisors" ADD CONSTRAINT "project_supervisors_project_tenant_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_supervisors" ADD CONSTRAINT "project_supervisors_person_tenant_fk" FOREIGN KEY ("person_id","workspace_id") REFERENCES "public"."people"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crew_assignments_project_idx" ON "crew_assignments" USING btree ("workspace_id","project_id","start_date");--> statement-breakpoint
CREATE INDEX "crew_assignments_crew_idx" ON "crew_assignments" USING btree ("workspace_id","crew_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "crew_members_person_idx" ON "crew_members" USING btree ("workspace_id","person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crews_name_key" ON "crews" USING btree ("workspace_id",lower("name")) WHERE "crews"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "crews_workspace_idx" ON "crews" USING btree ("workspace_id","archived_at");--> statement-breakpoint
CREATE INDEX "people_workspace_idx" ON "people" USING btree ("workspace_id","archived_at");--> statement-breakpoint
CREATE INDEX "project_supervisors_person_idx" ON "project_supervisors" USING btree ("workspace_id","person_id");