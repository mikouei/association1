import { PrismaClient } 
  from '../node_modules/.prisma/platform-client/index.js';

const platformPrisma = new PrismaClient();

export default platformPrisma;

