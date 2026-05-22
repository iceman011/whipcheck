# ==========================================
# STAGE 1: BUILD THE APPLICATION
# ==========================================
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy dependency configuration files
COPY package*.json ./

# Install all dependencies (including devDependencies) for compile step
RUN npm ci

# Copy the rest of the application files
COPY . .

# Run production build
# This runs Vite static compilation + Esbuild backend bundling automatically
ENV NODE_ENV=production
RUN npm run build

# Install production dependencies only with fresh clean
RUN rm -rf node_modules && npm ci --only=production

# ==========================================
# STAGE 2: RUN THE APPLIANCE IN PRODUCTION
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Configure secure defaults
ENV NODE_ENV=production
ENV PORT=3000

# Create application system group and run as a non-privileged system user for cloud containers
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

# Copy over production build assets from the previous stage
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Limit permissions to system user
RUN chown -R expressjs:nodejs /app

USER expressjs

# Expose production-ingress port
EXPOSE 3000

# Execute server bundle
CMD ["node", "dist/server.cjs"]
