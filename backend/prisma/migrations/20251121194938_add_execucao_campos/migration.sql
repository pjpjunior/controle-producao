-- AlterEnum
ALTER TYPE "ServicoStatus" ADD VALUE 'pausado';

-- AlterTable
ALTER TABLE "ServicoExecucao" ADD COLUMN     "motivoPausa" TEXT,
ADD COLUMN     "quantidadeExecutada" INTEGER NOT NULL DEFAULT 0;
