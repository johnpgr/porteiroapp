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

# Install only what this app needs
RUN pnpm install --filter @porteiroapp/supabase... --filter @porteiroapp/interfone-api... --prod --frozen-lockfile

FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Only what is needed to run
COPY --from=deps /app/node_modules ./node_modules
COPY packages ./packages
COPY apps/interfone-api ./apps/interfone-api

EXPOSE 3001

CMD ["node", "apps/interfone-api/src/server.ts"]
