# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY api-a-core/package.json api-a-core/package-lock.json ./
RUN npm ci
COPY api-a-core/ .
# Copy shared directory from root context
COPY shared/ /shared

# --- run stage ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
COPY --from=build /shared /shared
EXPOSE 4000
CMD ["node", "src/app.js"]
