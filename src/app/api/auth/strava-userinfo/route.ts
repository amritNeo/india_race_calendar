import { NextRequest, NextResponse } from "next/server";

type StravaAthlete = {
  id: number;
  username?: string | null;
  firstname?: string;
  lastname?: string;
  profile?: string;
  profile_medium?: string;
};

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const upstream = await fetch("https://www.strava.com/api/v3/athlete", {
    headers: { authorization },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!upstream.ok) {
    return NextResponse.json({ error: "profile_unavailable" }, { status: 502 });
  }

  const athlete = (await upstream.json()) as StravaAthlete;
  if (!Number.isSafeInteger(athlete.id) || athlete.id <= 0) {
    return NextResponse.json({ error: "profile_unavailable" }, { status: 502 });
  }

  const name = [athlete.firstname, athlete.lastname].filter(Boolean).join(" ");
  return NextResponse.json(
    {
      sub: String(athlete.id),
      name,
      given_name: athlete.firstname,
      family_name: athlete.lastname,
      preferred_username: athlete.username,
      picture: athlete.profile ?? athlete.profile_medium,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
