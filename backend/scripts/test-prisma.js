const { PrismaClient } = require('@prisma/client');

async function run() {
  const prisma = new PrismaClient();
  try {
    const pedidos = await prisma.pedido.findMany();
    console.log('pedidos encontrados:', pedidos.length);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error('Erro ao consultar pedidos', error);
  process.exit(1);
});
