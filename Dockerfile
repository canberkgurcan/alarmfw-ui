# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app

# Build-time env (artık NEXT_PUBLIC_ALARMFW_API_KEY yok — proxy mimarisi ile gizli tutulur)
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_OBSERVE_URL=http://localhost:8001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_OBSERVE_URL=${NEXT_PUBLIC_OBSERVE_URL}

COPY package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install

COPY . .
RUN --mount=type=cache,target=/root/.npm \
    npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
