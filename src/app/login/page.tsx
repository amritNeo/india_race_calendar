import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { oauthSignInAction, signInAction } from "@/app/auth-actions";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAuthEnv } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (await getAuthenticatedUser()) redirect("/dashboard");
  const { error, message } = await searchParams;
  const authConfigured = Boolean(getSupabaseAuthEnv());

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-back" href="/">
          ← Home
        </Link>
        <div className="eyebrow">Welcome back</div>
        <h1>Sign in to your calendar</h1>
        <p className="auth-intro">Pick up where your next race begins.</p>
        {error && (
          <p className="form-message form-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="form-message form-success" role="status">
            {message}
          </p>
        )}
        {!authConfigured && (
          <p className="form-message form-error" role="status">
            Add the Supabase URL and publishable key to enable sign-in.
          </p>
        )}

        <div className="oauth-options">
          <form action={oauthSignInAction}>
            <input type="hidden" name="provider" value="google" />
            <button
              className="oauth-button"
              type="submit"
              disabled={!authConfigured}
            >
              <span className="google-mark" aria-hidden="true">
                G
              </span>
              Continue with Google
            </button>
          </form>
          <form action={oauthSignInAction}>
            <input type="hidden" name="provider" value="strava" />
            <button
              className="oauth-button strava-button"
              type="submit"
              disabled={!authConfigured}
            >
              Connect with Strava
            </button>
          </form>
        </div>

        <div className="auth-divider">
          <span>or sign in with password</span>
        </div>
        <form className="auth-form" action={signInAction}>
          <label>
            Username or email
            <input
              name="identifier"
              autoComplete="username"
              required
              placeholder="Your username or email"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Your password"
            />
          </label>
          <button
            className="button auth-submit"
            type="submit"
            disabled={!authConfigured}
          >
            Sign in
          </button>
        </form>
        <p className="auth-switch">
          New to India Race Calendar?{" "}
          <Link href="/signup">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
