CREATE TABLE "rate_cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"skilled_rate" integer NOT NULL,
	"labourer_rate" integer NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "rate_cards_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "rate_cards_name_check" CHECK (char_length("rate_cards"."name") between 1 and 60),
	CONSTRAINT "rate_cards_skilled_rate_check" CHECK ("rate_cards"."skilled_rate" between 0 and 100000),
	CONSTRAINT "rate_cards_labourer_rate_check" CHECK ("rate_cards"."labourer_rate" between 0 and 100000)
);
--> statement-breakpoint
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rate_cards_name_key" ON "rate_cards" USING btree ("workspace_id",lower("name")) WHERE "rate_cards"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "rate_cards_workspace_idx" ON "rate_cards" USING btree ("workspace_id","archived_at");