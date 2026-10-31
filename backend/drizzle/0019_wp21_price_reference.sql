CREATE TABLE "price_reference_books" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid,
	"source" text NOT NULL,
	"year" text NOT NULL,
	"title_th" text NOT NULL,
	"title_en" text NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_reference_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"book_id" uuid NOT NULL,
	"mid" text NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"material" text NOT NULL,
	"spec" text DEFAULT '' NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"green_label" boolean DEFAULT false NOT NULL,
	"price" numeric(14, 2) NOT NULL,
	"search" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_reference_books" ADD CONSTRAINT "price_reference_books_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_reference_items" ADD CONSTRAINT "price_reference_items_book_id_price_reference_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."price_reference_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_reference_books_source_year_idx" ON "price_reference_books" USING btree ("source","year");--> statement-breakpoint
CREATE INDEX "price_reference_items_book_category_idx" ON "price_reference_items" USING btree ("book_id","category");--> statement-breakpoint
CREATE INDEX "price_reference_items_search_idx" ON "price_reference_items" USING btree ("search" text_pattern_ops);