/**
 * The Shopalytics server instrumentation manifest.
 *
 * Onboarding produces one signed manifest per client release. It declares the
 * services and adapters this release requires, every route the Server SDK may
 * export a `SERVER` span for, the database class the fixture schema uses, and
 * the operational noise that is never product evidence. Application code cannot
 * broaden it at runtime: an inbound path that matches neither a registered
 * route nor registered noise withdraws readiness rather than exporting a raw
 * URL.
 *
 * Every identifier here is a build-time constant, so the manifest this module
 * produces is a pure function of its inputs and two builds of the same release
 * produce the same bytes apart from the ids the caller supplies.
 */

export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

export interface RegisteredRoute {
  readonly route_template: string;
  readonly methods: readonly HttpMethod[];
  readonly operation_name: string;
  readonly required: boolean;
}

export interface OperationalNoise {
  readonly path_pattern: string;
  readonly methods: readonly HttpMethod[];
}

export interface AnnotationDefinition {
  readonly definition_id: string;
  readonly definition_ref: string;
  readonly kind:
    | "product_operation"
    | "workflow_milestone"
    | "entity_class"
    | "safe_value"
    | "expected_outcome"
    | "background_root";
  readonly name: string;
  readonly output_class:
    "registered_reference" | "bounded_enum" | "bounded_integer" | "metadata_only";
}

export interface NetworkTarget {
  readonly scheme: "http" | "https";
  readonly host: string;
  readonly port: number;
}

export interface ServerManifestInputs {
  /** The uTrace Client this release belongs to. */
  readonly clientId: string;
  /** Stable identity of the manifest document itself. */
  readonly manifestId: string;
  /** The Shopalytics release the manifest describes. */
  readonly clientReleaseId: string;
  /** The application's own version, reported as an OpenTelemetry resource. */
  readonly serviceVersion: string;
  /** Absolute path error frames are reported relative to. */
  readonly repositoryRoot: string;
}

/**
 * Pages are server-rendered and the dashboard's data arrives over one endpoint,
 * so the required product path is short and exact. `/api/health` and the
 * Next.js asset routes are registered noise: excluding them cannot remove a
 * product route or a causal descendant of one.
 */
const REGISTERED_ROUTES: readonly RegisteredRoute[] = [
  {
    route_template: "/api/shopalytics",
    methods: ["POST"],
    operation_name: "shopalytics.dashboard_query",
    required: true,
  },
  {
    route_template: "/api/utrace/preview-handoff",
    methods: ["POST"],
    operation_name: "shopalytics.preview_handoff",
    required: true,
  },
  {
    route_template: "/app/conversion",
    methods: ["GET"],
    operation_name: "shopalytics.conversion_page",
    required: true,
  },
  {
    route_template: "/app",
    methods: ["GET"],
    operation_name: "shopalytics.app_home",
    required: false,
  },
  {
    route_template: "/app/products",
    methods: ["GET"],
    operation_name: "shopalytics.products_page",
    required: false,
  },
  {
    route_template: "/app/reviews",
    methods: ["GET"],
    operation_name: "shopalytics.reviews_page",
    required: false,
  },
  {
    route_template: "/app/segments",
    methods: ["GET"],
    operation_name: "shopalytics.segments_page",
    required: false,
  },
  {
    route_template: "/app/settings",
    methods: ["GET"],
    operation_name: "shopalytics.settings_page",
    required: false,
  },
  {
    route_template: "/login",
    methods: ["GET"],
    operation_name: "shopalytics.login_page",
    required: false,
  },
  {
    route_template: "/",
    methods: ["GET"],
    operation_name: "shopalytics.marketing_home",
    required: false,
  },
];

/**
 * Everything the framework serves that is not product evidence: the health
 * check the runtime template polls, every asset and payload under `/_next`,
 * and the well-known files a browser asks for on its own. Excluding them
 * cannot remove a product route or a causal descendant of one, because none of
 * them reaches application code.
 */
const OPERATIONAL_NOISE: readonly OperationalNoise[] = [
  { path_pattern: "/api/health", methods: ["GET", "HEAD"] },
  { path_pattern: "/_next/*", methods: ["GET", "HEAD", "POST"] },
  { path_pattern: "/favicon.ico", methods: ["GET", "HEAD"] },
  { path_pattern: "/icon.svg", methods: ["GET", "HEAD"] },
  { path_pattern: "/apple-icon.png", methods: ["GET", "HEAD"] },
  { path_pattern: "/robots.txt", methods: ["GET", "HEAD"] },
  { path_pattern: "/sitemap.xml", methods: ["GET", "HEAD"] },
];

/**
 * The registered product operations the typed annotation API may instantiate,
 * each with its definition. Runtime code can use one of these; it cannot
 * create a definition, and a registered operation without one is an invalid
 * manifest rather than a generic span.
 */
const ANNOTATION_DEFINITIONS: readonly AnnotationDefinition[] = [
  {
    definition_id: "0199a0c0-0000-7aaa-8000-00000000d101",
    definition_ref: "shopalytics_dashboard_query.v1",
    kind: "product_operation",
    name: "shopalytics.dashboard_query",
    output_class: "registered_reference",
  },
  {
    definition_id: "0199a0c0-0000-7aaa-8000-00000000d102",
    definition_ref: "shopalytics_conversion_trend.v1",
    kind: "product_operation",
    name: "shopalytics.conversion_trend",
    output_class: "registered_reference",
  },
  {
    definition_id: "0199a0c0-0000-7aaa-8000-00000000d103",
    definition_ref: "shopalytics_product_breakdown.v1",
    kind: "product_operation",
    name: "shopalytics.product_breakdown",
    output_class: "registered_reference",
  },
  {
    definition_id: "0199a0c0-0000-7aaa-8000-00000000d104",
    definition_ref: "shopalytics_review_query.v1",
    kind: "product_operation",
    name: "shopalytics.review_query",
    output_class: "registered_reference",
  },
];

const REGISTERED_OPERATIONS: readonly string[] = ANNOTATION_DEFINITIONS.map(
  (definition) => definition.name,
);

/**
 * Builds the manifest for one release. `propagationTargets` is the set of
 * server-SDK services this process may inject trace context toward; the
 * Shopalytics fixture is a single service, so it is empty and no outbound
 * request is traced at all.
 */
export function buildShopalyticsServerManifest(
  inputs: ServerManifestInputs,
): Readonly<Record<string, unknown>> {
  const propagationTargets: readonly NetworkTarget[] = [];
  return {
    manifest_id: inputs.manifestId,
    client_id: inputs.clientId,
    client_release_id: inputs.clientReleaseId,
    manifest_version: 1,
    policy_version: "1.0.0",
    utrace_schema_version: "1.0.0",
    semantic_convention_version: "1.37.0",
    server_sdk_contract_major: 1,
    services: [
      {
        service_key: "shopalytics_web",
        service_name: "shopalytics-web",
        service_namespace: "shopalytics",
        service_version: inputs.serviceVersion,
        required: true,
        // Serverful Next.js is `next_server`: it rides on the Node HTTP
        // adapter, and declaring it also admits the `next.js` scope the
        // framework emits its own handler spans under. `pg` supplies the
        // database hop the fixture schema is read through.
        required_adapters: ["next_server", "pg"],
        registered_routes: REGISTERED_ROUTES,
        registered_operations: REGISTERED_OPERATIONS,
        operational_noise: OPERATIONAL_NOISE,
      },
    ],
    propagation_targets: propagationTargets,
    redaction_rules: {
      // Outbound tracing follows `propagation_targets`; this defensive second
      // layer must be a superset of it, and both are empty.
      allowed_http_destinations: propagationTargets,
      // One class for the whole fixture schema: the SDK exports the class, the
      // operation and the duration, never SQL text, bind values or rows.
      allowed_database_classes: ["postgresql.shopalytics_fixture"],
      allowed_cache_classes: [],
      allowed_queue_destinations: [],
      allowed_error_types: ["Error", "TypeError", "RangeError", "PreviewHandoffError"],
      sanitized_error_messages: [
        {
          error_type: "PreviewHandoffError",
          sanitized_message: "the preview handoff token was refused",
        },
      ],
      repository_root: inputs.repositoryRoot,
      max_stack_frames: 12,
      max_attribute_value_length: 256,
      max_span_attribute_count: 32,
    },
    annotation_definitions: ANNOTATION_DEFINITIONS,
  };
}
