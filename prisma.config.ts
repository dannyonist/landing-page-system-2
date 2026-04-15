import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma CLI doesn't auto-load .env.local; Next.js does. Load it here.
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["POSTGRES_URL"],
  },
});
