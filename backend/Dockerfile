# Build stage (Debian for native better-sqlite3)
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN apt-get update -y && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Run stage
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
# Persist SQLite DB (mount volume at /app/data or set SQLITE_DB_PATH)
ENV SQLITE_DB_PATH=/app/data/mindadapt.db
EXPOSE 4000
CMD ["node", "dist/index.js"]
