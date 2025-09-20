import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.prismaGlobal || 
  new PrismaClient({
    log: ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}