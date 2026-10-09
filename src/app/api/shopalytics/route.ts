/**
 * The dashboard's single data endpoint.
 *
 * Requests are validated at the boundary: an unknown action or a malformed
 * filter stack is a 400 naming the problem, never a partially applied filter.
 * Every query reads the signed-in user's own account, resolved here from their
 * identity; a request body cannot name an account.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { UnauthenticatedPreviewError, resolveRequestIdentity } from "@/lib/server/request-identity";
import {
  getConversionStates,
  getConversionTrend,
  getDashboardContext,
  getDemographicSegments,
  getKpis,
  getProductBreakdown,
  getProductSentiment,
  getProducts,
  getReviewTopics,
  getReviews,
  getSegmentBreakdown,
  getTrafficSources,
  getSavedViews,
  saveView,
} from "@/lib/server/shopalytics";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "must be a yyyy-mm-dd date");

const analyticsFiltersSchema = z
  .object({
    productIds: z.array(uuid),
    trafficSourceIds: z.array(uuid),
    demographicSegmentIds: z.array(uuid),
    sentiments: z.array(z.enum(["positive", "neutral", "negative"])),
    reviewTopicIds: z.array(uuid),
    conversionStateIds: z.array(uuid),
    startDate: isoDate,
    endDate: isoDate,
  })
  .strict();

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("savedViews") }).strict(),
  z
    .object({
      action: z.literal("saveView"),
      name: z.string().trim().min(1).max(60),
      filters: analyticsFiltersSchema,
      datePreset: z.enum(["last_7_days", "last_30_days", "last_90_days", "custom"]),
    })
    .strict(),
  z.object({ action: z.literal("dashboardContext") }).strict(),
  z.object({ action: z.literal("products") }).strict(),
  z.object({ action: z.literal("trafficSources") }).strict(),
  z.object({ action: z.literal("demographicSegments") }).strict(),
  z.object({ action: z.literal("reviewTopics") }).strict(),
  z.object({ action: z.literal("conversionStates") }).strict(),
  z.object({ action: z.literal("kpis"), filters: analyticsFiltersSchema }).strict(),
  z.object({ action: z.literal("productBreakdown"), filters: analyticsFiltersSchema }).strict(),
  z.object({ action: z.literal("conversionTrend"), filters: analyticsFiltersSchema }).strict(),
  z
    .object({
      action: z.literal("reviews"),
      filters: analyticsFiltersSchema,
      limit: z.number().int().positive().max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("segmentBreakdown"),
      startDate: isoDate,
      endDate: isoDate,
    })
    .strict(),
  z.object({ action: z.literal("productSentiment") }).strict(),
]);

function json(payload: unknown): NextResponse {
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "the request body must be JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: `invalid Shopalytics request: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")} ${issue.message}`)
          .join("; ")}`,
      },
      { status: 400 },
    );
  }

  try {
    const identity = await resolveRequestIdentity(new Date());
    const context = await getDashboardContext(identity.authenticatedVia, identity.email);
    const accountId = context.account.id;
    const command = parsed.data;

    switch (command.action) {
      case "savedViews":
        return json(await getSavedViews(accountId, context.user.id));
      case "saveView":
        return json(
          await saveView(
            accountId,
            context.user.id,
            command.name,
            command.filters,
            command.datePreset,
          ),
        );
      case "dashboardContext":
        return json(context);
      case "products":
        return json(await getProducts(accountId));
      case "trafficSources":
        return json(await getTrafficSources());
      case "demographicSegments":
        return json(await getDemographicSegments());
      case "reviewTopics":
        return json(await getReviewTopics());
      case "conversionStates":
        return json(await getConversionStates());
      case "kpis":
        return json(await getKpis(accountId, command.filters));
      case "productBreakdown":
        return json(await getProductBreakdown(accountId, command.filters));
      case "conversionTrend":
        return json(await getConversionTrend(accountId, command.filters));
      case "reviews":
        return json(await getReviews(accountId, command.filters, command.limit));
      case "segmentBreakdown":
        return json(await getSegmentBreakdown(accountId, command.startDate, command.endDate));
      case "productSentiment":
        return json(await getProductSentiment(accountId));
    }
  } catch (error) {
    if (error instanceof UnauthenticatedPreviewError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Shopalytics data request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
