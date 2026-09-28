import { NextResponse } from "next/server";
import { getCities } from "@/lib/events";
export async function GET() { return NextResponse.json((await getCities()).map((city) => ({ name: city.name, slug: city.slug, state: city.state })), { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }); }
