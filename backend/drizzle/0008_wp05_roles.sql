ALTER TABLE "invitations" DROP CONSTRAINT "invitations_role_check";--> statement-breakpoint
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_role_check";--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_check" CHECK ("invitations"."role" in ('admin', 'estimator', 'viewer', 'pm', 'purchasing', 'accounting', 'foreman'));--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_check" CHECK ("memberships"."role" in ('owner', 'admin', 'estimator', 'viewer', 'pm', 'purchasing', 'accounting', 'foreman'));