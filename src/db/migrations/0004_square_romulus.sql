CREATE TABLE IF NOT EXISTS "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"companion" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
