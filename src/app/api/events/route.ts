import { NextRequest, NextResponse } from "next/server";
import { listEvents, toPublicEvent } from "@/lib/events";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const filters = Object.fromEntries(
    [
      "city",
      "state",
      "category",
      "from",
      "to",
      "search",
      "status",
      "distance",
    ].flatMap((key) => (params.has(key) ? [[key, params.get(key)!]] : [])),
  );
  return NextResponse.json((await listEvents(filters)).map(toPublicEvent), {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
