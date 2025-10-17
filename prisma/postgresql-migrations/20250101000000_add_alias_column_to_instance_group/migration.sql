-- AlterTable
-- First, add the alias column as nullable
ALTER TABLE "InstanceGroup" ADD COLUMN "alias" VARCHAR(100);

-- Update existing records with generated aliases based on their names
UPDATE "InstanceGroup" 
SET "alias" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE("name", '\s+', '-', 'g'), '[^a-z0-9-]', '', 'g'))
WHERE "alias" IS NULL;

-- Now make the column NOT NULL and add the unique constraint
ALTER TABLE "InstanceGroup" ALTER COLUMN "alias" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "InstanceGroup_alias_key" ON "InstanceGroup"("alias");