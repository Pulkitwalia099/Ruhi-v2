CREATE TABLE IF NOT EXISTS "proactive_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"referenceId" text,
	"message" text NOT NULL,
	"sentAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proactive_log" ADD CONSTRAINT "proactive_log_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proactive_user_type_ref_idx" ON "proactive_log" USING btree ("userId","type","referenceId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proactive_user_sent_idx" ON "proactive_log" USING btree ("userId","sentAt");