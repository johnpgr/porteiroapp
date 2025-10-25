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
COPY packages/common/package.json packages/common/
COPY apps/nextjs/package.json apps/nextjs/

RUN pnpm install --filter @porteiroapp/common... --filter @porteiroapp/porteiro-site... --frozen-lockfile

FROM base AS build

WORKDIR /app
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/patches ./patches
COPY packages ./packages
COPY apps/nextjs ./apps/nextjs

RUN rm -rf apps/nextjs/node_modules
RUN pnpm --filter @porteiroapp/common build

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @porteiroapp/porteiro-site build
RUN pnpm prune --prod

FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

WORKDIR /app/apps/nextjs

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages /app/packages
COPY --from=build /app/apps/nextjs/.next ./.next
COPY --from=build /app/apps/nextjs/public ./public
COPY --from=build /app/apps/nextjs/package.json ./package.json
COPY --from=build /app/apps/nextjs/next.config.ts ./next.config.ts
COPY --from=build /app/apps/nextjs/middleware.ts ./middleware.ts
COPY --from=build /app/apps/nextjs/tsconfig.json ./tsconfig.json
COPY --from=build /app/apps/nextjs/postcss.config.mjs ./postcss.config.mjs
COPY --from=build /app/apps/nextjs/app.json ./app.json
COPY --from=build /app/apps/nextjs/eas.json ./eas.json
COPY --from=build /app/apps/nextjs/env.d.ts ./env.d.ts
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=build /app/pnpm-lock.yaml /app/pnpm-lock.yaml
COPY --from=build /app/package.json /app/package.json

EXPOSE 3000

CMD ["node", "../node_modules/next/dist/bin/next", "start", "-p", "3000"]
