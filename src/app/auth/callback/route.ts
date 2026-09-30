import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAuthEnv, getSiteUrl } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (!getSupabaseAuthEnv()) return NextResponse.redirect(new URL("/login?error=Authentication+is+not+configured+yet.", getSiteUrl()));

  const supabase = await createSupabaseServerClient();
  if (!supabase || !code) {
    return NextResponse.redirect(new URL("/login?error=Sign-in+could+not+be+completed.", getSiteUrl()));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=Sign-in+could+not+be+completed.", getSiteUrl()));
  }

  return NextResponse.redirect(new URL(destination, getSiteUrl()));
}
