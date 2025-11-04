CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY,
  "email" text UNIQUE,
  "display_name" text,
  "photo_url" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
); 