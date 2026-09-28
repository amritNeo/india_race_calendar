import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma CLI does not load Next.js' .env.local automatically. Load it first,
// then fill any missing values from .env while preserving shell env overrides.
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "postgresql://placeholder:placeholder@localhost:5432/placeholder" },
});
