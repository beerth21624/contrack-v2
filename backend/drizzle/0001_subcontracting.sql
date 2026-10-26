CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_ip" text,
	CONSTRAINT "otp_codes_attempts_check" CHECK ("otp_codes"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"workspace_id" uuid,
	"purpose" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"notification_id" uuid,
	"channel" text NOT NULL,
	"to_address" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "notification_deliveries_channel_check" CHECK ("notification_deliveries"."channel" in ('sms', 'line', 'email')),
	CONSTRAINT "notification_deliveries_status_check" CHECK ("notification_deliveries"."status" in ('queued', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"template" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text DEFAULT '' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspace_modules" (
	"workspace_id" uuid NOT NULL,
	"module" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled_by" uuid,
	"enabled_at" timestamp with time zone,
	CONSTRAINT "workspace_modules_workspace_id_module_pk" PRIMARY KEY("workspace_id","module")
);
--> statement-breakpoint
CREATE TABLE "sc_activity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"vendor_workspace_id" uuid,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" uuid,
	"data" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sc_invitation_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"invitation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sc_invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"package_id" uuid NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"vendor_list_entry_id" uuid NOT NULL,
	"vendor_workspace_id" uuid,
	"display_name" text NOT NULL,
	"phone" text NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"viewed_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"decline_reason" text,
	"decline_note" text,
	"withdrawn_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"resent_count" integer DEFAULT 0 NOT NULL,
	"deadline_soon_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sc_invitations_status_check" CHECK ("sc_invitations"."status" in ('sent', 'viewed', 'declined', 'submitted', 'withdrawn', 'won', 'lost', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "sc_package_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"package_id" uuid NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"invitation_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"answered_by" uuid,
	"asked_at" timestamp with time zone NOT NULL,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sc_package_versions" (
	"package_id" uuid NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"lines" jsonb NOT NULL,
	"changed_idx" jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sc_package_versions_package_id_version_pk" PRIMARY KEY("package_id","version")
);
--> statement-breakpoint
CREATE TABLE "sc_vendor_list_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"vendor_workspace_id" uuid,
	"display_name" text NOT NULL,
	"phone" text NOT NULL,
	"line_id" text DEFAULT '' NOT NULL,
	"trades" jsonb NOT NULL,
	"province" text DEFAULT '' NOT NULL,
	"private_note" text DEFAULT '' NOT NULL,
	"hidden_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sc_vendor_portfolio" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vendor_workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"trade" text NOT NULL,
	"year" integer,
	"district" text DEFAULT '' NOT NULL,
	"province" text DEFAULT '' NOT NULL,
	"photo_file_ids" jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sc_vendor_profiles" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"team_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"line_user_id" text,
	"trades" jsonb NOT NULL,
	"provinces" jsonb NOT NULL,
	"crew_skilled" integer,
	"crew_labourers" integer,
	"tools" jsonb NOT NULL,
	"vat_registered" boolean DEFAULT false NOT NULL,
	"reference_rates" jsonb NOT NULL,
	"available_months" jsonb NOT NULL,
	"tier" text NOT NULL,
	"tier_updated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sc_vendor_profiles_tier_check" CHECK ("sc_vendor_profiles"."tier" in ('L0', 'L1', 'L2', 'L3'))
);
--> statement-breakpoint
CREATE TABLE "sc_work_packages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"project_name" text NOT NULL,
	"title" text NOT NULL,
	"trade" text NOT NULL,
	"status" text NOT NULL,
	"version" integer NOT NULL,
	"sourcing_mode" text NOT NULL,
	"pricing_mode" text NOT NULL,
	"supply_mode" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"hide_owner_identity" boolean NOT NULL,
	"terms" jsonb NOT NULL,
	"schedule" jsonb NOT NULL,
	"installments" jsonb NOT NULL,
	"location" jsonb NOT NULL,
	"selection" jsonb NOT NULL,
	"bid_deadline" timestamp with time zone NOT NULL,
	"price_valid_until" text NOT NULL,
	"estimate_total" numeric(14, 2) NOT NULL,
	"file_ids" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"awarded_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	CONSTRAINT "sc_work_packages_status_check" CHECK ("sc_work_packages"."status" in ('draft', 'open', 'reviewing', 'awarded', 'closed', 'cancelled', 'expired')),
	CONSTRAINT "sc_work_packages_version_check" CHECK ("sc_work_packages"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "sc_awards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone NOT NULL,
	"allocations" jsonb NOT NULL,
	"installments_from" jsonb NOT NULL,
	"subcontract_ids" jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sc_bids" (
	"id" uuid PRIMARY KEY NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"invitation_id" uuid NOT NULL,
	"vendor_workspace_id" uuid,
	"package_version" integer NOT NULL,
	"version" integer NOT NULL,
	"status" text NOT NULL,
	"mode" text NOT NULL,
	"lines" jsonb NOT NULL,
	"lump_total" numeric(14, 2),
	"adjustment" numeric(14, 2) DEFAULT 0 NOT NULL,
	"adjustment_note" text DEFAULT '' NOT NULL,
	"inclusions" text DEFAULT '' NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"normalized_total" numeric(14, 2) NOT NULL,
	"days" integer,
	"earliest_start" date,
	"crew_skilled" integer,
	"crew_labourers" integer,
	"valid_until" date,
	"installments_proposal" jsonb,
	"answers" jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"photo_file_ids" jsonb NOT NULL,
	"entered_by_buyer" boolean DEFAULT false NOT NULL,
	"submitted_by" uuid,
	"submitted_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sc_bids_status_check" CHECK ("sc_bids"."status" in ('draft', 'submitted', 'superseded', 'withdrawn', 'selected', 'not_selected')),
	CONSTRAINT "sc_bids_mode_check" CHECK ("sc_bids"."mode" in ('unit', 'lump')),
	CONSTRAINT "sc_bids_draft_version_check" CHECK (("sc_bids"."status" = 'draft') = ("sc_bids"."version" = 0))
);
--> statement-breakpoint
CREATE TABLE "sc_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"invitation_id" uuid NOT NULL,
	"sender" text NOT NULL,
	"author_user_id" uuid,
	"text" text NOT NULL,
	"target_total" numeric(14, 2),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sc_messages_sender_check" CHECK ("sc_messages"."sender" in ('buyer', 'vendor'))
);
--> statement-breakpoint
CREATE TABLE "sc_change_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subcontract_id" uuid NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"text" text NOT NULL,
	"requested_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sc_claims" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subcontract_id" uuid NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"installment_no" integer NOT NULL,
	"condition" text NOT NULL,
	"status" text NOT NULL,
	"requested_by" text NOT NULL,
	"requested_by_user" uuid NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"photo_file_ids" jsonb NOT NULL,
	"note" text NOT NULL,
	"inspection" jsonb,
	"gross_amount" numeric(14, 2) NOT NULL,
	"adjustments" jsonb NOT NULL,
	"retention_amount" numeric(14, 2) NOT NULL,
	"wht_amount" numeric(14, 2) NOT NULL,
	"vat_amount" numeric(14, 2) NOT NULL,
	"net_amount" numeric(14, 2) NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"paid_at" date,
	"paid_amount" numeric(14, 2),
	"paid_channel" text,
	"paid_ref" text,
	"paid_by" uuid,
	"rejected_reason" text,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sc_claims_status_check" CHECK ("sc_claims"."status" in ('requested', 'inspected', 'approved', 'paid', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "sc_contract_counters" (
	"buyer_workspace_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"seq" integer NOT NULL,
	CONSTRAINT "sc_contract_counters_pkey" PRIMARY KEY("buyer_workspace_id","year")
);
--> statement-breakpoint
CREATE TABLE "sc_contract_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subcontract_id" uuid NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"html" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sc_contract_documents_version_key" UNIQUE("subcontract_id","version")
);
--> statement-breakpoint
CREATE TABLE "sc_ratings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subcontract_id" uuid NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"from_side" text NOT NULL,
	"from_workspace_id" uuid NOT NULL,
	"to_workspace_id" uuid,
	"scores" jsonb NOT NULL,
	"comment" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sc_ratings_side_key" UNIQUE("subcontract_id","from_side")
);
--> statement-breakpoint
CREATE TABLE "sc_retention_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subcontract_id" uuid NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"claim_id" uuid,
	"note" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sc_retention_entries_kind_check" CHECK ("sc_retention_entries"."kind" in ('withheld', 'released', 'forfeited')),
	CONSTRAINT "sc_retention_entries_amount_check" CHECK ("sc_retention_entries"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "sc_settings" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sc_subcontracts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"invitation_id" uuid NOT NULL,
	"vendor_list_entry_id" uuid NOT NULL,
	"vendor_workspace_id" uuid,
	"vendor_name" text NOT NULL,
	"buyer_name" text NOT NULL,
	"project_name" text NOT NULL,
	"contract_no" text NOT NULL,
	"year" integer NOT NULL,
	"seq" integer NOT NULL,
	"title" text NOT NULL,
	"trade" text NOT NULL,
	"location" jsonb NOT NULL,
	"lines" jsonb NOT NULL,
	"base_total" numeric(14, 2) NOT NULL,
	"variations_total" numeric(14, 2) NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"terms" jsonb NOT NULL,
	"schedule" jsonb NOT NULL,
	"installments" jsonb NOT NULL,
	"document_version" integer NOT NULL,
	"signed_scan_file_id" uuid,
	"status" text NOT NULL,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	"accepted_ip" text,
	"activated_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"terminated_at" timestamp with time zone,
	"end_reason" text,
	"retention_reminders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sc_subcontracts_status_check" CHECK ("sc_subcontracts"."status" in ('pending_acceptance', 'active', 'completed', 'closed', 'cancelled', 'terminated'))
);
--> statement-breakpoint
CREATE TABLE "sc_variations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subcontract_id" uuid NOT NULL,
	"buyer_workspace_id" uuid NOT NULL,
	"proposed_by" text NOT NULL,
	"proposed_by_user" uuid NOT NULL,
	"lines" jsonb NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL,
	"status" text NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sc_variations_status_check" CHECK ("sc_variations"."status" in ('proposed', 'accepted', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_modules" ADD CONSTRAINT "workspace_modules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_activity" ADD CONSTRAINT "sc_activity_buyer_workspace_id_workspaces_id_fk" FOREIGN KEY ("buyer_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_invitation_tokens" ADD CONSTRAINT "sc_invitation_tokens_invitation_id_sc_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."sc_invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_invitations" ADD CONSTRAINT "sc_invitations_package_id_sc_work_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."sc_work_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_invitations" ADD CONSTRAINT "sc_invitations_vendor_list_entry_id_sc_vendor_list_entries_id_fk" FOREIGN KEY ("vendor_list_entry_id") REFERENCES "public"."sc_vendor_list_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_invitations" ADD CONSTRAINT "sc_invitations_vendor_workspace_id_workspaces_id_fk" FOREIGN KEY ("vendor_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_package_questions" ADD CONSTRAINT "sc_package_questions_package_id_sc_work_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."sc_work_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_package_questions" ADD CONSTRAINT "sc_package_questions_invitation_id_sc_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."sc_invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_package_versions" ADD CONSTRAINT "sc_package_versions_package_id_sc_work_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."sc_work_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_vendor_list_entries" ADD CONSTRAINT "sc_vendor_list_entries_buyer_workspace_id_workspaces_id_fk" FOREIGN KEY ("buyer_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_vendor_list_entries" ADD CONSTRAINT "sc_vendor_list_entries_vendor_workspace_id_workspaces_id_fk" FOREIGN KEY ("vendor_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_vendor_list_entries" ADD CONSTRAINT "sc_vendor_list_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_vendor_portfolio" ADD CONSTRAINT "sc_vendor_portfolio_vendor_workspace_id_sc_vendor_profiles_workspace_id_fk" FOREIGN KEY ("vendor_workspace_id") REFERENCES "public"."sc_vendor_profiles"("workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_vendor_profiles" ADD CONSTRAINT "sc_vendor_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_work_packages" ADD CONSTRAINT "sc_work_packages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_work_packages" ADD CONSTRAINT "sc_work_packages_project_tenant_fk" FOREIGN KEY ("project_id","buyer_workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_awards" ADD CONSTRAINT "sc_awards_buyer_workspace_id_workspaces_id_fk" FOREIGN KEY ("buyer_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_awards" ADD CONSTRAINT "sc_awards_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_bids" ADD CONSTRAINT "sc_bids_buyer_workspace_id_workspaces_id_fk" FOREIGN KEY ("buyer_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_bids" ADD CONSTRAINT "sc_bids_vendor_workspace_id_workspaces_id_fk" FOREIGN KEY ("vendor_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_bids" ADD CONSTRAINT "sc_bids_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_messages" ADD CONSTRAINT "sc_messages_buyer_workspace_id_workspaces_id_fk" FOREIGN KEY ("buyer_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_messages" ADD CONSTRAINT "sc_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_change_requests" ADD CONSTRAINT "sc_change_requests_subcontract_id_sc_subcontracts_id_fk" FOREIGN KEY ("subcontract_id") REFERENCES "public"."sc_subcontracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_change_requests" ADD CONSTRAINT "sc_change_requests_buyer_workspace_id_workspaces_id_fk" FOREIGN KEY ("buyer_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_claims" ADD CONSTRAINT "sc_claims_subcontract_id_sc_subcontracts_id_fk" FOREIGN KEY ("subcontract_id") REFERENCES "public"."sc_subcontracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_claims" ADD CONSTRAINT "sc_claims_buyer_workspace_id_workspaces_id_fk" FOREIGN KEY ("buyer_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_contract_counters" ADD CONSTRAINT "sc_contract_counters_buyer_workspace_id_workspaces_id_fk" FOREIGN KEY ("buyer_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_contract_documents" ADD CONSTRAINT "sc_contract_documents_subcontract_id_sc_subcontracts_id_fk" FOREIGN KEY ("subcontract_id") REFERENCES "public"."sc_subcontracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_contract_documents" ADD CONSTRAINT "sc_contract_documents_buyer_workspace_id_workspaces_id_fk" FOREIGN KEY ("buyer_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_ratings" ADD CONSTRAINT "sc_ratings_subcontract_id_sc_subcontracts_id_fk" FOREIGN KEY ("subcontract_id") REFERENCES "public"."sc_subcontracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_ratings" ADD CONSTRAINT "sc_ratings_buyer_workspace_id_workspaces_id_fk" FOREIGN KEY ("buyer_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_retention_entries" ADD CONSTRAINT "sc_retention_entries_subcontract_id_sc_subcontracts_id_fk" FOREIGN KEY ("subcontract_id") REFERENCES "public"."sc_subcontracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_retention_entries" ADD CONSTRAINT "sc_retention_entries_buyer_workspace_id_workspaces_id_fk" FOREIGN KEY ("buyer_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_retention_entries" ADD CONSTRAINT "sc_retention_entries_claim_id_sc_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."sc_claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_settings" ADD CONSTRAINT "sc_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_subcontracts" ADD CONSTRAINT "sc_subcontracts_vendor_workspace_id_workspaces_id_fk" FOREIGN KEY ("vendor_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_subcontracts" ADD CONSTRAINT "sc_subcontracts_project_tenant_fk" FOREIGN KEY ("project_id","buyer_workspace_id") REFERENCES "public"."projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_variations" ADD CONSTRAINT "sc_variations_subcontract_id_sc_subcontracts_id_fk" FOREIGN KEY ("subcontract_id") REFERENCES "public"."sc_subcontracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_variations" ADD CONSTRAINT "sc_variations_buyer_workspace_id_workspaces_id_fk" FOREIGN KEY ("buyer_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "otp_codes_phone_idx" ON "otp_codes" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "files_uploaded_by_idx" ON "files" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sc_activity_entity_idx" ON "sc_activity" USING btree ("entity","entity_id","id");--> statement-breakpoint
CREATE INDEX "sc_activity_buyer_idx" ON "sc_activity" USING btree ("buyer_workspace_id","id");--> statement-breakpoint
CREATE INDEX "sc_invitation_tokens_invitation_idx" ON "sc_invitation_tokens" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "sc_invitations_package_idx" ON "sc_invitations" USING btree ("package_id","sent_at");--> statement-breakpoint
CREATE INDEX "sc_invitations_vendor_idx" ON "sc_invitations" USING btree ("vendor_workspace_id","status");--> statement-breakpoint
CREATE INDEX "sc_invitations_entry_idx" ON "sc_invitations" USING btree ("vendor_list_entry_id");--> statement-breakpoint
CREATE INDEX "sc_package_questions_package_idx" ON "sc_package_questions" USING btree ("package_id","asked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sc_vendor_list_entries_phone_key" ON "sc_vendor_list_entries" USING btree ("buyer_workspace_id","phone");--> statement-breakpoint
CREATE INDEX "sc_vendor_list_entries_phone_idx" ON "sc_vendor_list_entries" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "sc_vendor_list_entries_vendor_idx" ON "sc_vendor_list_entries" USING btree ("vendor_workspace_id");--> statement-breakpoint
CREATE INDEX "sc_vendor_portfolio_vendor_idx" ON "sc_vendor_portfolio" USING btree ("vendor_workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "sc_vendor_profiles_phone_idx" ON "sc_vendor_profiles" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "sc_work_packages_project_idx" ON "sc_work_packages" USING btree ("buyer_workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "sc_work_packages_due_idx" ON "sc_work_packages" USING btree ("status","bid_deadline");--> statement-breakpoint
CREATE INDEX "sc_awards_package_idx" ON "sc_awards" USING btree ("buyer_workspace_id","package_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sc_bids_invitation_version_key" ON "sc_bids" USING btree ("invitation_id","version");--> statement-breakpoint
CREATE INDEX "sc_bids_package_idx" ON "sc_bids" USING btree ("buyer_workspace_id","package_id");--> statement-breakpoint
CREATE INDEX "sc_bids_vendor_idx" ON "sc_bids" USING btree ("vendor_workspace_id","status");--> statement-breakpoint
CREATE INDEX "sc_messages_invitation_idx" ON "sc_messages" USING btree ("invitation_id","created_at");--> statement-breakpoint
CREATE INDEX "sc_change_requests_subcontract_idx" ON "sc_change_requests" USING btree ("subcontract_id","created_at");--> statement-breakpoint
CREATE INDEX "sc_claims_subcontract_idx" ON "sc_claims" USING btree ("subcontract_id","installment_no");--> statement-breakpoint
CREATE UNIQUE INDEX "sc_claims_open_installment_key" ON "sc_claims" USING btree ("subcontract_id","installment_no") WHERE "sc_claims"."status" <> 'rejected';--> statement-breakpoint
CREATE INDEX "sc_ratings_buyer_idx" ON "sc_ratings" USING btree ("buyer_workspace_id","to_workspace_id");--> statement-breakpoint
CREATE INDEX "sc_retention_entries_subcontract_idx" ON "sc_retention_entries" USING btree ("subcontract_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sc_retention_entries_claim_withheld_key" ON "sc_retention_entries" USING btree ("claim_id") WHERE "sc_retention_entries"."kind" = 'withheld';--> statement-breakpoint
CREATE UNIQUE INDEX "sc_subcontracts_contract_no_key" ON "sc_subcontracts" USING btree ("buyer_workspace_id","contract_no");--> statement-breakpoint
CREATE INDEX "sc_subcontracts_project_idx" ON "sc_subcontracts" USING btree ("buyer_workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "sc_subcontracts_vendor_idx" ON "sc_subcontracts" USING btree ("vendor_workspace_id","status");--> statement-breakpoint
CREATE INDEX "sc_subcontracts_package_idx" ON "sc_subcontracts" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "sc_subcontracts_invitation_idx" ON "sc_subcontracts" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "sc_subcontracts_status_idx" ON "sc_subcontracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sc_variations_subcontract_idx" ON "sc_variations" USING btree ("subcontract_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_key" ON "users" USING btree ("phone");