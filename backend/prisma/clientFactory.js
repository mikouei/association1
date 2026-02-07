import { PrismaClient } from '@prisma/client';

const clients = {};

export function getAssociationPrisma(dbName) {
  if (!clients[dbName]) {
    clients[dbName] = new PrismaClient({
      datasources: {
        db: {
          url: `file:./prisma/${dbName}`,
        },
      },
    });
  }
  return clients[dbName];
}

