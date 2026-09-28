import { NextResponse } from "next/server";
import { getEvent, toPublicEvent } from "@/lib/events";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const event = await getEvent((await params).slug);
  return event
    ? NextResponse.json(toPublicEvent(event))
    : NextResponse.json({ error: "Event not found" }, { status: 404 });
}
