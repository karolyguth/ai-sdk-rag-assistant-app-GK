ALTER TABLE "resources" ADD COLUMN "file_name" varchar(255);--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "source" varchar(20) DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "status" varchar(20) DEFAULT 'uploaded' NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;