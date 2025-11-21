-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT TRUE;

-- Ensure existing registros fiquem ativos após a coluna ser criada
UPDATE "User" SET "ativo" = TRUE WHERE "ativo" IS NULL;
