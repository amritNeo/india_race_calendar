import type { DemoEvent } from "./domain";

const cityList = [
  ["Pune", "maharashtra", 10],
  ["Mumbai", "maharashtra", 5],
  ["Bengaluru", "karnataka", 5],
  ["Delhi", "delhi", 5],
  ["Hyderabad", "telangana", 5],
  ["Chennai", "tamil-nadu", 1],
  ["Kolkata", "west-bengal", 1],
  ["Ahmedabad", "gujarat", 1],
  ["Jaipur", "rajasthan", 1],
  ["Chandigarh", "chandigarh", 1],
  ["Goa", "goa", 1],
  ["Nashik", "maharashtra", 1],
  ["Nagpur", "maharashtra", 1],
  ["Mysuru", "karnataka", 1],
  ["Surat", "gujarat", 1],
] as const;
const specs = [
  ["Running", "running", "Marathon", "marathon", "RUN", 42.195],
  ["Running", "running", "Half Marathon", "half-marathon", "RUN", 21.1],
  ["Running", "running", "10K", "10k", "RUN", 10],
  ["Running", "running", "5K", "5k", "RUN", 5],
  ["Running", "running", "Ultra", "ultra", "RUN", 50],
  ["Running", "running", "Trail Run", "trail-run", "RUN", 25],
  ["Triathlon", "triathlon", "Olympic", "olympic", "SWIM", 1.5],
  ["Cycling", "cycling", "Road Cycling", "road-cycling", "BIKE", 100],
  ["Multisport", "multisport", "Duathlon", "duathlon", "RUN", 10],
  ["Functional Fitness", "functional-fitness", "HYROX", "hyrox", "OTHER", 0],
] as const;
const titles = [
  "City Run Festival",
  "Riverfront Race Day",
  "Endurance Challenge",
  "Sunrise Run",
  "Annual Road Race",
  "Championship",
  "Trail Classic",
  "Community Run",
  "Race Weekend",
  "Fitness Festival",
];
const dateFor = (index: number) =>
  new Date(
    Date.UTC(2026, 10 + Math.floor(index / 3), 2 + ((index * 7) % 24), 0, 0, 0),
  ).toISOString();

export const demoEvents: DemoEvent[] = cityList.flatMap(
  ([city, state, count], cityIndex) =>
    Array.from({ length: count }, (_, index) => {
      const [
        parentName,
        parentSlug,
        categoryName,
        categorySlug,
        discipline,
        km,
      ] = specs[(index + cityIndex) % specs.length];
      const date = dateFor(index + cityIndex);
      const slug =
        `${city.toLowerCase()}-${categorySlug}-${date.slice(0, 4)}-${index + 1}`.replaceAll(
          " ",
          "-",
        );
      return {
        id: `demo-${cityIndex}-${index}`,
        name: `${city} ${categoryName} ${titles[index % titles.length]} — Sample Event ${index + 1}`,
        slug,
        description: `A development sample listing for a ${categoryName.toLowerCase()} event in ${city}. This event is illustrative and has not been verified as a real event. Check official event sources before making plans.`,
        startDate: date,
        endDate: null,
        status: index % 5 === 0 ? "PUBLISHED" : "REGISTRATION_OPEN",
        isDemo: true,
        city: {
          name: city,
          slug: city.toLowerCase(),
          state: {
            name: state
              .split("-")
              .map((part) => part[0].toUpperCase() + part.slice(1))
              .join(" "),
            slug: state,
          },
        },
        category: {
          name: categoryName,
          slug: categorySlug,
          parent: { name: parentName, slug: parentSlug },
        },
        venue: { name: `${city} Sample Venue`, address: null },
        organizer: { name: `${city} Sample Organizers`, websiteUrl: null },
        distances:
          discipline === "SWIM"
            ? [
                {
                  name: "Swim",
                  discipline: "SWIM",
                  distanceKm: 1.5,
                  sequence: 1,
                },
                {
                  name: "Bike",
                  discipline: "BIKE",
                  distanceKm: 40,
                  sequence: 2,
                },
                { name: "Run", discipline: "RUN", distanceKm: 10, sequence: 3 },
              ]
            : [{ name: categoryName, discipline, distanceKm: km, sequence: 1 }],
        registrationUrl: null,
        officialWebsiteUrl: null,
        sourceName: "Development sample data",
        sourceUrl: null,
        lastVerifiedAt: null,
        updatedAt: date,
      };
    }),
);

export const demoCities = cityList.map(([name, state]) => ({
  id: name.toLowerCase(),
  name,
  slug: name.toLowerCase(),
  state: {
    name: state
      .split("-")
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(" "),
    slug: state,
  },
}));
export const categoryCatalog = [
  [
    "Running",
    "running",
    [
      ["Marathon", "marathon"],
      ["Half Marathon", "half-marathon"],
      ["10K", "10k"],
      ["5K", "5k"],
      ["Ultra", "ultra"],
      ["Trail Run", "trail-run"],
    ],
  ],
  [
    "Triathlon",
    "triathlon",
    [
      ["Full Distance", "full-distance"],
      ["70.3", "70-3"],
      ["Olympic", "olympic"],
      ["Sprint", "sprint"],
      ["Super Sprint", "super-sprint"],
    ],
  ],
  [
    "Cycling",
    "cycling",
    [
      ["Road Cycling", "road-cycling"],
      ["MTB", "mtb"],
      ["Gravel", "gravel"],
      ["BRM", "brm"],
      ["Gran Fondo", "gran-fondo"],
    ],
  ],
  [
    "Multisport",
    "multisport",
    [
      ["Duathlon", "duathlon"],
      ["Aquathlon", "aquathlon"],
      ["SwimRun", "swimrun"],
      ["Adventure Race", "adventure-race"],
    ],
  ],
  [
    "Functional Fitness",
    "functional-fitness",
    [
      ["HYROX", "hyrox"],
      ["Hybrid Race", "hybrid-race"],
      ["CrossFit Competition", "crossfit-competition"],
      ["OCR", "ocr"],
    ],
  ],
  [
    "Other",
    "other",
    [
      ["Walkathon", "walkathon"],
      ["Hill Climb", "hill-climb"],
      ["Vertical Race", "vertical-race"],
      ["Kids Race", "kids-race"],
    ],
  ],
] as const;
export const demoCategories = categoryCatalog.flatMap(
  ([parentName, parentSlug, children]) => [
    { name: parentName, slug: parentSlug, parent: null },
    ...children.map(([name, slug]) => ({
      name,
      slug,
      parent: { name: parentName, slug: parentSlug },
    })),
  ],
);
