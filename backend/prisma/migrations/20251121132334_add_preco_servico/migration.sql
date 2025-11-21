-- DropForeignKey
ALTER TABLE "Servico" DROP CONSTRAINT "Servico_pedidoId_fkey";

-- DropForeignKey
ALTER TABLE "ServicoExecucao" DROP CONSTRAINT "ServicoExecucao_servicoId_fkey";

-- DropForeignKey
ALTER TABLE "ServicoExecucao" DROP CONSTRAINT "ServicoExecucao_userId_fkey";

-- AlterTable
ALTER TABLE "Funcao" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Pedido" ALTER COLUMN "dataCriacao" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Servico" ADD COLUMN     "precoUnitario" DECIMAL(10,2) NOT NULL DEFAULT 0,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ServicoExecucao" ALTER COLUMN "horaInicio" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "horaFim" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "funcoes" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicoExecucao" ADD CONSTRAINT "ServicoExecucao_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicoExecucao" ADD CONSTRAINT "ServicoExecucao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
