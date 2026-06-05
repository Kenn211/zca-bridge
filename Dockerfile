FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json* ./
# Install ALL deps (incl. devDeps: typescript + @types/*) so the build can type-check.
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
# Compile, copy non-TS assets into dist (tsc doesn't copy .sql or .html), then drop devDeps.
RUN npx tsc -p tsconfig.json \
    && mkdir -p dist/store/migrations && cp src/store/migrations/*.sql dist/store/migrations/ \
    && mkdir -p dist/admin/public && cp -r src/admin/public/. dist/admin/public/ \
    && npm prune --omit=dev
CMD ["node", "dist/main.js"]
