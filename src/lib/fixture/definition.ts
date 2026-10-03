/**
 * The Dudulemon fixture's vocabulary: the account, the growth lead, the
 * dimensions, the catalogue and the review corpus.
 *
 * Everything here is fictional and deliberately adjacent to the canonical
 * saved-view stack described in the uTrace demo scenario
 * (`TikTok` + `Women 25-34` + `Sizing` + `Negative` + `Conversion rate`), so an
 * incorrectly restored filter shows visibly different rows instead of a
 * plausible-looking subset. The near-miss channels (`TikTok Shop`), segments
 * (`Women 35-44`, `Women 18-24`) and topics (`Fit consistency`) exist for that
 * reason and must not be removed.
 *
 * Names, emails and locations are shape-preserving synthetic values: they have
 * the shape of personal data and identify nobody.
 */

export const FIXTURE_ID = "dudulemon-saved-conversion-views";

/** Pins every generated identifier and number. Changing it changes the manifest. */
export const FIXTURE_ROOT_SEED = "shopalytics/dudulemon/2026-09-14/v1";

/** Namespace for the fixture's deterministic UUID v5 identifiers. */
export const FIXTURE_UUID_NAMESPACE = "8f1d2b4c-0c3a-4f5e-9a71-6d2b0c9e4a10";

/**
 * The pinned clock. A Monday 09:00 UTC, matching the recurring Monday review
 * the originating user describes. The seeded window ends on this day.
 */
export const FIXTURE_CLOCK = "2026-09-14T09:00:00Z";

/** Days of history the fixture seeds, ending on the fixture clock's UTC day. */
export const FIXTURE_HISTORY_DAYS = 120;

/** The Vercel Sandbox runtime template this dataset is prepared for. */
export const ENVIRONMENT_TEMPLATE = Object.freeze({
  id: "shopalytics-dudulemon-preview",
  revision: 2,
  dockerfile: "deploy/vercel/Dockerfile",
  supervisor: "deploy/vercel/supervisor.sh",
  application_port: 3300,
  postgres_major_version: 17,
  node_major_version: 24,
});

export const ACCOUNT_NAME = "Dudulemon";

/** The authenticated Dudulemon growth lead the preview hands off to. */
export const GROWTH_LEAD = Object.freeze({
  name: "Maya Okonkwo",
  email: "maya@dudulemon.example.com",
  role: "Growth lead",
});

export type ConversionStateKey =
  "purchased" | "checkout_drop_off" | "cart_drop_off" | "browse_only";

export type ConversionStateDefinition = Readonly<{
  key: ConversionStateKey;
  name: string;
  ordinal: number;
  /** How far into the funnel this cohort reached. Drives the seeded counters. */
  reached: Readonly<{
    productView: boolean;
    addToCart: boolean;
    checkout: boolean;
    purchase: boolean;
  }>;
}>;

export const CONVERSION_STATES: readonly ConversionStateDefinition[] = Object.freeze([
  {
    key: "purchased",
    name: "Purchased",
    ordinal: 1,
    reached: { productView: true, addToCart: true, checkout: true, purchase: true },
  },
  {
    key: "checkout_drop_off",
    name: "Checkout drop-off",
    ordinal: 2,
    reached: { productView: true, addToCart: true, checkout: true, purchase: false },
  },
  {
    key: "cart_drop_off",
    name: "Cart drop-off",
    ordinal: 3,
    reached: { productView: true, addToCart: true, checkout: false, purchase: false },
  },
  {
    key: "browse_only",
    name: "Browse only",
    ordinal: 4,
    reached: { productView: true, addToCart: false, checkout: false, purchase: false },
  },
] as const);

export type TrafficSourceDefinition = Readonly<{
  name: string;
  /** Relative share of sessions. */
  weight: number;
  /** Multiplier applied to the baseline purchase rate. */
  conversionFactor: number;
}>;

/**
 * `TikTok Shop` is the deliberate near miss for `TikTok`: similar name, similar
 * audience, different rows.
 */
export const TRAFFIC_SOURCES: readonly TrafficSourceDefinition[] = Object.freeze([
  { name: "TikTok", weight: 0.26, conversionFactor: 0.82 },
  { name: "TikTok Shop", weight: 0.09, conversionFactor: 1.04 },
  { name: "Instagram Reels", weight: 0.17, conversionFactor: 0.88 },
  { name: "Paid search", weight: 0.14, conversionFactor: 1.12 },
  { name: "Organic search", weight: 0.16, conversionFactor: 1.18 },
  { name: "Email", weight: 0.1, conversionFactor: 1.35 },
  { name: "Direct", weight: 0.08, conversionFactor: 1.22 },
] as const);

export const CANONICAL_TRAFFIC_SOURCE = "TikTok";
export const NEAR_MISS_TRAFFIC_SOURCE = "TikTok Shop";

export type DemographicSegmentDefinition = Readonly<{
  name: string;
  weight: number;
  conversionFactor: number;
}>;

/**
 * `Women 18-24` and `Women 35-44` bracket the canonical `Women 25-34` cohort so
 * an off-by-one restoration is visible in the numbers.
 */
export const DEMOGRAPHIC_SEGMENTS: readonly DemographicSegmentDefinition[] = Object.freeze([
  { name: "Women 25-34", weight: 0.29, conversionFactor: 1.0 },
  { name: "Women 18-24", weight: 0.18, conversionFactor: 0.87 },
  { name: "Women 35-44", weight: 0.19, conversionFactor: 1.11 },
  { name: "Women 45+", weight: 0.11, conversionFactor: 1.05 },
  { name: "Men 18-24", weight: 0.07, conversionFactor: 0.79 },
  { name: "Men 25-34", weight: 0.09, conversionFactor: 0.93 },
  { name: "Unspecified", weight: 0.07, conversionFactor: 0.9 },
] as const);

export const CANONICAL_DEMOGRAPHIC_SEGMENT = "Women 25-34";
export const NEAR_MISS_DEMOGRAPHIC_SEGMENTS: readonly string[] = Object.freeze([
  "Women 18-24",
  "Women 35-44",
]);

/** `Fit consistency` is the near miss for `Sizing`. */
export const REVIEW_TOPICS: readonly string[] = Object.freeze([
  "Sizing",
  "Fit consistency",
  "Fabric quality",
  "Shipping",
  "Durability",
  "Color accuracy",
]);

export const CANONICAL_REVIEW_TOPIC = "Sizing";
export const NEAR_MISS_REVIEW_TOPIC = "Fit consistency";

export type ProductDefinition = Readonly<{
  name: string;
  /** Relative share of sessions. */
  popularity: number;
  /** Baseline purchase rate before channel and segment factors. */
  baseConversionRate: number;
  /** Unit price in minor units. */
  priceCents: number;
  /**
   * True when the product carries the seeded negative sizing story: recent
   * negative `Sizing` reviews and a visible conversion drop-off.
   */
  sizingDropOff: boolean;
}>;

export const PRODUCTS: readonly ProductDefinition[] = Object.freeze([
  {
    name: "Aero High-Rise Legging",
    popularity: 0.17,
    baseConversionRate: 0.041,
    priceCents: 9800,
    sizingDropOff: true,
  },
  {
    name: "Featherlight Sports Bra",
    popularity: 0.11,
    baseConversionRate: 0.038,
    priceCents: 6400,
    sizingDropOff: true,
  },
  {
    name: "Flowstate Midi Dress",
    popularity: 0.09,
    baseConversionRate: 0.031,
    priceCents: 12400,
    sizingDropOff: true,
  },
  {
    name: "Luxe Sculpt Bodysuit",
    popularity: 0.07,
    baseConversionRate: 0.029,
    priceCents: 11800,
    sizingDropOff: true,
  },
  {
    name: "Cloudweave Jogger",
    popularity: 0.1,
    baseConversionRate: 0.044,
    priceCents: 10800,
    sizingDropOff: false,
  },
  {
    name: "Seamless Rib Tank",
    popularity: 0.08,
    baseConversionRate: 0.052,
    priceCents: 5200,
    sizingDropOff: false,
  },
  {
    name: "Everyday Half Zip",
    popularity: 0.08,
    baseConversionRate: 0.047,
    priceCents: 11200,
    sizingDropOff: false,
  },
  {
    name: "Studio Wrap Cardigan",
    popularity: 0.06,
    baseConversionRate: 0.034,
    priceCents: 13600,
    sizingDropOff: false,
  },
  {
    name: "Momentum Run Short",
    popularity: 0.07,
    baseConversionRate: 0.049,
    priceCents: 6800,
    sizingDropOff: false,
  },
  {
    name: "Core Crop Tee",
    popularity: 0.07,
    baseConversionRate: 0.055,
    priceCents: 4400,
    sizingDropOff: false,
  },
  {
    name: "Drift Fleece Hoodie",
    popularity: 0.06,
    baseConversionRate: 0.036,
    priceCents: 14200,
    sizingDropOff: false,
  },
  {
    name: "Trail Lite Windbreaker",
    popularity: 0.04,
    baseConversionRate: 0.027,
    priceCents: 15800,
    sizingDropOff: false,
  },
] as const);

/**
 * The day, counted back from the fixture clock, on which the sizing drop-off
 * starts. It sits inside `Last 30 days` so the preset shows the problem and the
 * 90-day range dilutes it.
 */
export const SIZING_DROP_OFF_START_DAYS_AGO = 26;

/** Review bodies, grouped by topic and sentiment. */
export type ReviewBodyGroup = Readonly<{
  topic: string;
  sentiment: "positive" | "neutral" | "negative";
  bodies: readonly string[];
}>;

export const REVIEW_BODIES: readonly ReviewBodyGroup[] = Object.freeze([
  {
    topic: "Sizing",
    sentiment: "negative",
    bodies: Object.freeze([
      "Ordered my usual size and it runs at least one size small. Sent it back.",
      "The size chart is not close to reality. I normally wear a medium and the medium would not close.",
      "Way smaller than the measurements say. Size up, twice if you are between sizes.",
      "Could not get it past my hips in my normal size. Disappointing after the wait.",
      "Runs tiny. It felt like compression wear rather than something I could wear all day.",
      "Bought my usual size after the TikTok video and it did not fit anywhere near the same.",
    ]),
  },
  {
    topic: "Sizing",
    sentiment: "neutral",
    bodies: Object.freeze([
      "Runs small but the size up fits fine, so plan for that.",
      "Sizing is snug. Not wrong, just tighter than the photos suggest.",
    ]),
  },
  {
    topic: "Sizing",
    sentiment: "positive",
    bodies: Object.freeze([
      "True to size for once. Ordered my usual and it fit straight away.",
      "The size guide was accurate for me and the fit is lovely.",
    ]),
  },
  {
    topic: "Fit consistency",
    sentiment: "negative",
    bodies: Object.freeze([
      "Two pieces in the same size fit completely differently. I cannot predict what will arrive.",
      "The cut changed between orders. My second one is noticeably longer in the body.",
      "Same size as my last order and the waistband sits in a different place entirely.",
    ]),
  },
  {
    topic: "Fit consistency",
    sentiment: "neutral",
    bodies: Object.freeze([
      "Fit differs a little between colours but nothing I could not live with.",
    ]),
  },
  {
    topic: "Fit consistency",
    sentiment: "positive",
    bodies: Object.freeze([
      "Third order and every piece has fitted exactly the same. That is rare.",
    ]),
  },
  {
    topic: "Fabric quality",
    sentiment: "positive",
    bodies: Object.freeze([
      "The fabric is genuinely lovely, soft and it holds its shape.",
      "Thick, opaque and it has not pilled after a month of wear.",
    ]),
  },
  {
    topic: "Fabric quality",
    sentiment: "negative",
    bodies: Object.freeze([
      "Pilled after a single wash. For the price I expected better.",
      "The fabric feels thinner than the older version of this piece.",
    ]),
  },
  {
    topic: "Fabric quality",
    sentiment: "neutral",
    bodies: Object.freeze(["The fabric is fine. Not the softest I own, not the worst either."]),
  },
  {
    topic: "Shipping",
    sentiment: "negative",
    bodies: Object.freeze([
      "Two weeks to arrive with no tracking updates in between.",
      "Delivery slipped twice and nobody told me until I asked.",
    ]),
  },
  {
    topic: "Shipping",
    sentiment: "positive",
    bodies: Object.freeze([
      "Arrived in two days, packaged well.",
      "Fast delivery and an easy return label in the box.",
    ]),
  },
  {
    topic: "Shipping",
    sentiment: "neutral",
    bodies: Object.freeze(["Delivery took about a week, which is what the checkout page said."]),
  },
  {
    topic: "Durability",
    sentiment: "negative",
    bodies: Object.freeze([
      "A seam went after three wears. I expected far longer.",
      "The waistband has already lost its stretch.",
    ]),
  },
  {
    topic: "Durability",
    sentiment: "positive",
    bodies: Object.freeze([
      "A year in and it still looks new.",
      "Holds up to daily training with no sagging.",
    ]),
  },
  {
    topic: "Durability",
    sentiment: "neutral",
    bodies: Object.freeze(["Wearing well so far, though I have only had it a few weeks."]),
  },
  {
    topic: "Color accuracy",
    sentiment: "negative",
    bodies: Object.freeze([
      "The colour is much duller in person than on the product page.",
      "Photographed as sage, arrived as grey.",
    ]),
  },
  {
    topic: "Color accuracy",
    sentiment: "neutral",
    bodies: Object.freeze(["Colour is slightly off from the photos but I still like it."]),
  },
  {
    topic: "Color accuracy",
    sentiment: "positive",
    bodies: Object.freeze(["The colour is exactly what the photos showed, which never happens."]),
  },
]);

/** Shape-preserving synthetic reviewer name parts. */
export const REVIEWER_GIVEN_NAMES: readonly string[] = Object.freeze([
  "Amara",
  "Bea",
  "Carys",
  "Dana",
  "Elif",
  "Farrah",
  "Gina",
  "Hana",
  "Imani",
  "Jodie",
  "Kiara",
  "Lena",
  "Mira",
  "Nadia",
  "Orla",
  "Priya",
  "Quinn",
  "Rosa",
  "Sana",
  "Tamsin",
  "Uma",
  "Vera",
  "Willa",
  "Xiomara",
  "Yara",
  "Zoe",
  "Alex",
  "Devon",
  "Jules",
  "Noor",
]);

export const REVIEWER_FAMILY_NAMES: readonly string[] = Object.freeze([
  "Abara",
  "Bello",
  "Costa",
  "Duarte",
  "Eriksen",
  "Ferraro",
  "Gill",
  "Haddad",
  "Ibarra",
  "Jensen",
  "Kowalski",
  "Lindqvist",
  "Moreau",
  "Nakamura",
  "Oyelaran",
  "Petrov",
  "Quill",
  "Rahman",
  "Silva",
  "Tanaka",
  "Ueda",
  "Varga",
  "Whitlock",
  "Xu",
  "Yilmaz",
  "Zappia",
]);

/** Reserved documentation domain: the addresses cannot reach a real mailbox. */
export const REVIEWER_EMAIL_DOMAIN = "example.com";

export const REVIEWER_LOCATIONS: readonly string[] = Object.freeze([
  "Austin, TX",
  "Portland, OR",
  "Chicago, IL",
  "Brooklyn, NY",
  "Denver, CO",
  "Toronto, ON",
  "Vancouver, BC",
  "Manchester, UK",
  "Bristol, UK",
  "Dublin, IE",
  "Melbourne, AU",
  "Auckland, NZ",
  "Berlin, DE",
  "Lisbon, PT",
  "Malmo, SE",
]);
