-- Seed gerente role
INSERT INTO "Funcao" ("nome")
VALUES ('gerente')
ON CONFLICT ("nome") DO NOTHING;
