FROM node:24-bookworm-slim AS build
RUN npm install -g pnpm@11.25.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv nginx tini ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /usr/local/bin/uv
WORKDIR /app
COPY --from=build /app /app
RUN uv sync --project workers/imaging --locked --no-dev --python /usr/bin/python3 && mkdir -p /app/data/cache && chown -R node:node /app/data /var/lib/nginx /var/log/nginx
COPY deploy/nginx.conf /etc/nginx/nginx.conf
ENV NODE_ENV=production API_HOST=127.0.0.1 API_PORT=3000 IMAGING_PYTHON=/app/workers/imaging/.venv/bin/python CACHE_ROOT=/app/data/cache
USER node
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bash", "deploy/start.sh"]
