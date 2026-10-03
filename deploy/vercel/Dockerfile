# The uTrace preview runtime template for the Shopalytics demo fixture.
#
# One sandbox runs Postgres 17 and the built Next.js application. uTrace builds
# this image for linux/amd64, pushes it to the Vercel Container Registry, and
# pins its digest; a template snapshot is then taken from a sandbox created from
# it. Vercel Sandbox does not run an image's ENTRYPOINT or CMD, so the control
# plane starts the supervisor with a detached sandbox command.
#
# The fixture is generated, seeded and verified during the build, so a sandbox
# created from this image starts with the approved dataset already installed and
# reaches health in seconds instead of seeding on every claim.
#
# Build arguments:
#   UTRACE_PROFILE                production (default) or preview. The browser
#                                 activation gate is part of the build output, so
#                                 a preview runtime must be built with preview
#                                 and started with preview.
#   UTRACE_SDK_INSTALLATION_ID    the public SDK installation id this release was
#                                 integrated under. Required when
#                                 UTRACE_PROFILE=preview; the build fails without
#                                 it rather than producing a preview that boots
#                                 unobserved.
#   UTRACE_CLIENT_RELEASE_ID      the release the signed annotation manifest was
#                                 compiled for. Required when
#                                 UTRACE_PROFILE=preview.
#
# Runtime environment: see README.md, section "Environment".

FROM postgres:17-bookworm

# The official image declares a volume on /var/lib/postgresql/data, and writes
# to a volume are discarded during a build. The fixture cluster therefore lives
# outside it so the seeded data is part of the image.
ENV PGDATA=/srv/pgdata \
    POSTGRES_DB=shopalytics \
    POSTGRES_USER=shopalytics \
    NODE_ENV=production \
    PORT=3300 \
    SHOPALYTICS_DATABASE_SCHEMA=shopalytics_fixture \
    SHOPALYTICS_FIXTURE_CLOCK=2026-09-14T09:00:00Z \
    DATABASE_SSL=false

ARG UTRACE_PROFILE=production
ARG UTRACE_SDK_INSTALLATION_ID=""
ARG UTRACE_CLIENT_RELEASE_ID=""
ENV UTRACE_PROFILE=${UTRACE_PROFILE} \
    NEXT_PUBLIC_UTRACE_PROFILE=${UTRACE_PROFILE} \
    NEXT_PUBLIC_UTRACE_SDK_INSTALLATION_ID=${UTRACE_SDK_INSTALLATION_ID} \
    NEXT_PUBLIC_UTRACE_CLIENT_RELEASE_ID=${UTRACE_CLIENT_RELEASE_ID}

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

# The Vercel Sandbox SDK extracts file uploads inside /vercel/sandbox, which
# Vercel's default image has and a custom image must provide.
RUN mkdir -p /vercel/sandbox

WORKDIR /srv/shopalytics

# --include=dev is explicit because NODE_ENV=production otherwise makes npm omit
# the development dependencies the build and the seeding script need.
# The uTrace SDKs are vendored tarballs referenced by `file:` specifiers, so the
# lockfile cannot be installed without them. They are copied before `npm ci` and
# apart from the rest of the source, so a change anywhere else still reuses this
# layer.
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci --include=dev --no-audit --no-fund

COPY . .

# The build output carries the uTrace profile, so it is produced before the
# database exists and never reads customer data.
RUN npm run build

# Create the cluster, install the fixture, and stop cleanly. A failure here
# fails the image build rather than producing a runtime that starts empty.
RUN mkdir -p "$PGDATA" /run/postgresql \
 && chown -R postgres:postgres "$PGDATA" /run/postgresql \
 && su postgres -c "initdb -D $PGDATA --username=$POSTGRES_USER --auth=trust --encoding=UTF8" \
 && su postgres -c "pg_ctl -D $PGDATA -o '-c listen_addresses=127.0.0.1 -p 5432' -w start" \
 && su postgres -c "createdb -h 127.0.0.1 -U $POSTGRES_USER $POSTGRES_DB" \
 && SHOPALYTICS_BASE_DATABASE_URL="postgres://$POSTGRES_USER@127.0.0.1:5432/$POSTGRES_DB" \
    DATABASE_SSL=false npm run db:seed:base \
 && su postgres -c "pg_ctl -D $PGDATA -m fast -w stop" \
 && chown -R postgres:postgres "$PGDATA"

# The runtime reports what it was built from; `GET /api/health` compares it with
# the manifest identity the database actually holds.
RUN SHOPALYTICS_FIXTURE_MANIFEST_HASH="$(node -p "require('./fixtures/dudulemon/manifest.json').content_hash")" \
 && echo "SHOPALYTICS_FIXTURE_MANIFEST_HASH=$SHOPALYTICS_FIXTURE_MANIFEST_HASH" > /srv/shopalytics/.build-identity

COPY deploy/vercel/supervisor.sh /usr/local/bin/shopalytics-supervisor
RUN chmod +x /usr/local/bin/shopalytics-supervisor

EXPOSE 3300
