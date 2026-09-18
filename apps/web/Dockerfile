# Zeema web: one container. Migrations run at boot and the curated designs are seeded into an
# empty store. Build from the repository root:
#   docker build -f apps/web/Dockerfile -t zeema-web .
# or let compose do it:  docker compose up -d --build
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/core/package.json packages/core/
COPY packages/catalogue/package.json packages/catalogue/
COPY packages/cli/package.json packages/cli/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @zeema/web build

FROM node:22-alpine AS run
WORKDIR /repo
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 ZEEMA_ROOT=/repo
# The catalogue files stay in the image: the server reads kinds/, components/, rules/ and
# designs/ for seeding, and the browser bundle is already built under apps/web/public/catalogue.
COPY --from=build --chown=node:node /repo /repo
# Nothing here needs to run privileged; the database is the only writable state.
USER node
EXPOSE 3000
# Readiness is a database round trip, so an unhealthy container means the app cannot serve.
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "cd apps/web && node node_modules/next/dist/bin/next start -p ${PORT}"]
