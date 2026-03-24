CREATE TABLE IF NOT EXISTS "instagram_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instagramSenderId" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "instagramId" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "instagramUsername" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_instagramId_unique" UNIQUE("instagramId");