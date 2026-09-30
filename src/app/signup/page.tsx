import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { oauthSignInAction, signUpAction } from "@/app/auth-actions";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAuthEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAuthenticatedUser()) redirect("/dashboard");
  const { error } = await searchParams;
  const authConfigured = Boolean(getSupabaseAuthEnv());

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-back" href="/">← Home</Link>
        <div className="eyebrow">Start your season</div>
        <h1>Create your account</h1>
        <p className="auth-intro">One home for the races you want to run.</p>
        {error && <p className="form-message form-error" role="alert">{error}</p>}
        {!authConfigured && <p className="form-message form-error" role="status">Add the Supabase URL and publishable key to enable account creation.</p>}

        <div className="oauth-options">
          <form action={oauthSignInAction}><input type="hidden" name="provider" value="google" /><button className="oauth-button" type="submit" disabled={!authConfigured}><span className="google-mark" aria-hidden="true">G</span>Continue with Google</button></form>
          <form action={oauthSignInAction}><input type="hidden" name="provider" value="strava" /><button className="oauth-button strava-button" type="submit" disabled={!authConfigured}>Connect with Strava</button></form>
        </div>

        <div className="auth-divider"><span>or use your email</span></div>
        <form className="auth-form" action={signUpAction}>
          <label>Username<input name="username" autoComplete="username" minLength={3} maxLength={30} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}" required placeholder="Choose a username" /></label>
          <p className="field-hint">3–30 characters. Letters, numbers, periods, underscores, and hyphens.</p>
          <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
          <label>Password<input name="password" type="password" autoComplete="new-password" minLength={10} required placeholder="At least 10 characters" /></label>
          <button className="button auth-submit" type="submit" disabled={!authConfigured}>Create account</button>
        </form>
        <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
