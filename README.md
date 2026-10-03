# Shopalytics

Conversion analytics for ecommerce teams, and the client product the uTrace
Shopalytics demo runs against. The Dudulemon workspace, its people and every
number in it are fictional.

The demo scenario lives in the uTrace repository (`docs/SCENARIO.md`). Saved
views are deliberately **not** implemented here: uTrace implements that feature
live during the demo, so the filter stack is lost on navigation or reload and
nothing in this repository persists it.

## Requirements

- Node.js 24 (Active LTS). The application runs under Node at every stage;
  Bun is not used.
- Network access to an npm registry, and nothing else. `npm run build` reaches
  no other host: both faces are self-hosted from their `@fontsource-variable`
  packages through `next/font/local`, because a build that fetched
  `fonts.googleapis.com` cannot run inside a uTrace implementation workspace.
- Postgres 17.
- npm 11. The project moved from Bun to npm as its package manager: the
  preview container needs one runtime and one lockfile, `npm ci` is already
  present in the Node base image, and the uTrace Server SDK contract does not
  support Bun as a runtime. The Bun-only 24-hour `minimumReleaseAge`
  supply-chain guard has no npm equivalent and is no longer enforced.

## Quick start

```bash
npm ci                                   # install
cp .env.example .env.local               # then fill in DATABASE_URL
npm run db:seed:base                     # create the schema and install the fixture
npm run dev                              # http://localhost:3300
```

Production-shaped run:

```bash
npm run build
npm start                                # next start on port 3300, under Node
```

Preview run. The uTrace SDK packages are vendored, so `npm ci` installs them;
the profile and the SDK's static configuration are read at build time, so a
preview must be built with them:

```bash
npm run utrace:manifest                  # compile and sign both manifests
NEXT_PUBLIC_UTRACE_PROFILE=preview \
  NEXT_PUBLIC_UTRACE_SDK_INSTALLATION_ID=shopalytics-preview \
  NEXT_PUBLIC_UTRACE_CLIENT_RELEASE_ID=shopalytics-utrace-sdk-integration \
  npm run build
UTRACE_PROFILE=preview npm run start:preview   # node --import ./utrace/preload.mjs next start -p 3300
```

## Commands

| Command                               | What it does                                                |
| ------------------------------------- | ----------------------------------------------------------- |
| `npm ci`                              | Install from the lockfile.                                  |
| `npm run dev`                         | Next.js dev server on port 3300.                            |
| `npm run build`                       | Production build.                                           |
| `npm start`                           | `next start` on port 3300, production profile.              |
| `npm run start:preview`               | `next start` on port 3300 with the uTrace server preload.   |
| `npm run lint`                        | ESLint, including Prettier formatting.                      |
| `npm run typecheck`                   | `tsc --noEmit`.                                             |
| `npm run check:lockfile`              | Fail if `package-lock.json` has drifted from `package.json`. |
| `npm test`                            | Lockfile check, then the unit suite (no database, no network). |
| `npm run test:db`                     | Database suite against `SHOPALYTICS_TEST_DATABASE_URL`.     |
| `npm run fixture:generate`            | Regenerate `fixtures/dudulemon/manifest.json`.              |
| `npm run fixture:generate -- --check` | Fail if the committed manifest is stale.                    |
| `npm run db:seed:base`                | Install the fixture into the base runtime database.         |
| `npm run db:seed:candidate`           | Install the same fixture into a candidate runtime database. |
| `npm run utrace:vendor`               | Re-pack the uTrace SDK tarballs into `vendor/` from a uTrace checkout. |
| `npm run utrace:manifest`             | Compile and sign the annotation and server instrumentation manifests. |

The port is 3300 everywhere. Nothing in this repository uses port 3000.

## Environment

| Variable                              | Required  | Meaning                                                                                                                     |
| ------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                        | always    | Connection string the application reads.                                                                                    |
| `DATABASE_SSL`                        | always    | `true` or `false`. Anything else is an error.                                                                               |
| `SHOPALYTICS_DATABASE_SCHEMA`         | always    | Schema that owns the fixture tables. Never `public`. Applied through the connection's `search_path`.                        |
| `SHOPALYTICS_FIXTURE_CLOCK`           | optional  | RFC 3339 instant the dashboard treats as "now". Unset means real time. An unparsable value fails loudly.                    |
| `UTRACE_PROFILE`                      | always    | `production` or `preview`. Unset resolves to `production`; any other value is an error. Read at start-up by the server preload. |
| `NEXT_PUBLIC_UTRACE_PROFILE`          | always    | The same profile, read at build time so the client bundle knows which branch it is in.                                       |
| `SHOPALYTICS_BASE_DATABASE_URL`       | seeding   | Target of `npm run db:seed:base`.                                                                                           |
| `SHOPALYTICS_CANDIDATE_DATABASE_URL`  | seeding   | Target of `npm run db:seed:candidate`.                                                                                      |
| `SHOPALYTICS_FIXTURE_MANIFEST_HASH`   | preview   | The manifest hash the image was built from. `GET /api/health` compares it with what the database holds.                     |
| `UTRACE_PREVIEW_HANDOFF_SECRET`       | preview   | HMAC-SHA256 key for the one-time handoff token and the session cookie. Injected at runtime.                                 |
| `UTRACE_PREVIEW_ROUTE_SIGNING_SECRET` | preview   | HMAC-SHA256 key for `x-utrace-route-context`.                                                                               |
| `NEXT_PUBLIC_UTRACE_SDK_INSTALLATION_ID` | preview | Public SDK installation id. Carries no secret and no identity.                                                              |
| `NEXT_PUBLIC_UTRACE_CLIENT_RELEASE_ID`   | preview | The release the signed annotation manifest was compiled for.                                                                |
| `UTRACE_SERVER_BOOTSTRAP_CREDENTIAL`  | claimed   | The Server SDK's one-time bootstrap credential. Its absence is the single signal that keeps the process dormant.             |
| `UTRACE_SERVER_CONTROL_URL`           | claimed   | `wss://` origin of the uTrace control plane, no path.                                                                       |
| `UTRACE_SERVER_INGEST_URL`            | claimed   | `https://` origin of telemetry ingestion, no path.                                                                          |
| `UTRACE_SERVER_SERVICE_NAME`          | claimed   | The manifest `service_key` this process claims: `shopalytics_web`.                                                          |
| `UTRACE_SERVER_MANIFEST_TRUST_ANCHOR` | claimed   | Base64url JSON trust anchor used to verify the signed server instrumentation manifest.                                      |
| `SHOPALYTICS_TEST_DATABASE_URL`       | `test:db` | Database the database suite seeds a throwaway schema into.                                                                  |

`claimed` variables are written by the prepared-preview environment into
`/srv/shopalytics/.utrace-activation` when it claims the runtime for an
Interview Session, because the Server SDK's activation binds a session and a
preview origin that do not exist while the runtime waits in a warm pool. The
supervisor sources that file at start-up. A runtime with none of them runs with
a dormant SDK and cannot pass the control plane's observation readiness probes.

## The Dudulemon fixture

`src/lib/fixture/` generates the dataset from a seeded PRNG. The same definition
produces byte-identical rows and a byte-identical manifest on every machine, so
the base runtime and a candidate runtime can prove they hold the same approved
data.

- Fixture clock: **2026-09-14T09:00:00Z**, a Monday. `Last 30 days` is
  2026-08-16 to 2026-09-14.
- History: 120 days, so data exists inside and outside every preset.
- Dimensions: 12 products, 7 channels, 7 demographic segments, 6 review topics,
  4 conversion states.
- Adjacent data is deliberate. `TikTok Shop` neighbours `TikTok`,
  `Women 18-24` and `Women 35-44` bracket `Women 25-34`, and `Fit consistency`
  neighbours `Sizing`, so an incorrectly restored filter shows visibly different
  rows instead of a plausible subset. `src/lib/fixture/invariants.ts` checks
  these properties during generation and fails the build if they disappear.
- Reviewer names, emails and locations are shape-preserving synthetic values on
  the reserved `example.com` domain.

Seed manifest hash:

```
sha256:eee893377d423c2cade8778ff03e0060c75e59308f6350851bec21c08a87d51f
```

Seeding regenerates the dataset, compares its manifest against the committed
one, installs the rows in a single transaction, verifies the stored row counts,
and records the identity in the `fixture_manifest` table. Any mismatch aborts the
seed; a drifted dataset is never presented as the approved one.

### Filter semantics

Date range, channel and demographic segment restrict conversion rows directly.
Review topic and sentiment qualify **products**: a product is in the slice when
it has a matching review in the same date range. The conversion state selects
which cohort the displayed series counts, so `Purchased` plots the conversion
rate and a drop-off state plots that drop-off rate over the same denominator.
`src/lib/db/types.ts` is the source of truth for this.

## uTrace integration points

- **`GET /api/health`** reports database readiness and the installed manifest
  identity, and compares it with `SHOPALYTICS_FIXTURE_MANIFEST_HASH`. It is the
  only route the front door reaches without a route context.
- **`src/proxy.ts`** verifies `x-utrace-route-context` in the preview profile
  against `x-forwarded-host`, the session origin the front door forwards. The
  claim set is `utrace_preview_route_v1`.
- **`POST /api/utrace/preview-handoff`** exchanges a one-time signed handoff
  token for the Dudulemon growth lead's session. Preview profile only; 404 in
  production. Single use is enforced by a primary key in
  `utrace_preview_handoff_consumption`, so a replay loses even across processes.
  `src/lib/utrace/preview-handoff.ts` and `src/lib/server/preview-session.ts`
  document both token formats.
- **`src/lib/utrace/chart-state.ts`** publishes applied filter values, the
  displayed series identity and rendering completion at
  `window.__shopalyticsChartState`. The browser SDK's annotations read it; this
  repository has no SDK dependency.
- **`src/lib/utrace/preview-gate.tsx`** is the browser extension point. It is
  the browser SDK's `UTraceGate`, mounted as the outermost client component in
  `src/app/layout.tsx`: in the preview profile it starts the activation gate
  during the first client module evaluation and withholds the application
  subtree until the observation runtime is ready, so the beginning of the
  workflow cannot escape observation. A failed activation renders the blocked
  surface; the application never boots as an unobserved substitute.
- **`src/lib/utrace/chart-state-reporter.tsx`** records the chart-state channel's
  three facts as registered uTrace milestones, so the conversion display is
  observed rather than inferred from an API response or a spoken confirmation.
- **`utrace/utrace.annotations.json`** is the annotation declaration: the
  surfaces, entities, targets, visual targets, milestones and safe-value rules
  this release grants. `npm run utrace:manifest` compiles it with the browser
  SDK's own toolchain, which fails closed on an unknown annotation attribute or
  an attribute that names an undeclared definition, and signs it.
- **`scripts/utrace/server-manifest.ts`** is the server instrumentation
  manifest: the registered routes and operations, the `pg` database class for
  the fixture schema, and the health-check and static-asset noise that is never
  product evidence.
- **`utrace/preload.mjs`** is the server extension point: `node --import` runs it
  before any application module so `@utrace/server-sdk/preload` owns the
  OpenTelemetry provider. A missing package fails start-up rather than starting
  an uninstrumented preview.

### The vendored SDKs

`vendor/` holds `npm pack` tarballs of `@utrace/browser-sdk`, `@utrace/server-sdk`
and `@utrace/contracts`, installed through `file:` dependencies. **This is a demo
distribution shortcut, not how a client installs the SDK.** A template image build of
this repository has no access to the uTrace monorepo and no registry to fetch
from, so the packages are committed here; a real client installs published
packages and pins them like any other dependency. `@utrace/contracts` is a
development dependency: it is vendored for parity with a real client install,
and nothing in the product imports it.

`npm run utrace:vendor -- --monorepo /path/to/uTrace` rebuilds and re-packs all
three from a uTrace checkout. Nothing else in this repository knows where that
checkout is.

### Manifests

```bash
npm run utrace:manifest      # compile and sign both manifests into build/utrace/
```

Both manifests are signed with a development key generated on first run.
uTrace holds the release keys, so a manifest signed here is usable only by a
preview whose environment names this key as its trust anchor:
`UTRACE_SERVER_MANIFEST_TRUST_ANCHOR` for the server half, and the packaged
public key in the browser SDK for the browser half. `build/` is git-ignored;
the prepared-preview environment supplies the real manifests.

## The uTrace runtime template

`deploy/vercel/` holds the Dockerfile and supervisor for the Vercel Sandbox
runtime: Postgres 17 and the built application in one sandbox. uTrace builds the
image for `linux/amd64`, pushes it to the Vercel Container Registry, and takes
the template snapshot from a sandbox created from it; its
`apps/api/scripts/build_preview_template.py` owns that pipeline. Vercel Sandbox
does not run the image's entrypoint, so the control plane starts
`/usr/local/bin/shopalytics-supervisor` with a detached root command.

The build generates, seeds and verifies the fixture, so a sandbox created from
the image starts with the approved dataset already installed. A preview image
must be built with `--build-arg UTRACE_PROFILE=preview`,
`--build-arg UTRACE_SDK_INSTALLATION_ID=...` and
`--build-arg UTRACE_CLIENT_RELEASE_ID=...`, because the browser activation gate
is part of the build output.

At start-up the supervisor requires `SHOPALYTICS_SEED_TARGET` (`base` or
`candidate`) and `UTRACE_PROFILE`, plus the three preview secrets when the
profile is `preview`. `base` uses the dataset baked into the image; `candidate`
reinstalls the same manifest identity so the runtime records that it is a
candidate. It then starts Postgres, starts the application on port 3300, and
waits for `GET /api/health` before reporting readiness.

## Layout

```
db/schema.sql                     fixture schema, applied by the seeding script
deploy/vercel/                    Vercel Sandbox runtime template
fixtures/dudulemon/manifest.json  the pinned dataset identity
scripts/db/setup.ts               seeding entry point
scripts/fixtures/generate.ts      manifest generation
src/lib/fixture/                  deterministic dataset, clock, manifest, install
src/lib/utrace/                   profiles, the activation gate, chart state, token formats
scripts/utrace/                   the vendoring and manifest pipelines
utrace/utrace.annotations.json    the annotation declaration
vendor/                           packed uTrace SDK tarballs (demo shortcut)
src/components/dashboard/         the conversion dashboard and its filter stack
tests/unit/                       npm test
tests/database/                   npm run test:db
utrace/preload.mjs                server SDK preload entry point
```
