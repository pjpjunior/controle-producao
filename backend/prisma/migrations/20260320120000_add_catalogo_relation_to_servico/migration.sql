-- Add optional reference from Servico to ServicoCatalogo
ALTER TABLE "Servico" ADD COLUMN "catalogoId" INTEGER;

ALTER TABLE "Servico"
ADD CONSTRAINT "Servico_catalogoId_fkey"
FOREIGN KEY ("catalogoId") REFERENCES "ServicoCatalogo"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
