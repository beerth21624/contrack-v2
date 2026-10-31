CREATE TABLE "sweep_marks" (
	"sweep" text NOT NULL,
	"key" text NOT NULL,
	"mark_date" date NOT NULL,
	CONSTRAINT "sweep_marks_sweep_key_mark_date_pk" PRIMARY KEY("sweep","key","mark_date")
);
--> statement-breakpoint
CREATE TABLE "user_channel_links" (
	"user_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"address" text NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_channel_links_user_id_channel_pk" PRIMARY KEY("user_id","channel"),
	CONSTRAINT "user_channel_links_channel_check" CHECK ("user_channel_links"."channel" in ('line', 'email'))
);
--> statement-breakpoint
ALTER TABLE "user_channel_links" ADD CONSTRAINT "user_channel_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;