import Link from "next/link";
import { signOutAction } from "@/app/auth-actions";
import { getAuthenticatedUser } from "@/lib/auth";

export async function AuthNav() {
  const user = await getAuthenticatedUser();
  if (!user) return <Link className="nav-signin" href="/login">Sign in</Link>;

  return (
    <div className="nav-account">
      <Link className="nav-dashboard" href="/dashboard">Dashboard</Link>
      <form action={signOutAction}><button className="nav-signout" type="submit">Sign out</button></form>
    </div>
  );
}
