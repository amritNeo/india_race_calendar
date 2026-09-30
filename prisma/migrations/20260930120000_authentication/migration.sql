CREATE TABLE "UserProfile" (
  "id" UUID NOT NULL,
  "email" TEXT,
  "username" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserProfile_username_format_check"
    CHECK ("username" IS NULL OR "username" ~ '^[a-z0-9][a-z0-9._-]{2,29}$')
);

CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");
CREATE UNIQUE INDEX "UserProfile_username_key" ON "UserProfile"("username");

ALTER TABLE "UserProfile" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "UserProfile" FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public."UserProfile" AS profile ("id", "email", "username", "createdAt", "updatedAt")
  VALUES (
    NEW.id,
    LOWER(NEW.email),
    NULLIF(LOWER(NEW.raw_user_meta_data ->> 'username'), ''),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("id") DO UPDATE
  SET "email" = EXCLUDED."email",
      "username" = COALESCE(EXCLUDED."username", profile."username"),
      "updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
