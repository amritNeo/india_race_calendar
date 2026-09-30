"use server";

import type { Provider } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { getSiteUrl, getSupabaseAuthEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function goToLogin(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

export async function signInAction(formData: FormData) {
  const config = getSupabaseAuthEnv();
  if (!config) goToLogin("Authentication is not configured yet.");

  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) goToLogin("Enter your username or email and password.");

  let email = identifier.toLowerCase();
  if (!email.includes("@")) {
    const prisma = getPrisma();
    if (!prisma) goToLogin("Username sign-in needs the database configured. Try your email instead.");
    const profile = await prisma.userProfile.findUnique({ where: { username: email } });
    if (!profile?.email) goToLogin("Those sign-in details did not match an account.");
    email = profile.email;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) goToLogin("Authentication is not configured yet.");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) goToLogin("Those sign-in details did not match an account.");
  redirect("/dashboard");
}

export async function signUpAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) goToLogin("Authentication is not configured yet.");
  const prisma = getPrisma();
  if (!prisma) goToLogin("Account creation requires the database to be configured.");

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
    redirect("/signup?error=Choose+a+username+with+3%E2%80%9330+letters%2C+numbers%2C+periods%2C+underscores+or+hyphens.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/signup?error=Enter+a+valid+email+address.");
  if (password.length < 10) redirect("/signup?error=Use+a+password+with+at+least+10+characters.");

  const existingUsername = await prisma.userProfile.findUnique({ where: { username } });
  if (existingUsername) redirect("/signup?error=That+username+is+already+in+use.");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
    },
  });
  if (error) {
    const message = error.message.toLowerCase().includes("userprofile") || error.message.toLowerCase().includes("username")
      ? "That username is already in use."
      : "We could not create that account. Check the details and try again.";
    redirect(`/signup?error=${encodeURIComponent(message)}`);
  }
  if (data.session) redirect("/dashboard");
  redirect("/login?message=Check+your+email+to+confirm+your+account%2C+then+sign+in.");
}

export async function oauthSignInAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) goToLogin("Authentication is not configured yet.");

  const providerName = String(formData.get("provider") ?? "");
  if (providerName !== "google" && providerName !== "strava") goToLogin("Choose Google or Strava to continue.");
  const provider: Provider = providerName === "google" ? "google" : "custom:strava";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
      ...(providerName === "strava" ? { scopes: "read" } : {}),
    },
  });
  if (error || !data.url) goToLogin("That sign-in provider is not configured yet.");
  redirect(data.url);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
