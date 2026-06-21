# --- build stage ---
FROM node:22-bookworm-slim AS build
WORKDIR /app
# install all workspace deps (need dev deps to build)
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
# sources
COPY shared/ shared/
COPY server/ server/
COPY web/ web/
RUN npm run build -w @funkparcours/shared \
 && npm run build -w @funkparcours/server \
 && npm run build -w @funkparcours/web

# --- runtime stage ---
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
RUN npm ci --omit=dev -w @funkparcours/shared -w @funkparcours/server && npm cache clean --force
# built artifacts
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/drizzle server/drizzle
COPY --from=build /app/web/dist web/dist
EXPOSE 3000
# migrate then start (compiled migrate runner lives in dist)
CMD ["sh", "-c", "node server/dist/db/migrate.js && node server/dist/server.js"]
