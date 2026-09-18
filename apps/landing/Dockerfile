# Zeema landing: one tiny container serving a single static page. No dependencies, no
# build step. Build from the repository root:
#   docker build -f apps/landing/Dockerfile -t zeema-landing .
# or let compose do it:  docker compose up -d --build
FROM node:22-alpine
WORKDIR /app
COPY apps/landing/server.mjs ./server.mjs
COPY apps/landing/public ./public
ENV LANDING_PORT=4000
EXPOSE 4000
# node:22-alpine ships no shell for CMD-SHELL, so the compose healthcheck uses node directly.
CMD ["node", "server.mjs"]
