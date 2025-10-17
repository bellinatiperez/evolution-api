-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "InstanceGroup" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "instances" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "InstanceGroup_name_key" ON "InstanceGroup"("name");

-- AlterTable - Add alias column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'InstanceGroup' AND column_name = 'alias'
    ) THEN
        ALTER TABLE "InstanceGroup" ADD COLUMN "alias" VARCHAR(100);
    END IF;
END $$;

-- Update existing records with generated aliases based on their names (only if alias is null)
UPDATE "InstanceGroup" 
SET "alias" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE("name", '\s+', '-', 'g'), '[^a-z0-9-]', '', 'g'))
WHERE "alias" IS NULL;

-- Make the column NOT NULL if it exists and isn't already NOT NULL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'InstanceGroup' 
        AND column_name = 'alias' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE "InstanceGroup" ALTER COLUMN "alias" SET NOT NULL;
    END IF;
END $$;

-- CreateIndex (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'InstanceGroup' AND indexname = 'InstanceGroup_alias_key'
    ) THEN
        CREATE UNIQUE INDEX "InstanceGroup_alias_key" ON "InstanceGroup"("alias");
    END IF;
END $$;