import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export function getPrisma(): PrismaClient | null {
  const connectionString = process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();
  if (!connectionString) {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error("Supabase URL is configured, but Prisma needs DATABASE_URL (and DIRECT_URL for migrations). Add the PostgreSQL connection strings to .env.local.");
    }
    return null;
  }
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({ connectionString });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}
