import prisma from '../../src/lib/prisma';

/**
 * Conecta Prisma al inicio de los tests.
 */
export const connectTestDb = async (): Promise<void> => {
  await prisma.$connect();
};

/**
 * Limpia todas las tablas entre tests (en orden para respetar FK constraints).
 */
export const clearDb = async (): Promise<void> => {
  await prisma.deliveryNote.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
};

/**
 * Desconecta Prisma al finalizar los tests.
 */
export const disconnectTestDb = async (): Promise<void> => {
  await prisma.$disconnect();
};
