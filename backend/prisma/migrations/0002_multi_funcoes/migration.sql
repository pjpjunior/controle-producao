-- AlterTable
ALTER TABLE "User" ADD COLUMN     "funcoes" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "User" SET "funcoes" = ARRAY["User"."funcao"];

ALTER TABLE "User" ALTER COLUMN "funcoes" SET NOT NULL;

ALTER TABLE "User" DROP COLUMN "funcao";
