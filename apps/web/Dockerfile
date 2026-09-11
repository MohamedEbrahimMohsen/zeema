# Arkore web: one container, migrations run at boot, curated designs seeded on an empty store.
# Build from the repository root:  docker build -f apps/web/Dockerfile -t arkore-web .
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
RUN pnpm --filter @arkore/web build

FROM node:22-alpine AS run
WORKDIR /repo
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build /repo /repo
# The catalogue files stay in the image: the server reads kinds/, components/, rules/ and
# designs/ for seeding and the bundle is already built under apps/web/public/catalogue.
EXPOSE 3000
CMD ["sh", "-c", "cd apps/web && node node_modules/next/dist/bin/next start -p ${PORT}"]
