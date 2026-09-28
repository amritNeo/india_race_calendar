import { NextResponse } from "next/server";
import { getCategories } from "@/lib/events";
export async function GET() {
  return NextResponse.json(
    (await getCategories()).map((category) => ({
      name: category.name,
      slug: category.slug,
      parent: category.parent
        ? { name: category.parent.name, slug: category.parent.slug }
        : null,
    })),
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
