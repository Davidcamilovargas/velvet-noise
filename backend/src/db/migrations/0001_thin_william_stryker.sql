ALTER TABLE "payments" ADD COLUMN "reference" varchar(160) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_reference_idx" ON "payments" USING btree ("provider","reference");