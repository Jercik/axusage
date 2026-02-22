# ==============================================================================
# axusage Containerfile (OCI-compliant)
# Multi-stage build compatible with Docker and Podman
#
# Build (latest version):
#   docker build -f Containerfile -t axusage .
#   podman build -t axusage .
#
# Build (specific version):
#   docker build -f Containerfile --build-arg VERSION=1.2.3 -t axusage:1.2.3 .
#   podman build --build-arg VERSION=1.2.3 -t axusage:1.2.3 .
#
# Run (with external UID):
#   docker run -p 3848:3848 -u 1000:1000 -e AXUSAGE_SOURCES='...' axusage
#   podman run -p 3848:3848 --user 1000:1000 -e AXUSAGE_SOURCES='...' axusage
#
# Design: External UID pattern
#   - No USER directive in image (runs as root by default)
#   - Orchestration layer (Quadlet, Compose, K8s) specifies runtime user
#   - Stateless — no volumes needed
#
# Health checks: Defined at orchestration layer (Quadlet, Compose, K8s probes)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Install
# Fetch axusage from npm (no native modules, no build tools needed)
# ------------------------------------------------------------------------------
FROM docker.io/library/node:22-bookworm-slim AS build

# Version to install (default: latest)
ARG VERSION=latest

WORKDIR /app

# Install axusage from npm registry
RUN npm install --omit=dev "axusage@${VERSION}"

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# Slim Node.js image with /usr/bin/env for CLI shebang support
# ------------------------------------------------------------------------------
FROM docker.io/library/node:22-bookworm-slim AS runtime

WORKDIR /app

# Copy installed package from build stage
COPY --from=build /app/node_modules ./node_modules

# Environment variables with sensible defaults for container deployment
ENV NODE_ENV=production \
    AXUSAGE_HOST=0.0.0.0 \
    AXUSAGE_PORT=3848 \
    AXUSAGE_INTERVAL=300 \
    PATH="/app/node_modules/.bin:${PATH}"

# Expose the default port
EXPOSE 3848

# OCI image labels (https://github.com/opencontainers/image-spec/blob/main/annotations.md)
LABEL org.opencontainers.image.title="axusage" \
      org.opencontainers.image.description="API usage monitoring server for a╳kit ecosystem" \
      org.opencontainers.image.url="https://github.com/Jercik/axusage" \
      org.opencontainers.image.source="https://github.com/Jercik/axusage" \
      org.opencontainers.image.vendor="a╳kit" \
      org.opencontainers.image.licenses="MIT"

# Start server
CMD ["node", "/app/node_modules/axusage/bin/axusage", "serve"]
