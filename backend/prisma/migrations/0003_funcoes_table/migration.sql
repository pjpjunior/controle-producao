-- CreateTable
CREATE TABLE "Funcao" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Funcao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Funcao_nome_key" ON "Funcao"("nome");

-- Seed default roles
INSERT INTO "Funcao" ("nome")
VALUES
  ('admin'),
  ('corte'),
  ('fita'),
  ('furacao'),
  ('usinagem'),
  ('montagem'),
  ('expedicao')
ON CONFLICT ("nome") DO NOTHING;
