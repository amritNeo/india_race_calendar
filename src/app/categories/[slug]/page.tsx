import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventCard } from "@/components/event-card";
import { getCategories, getCategory, listEvents } from "@/lib/events";
type Props = { params: Promise<{ slug: string }> };
export async function generateStaticParams() { return [...new Set((await getCategories()).flatMap((category) => [category.slug, ...(category.parent ? [category.parent.slug] : [])]))].map((slug) => ({ slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategory((await params).slug);
  return category ? { title: `${category.name} events in India`, description: `Browse upcoming ${category.name.toLowerCase()} events across India.`, alternates: { canonical: `/categories/${(await params).slug}` } } : { title: "Category not found" };
}
export default async function CategoryPage({ params }: Props) {
  const slug = (await params).slug;
  const category = await getCategory(slug);
  if (!category) notFound();
  const events = await listEvents({ category: slug });
  return <main className="container" style={{ paddingTop: 46 }}><div className="eyebrow">Find your discipline</div><h1 style={{ fontSize: 42, letterSpacing: "-.05em", margin: "8px 0" }}>{category.parent ? category.name : `${category.name} events`}</h1><p style={{ color: "var(--muted)", margin: "0 0 24px" }}>Upcoming {category.name.toLowerCase()} events across India.</p>{events.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 16 }}>{events.map((event) => <EventCard key={event.id} event={event} />)}</div> : <p>No events listed for this category yet.</p>}</main>;
}
