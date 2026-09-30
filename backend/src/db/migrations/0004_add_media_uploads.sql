CREATE TYPE "public"."product_media_type" AS ENUM('IMAGE', 'VIDEO');--> statement-breakpoint
CREATE TABLE "product_view_360_frames" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"cloudinary_public_id" text,
	"frame_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "cloudinary_public_id" text;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "media_type" "product_media_type" DEFAULT 'IMAGE' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_view_360_frames" ADD CONSTRAINT "product_view_360_frames_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_view_360_frames_product_idx" ON "product_view_360_frames" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_view_360_frames_product_frame_idx" ON "product_view_360_frames" USING btree ("product_id","frame_index");