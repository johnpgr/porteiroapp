# syntax=docker/dockerfile:1.6

FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS deps

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY .npmrc ./
COPY patches ./patches
COPY packages/supabase/package.json packages/supabase/
COPY apps/interfone-api/package.json apps/interfone-api/

RUN pnpm install --filter @porteiroapp/supabase... --filter @porteiroapp/interfone-api... --frozen-lockfile

FROM base AS build

WORKDIR /app
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/patches ./patches
COPY packages ./packages
COPY apps/interfone-api ./apps/interfone-api

RUN pnpm --filter @porteiroapp/interfone-api build || true
RUN pnpm prune --prod

FROM node:22-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/interfone-api ./apps/interfone-api

EXPOSE 3001

CMD ["node", "apps/interfone-api/src/server.ts"]
