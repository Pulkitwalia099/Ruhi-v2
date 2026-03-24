CREATE TABLE IF NOT EXISTS "onboardings" (
	"userId" text PRIMARY KEY NOT NULL,
	"state" text DEFAULT 'awaiting_intent' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
