import { z } from "zod";
import dotenv from "dotenv";

// Load .env before validation
dotenv.config();

const envSchema = z.object({
  // Database
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required"),

  // Redis
  REDIS_URL: z
    .string()
    .min(1, "REDIS_URL is required"),

  // JWT — reject placeholder values
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters")
    .refine((s) => !s.includes("change-me"), {
      message: "JWT_SECRET is still a placeholder — generate with: openssl rand -base64 48",
    }),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters")
    .refine((s) => !s.includes("change-me"), {
      message: "JWT_REFRESH_SECRET is still a placeholder — generate with: openssl rand -base64 48",
    }),

  // Server
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // CORS
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Environment validation failed:");
    for (const issue of result.error.issues) {
      console.error(`   ${issue.path.join(".")}: ${issue.message}`);
    }

    // In production, crash immediately. In dev, warn but allow boot
    // so local development doesn't require strong secrets.
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }

    console.warn("⚠️  Continuing in development mode with invalid env vars.");
    // Fall through with raw env (development only)
    return {
      DATABASE_URL: process.env.DATABASE_URL || "",
      REDIS_URL: process.env.REDIS_URL || "",
      JWT_SECRET: process.env.JWT_SECRET || "dev-only-insecure-key-do-not-use-in-prod",
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "dev-only-insecure-refresh-key",
      PORT: Number(process.env.PORT) || 4000,
      NODE_ENV: "development",
      CORS_ORIGINS: process.env.CORS_ORIGINS || "http://localhost:5173",
    };
  }

  return result.data;
}

export const env = validateEnv();
