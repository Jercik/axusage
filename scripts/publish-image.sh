#!/usr/bin/env bash
# ==============================================================================
# publish-image.sh - Build and push axusage container image (multi-arch)
#
# Usage:
#   ./scripts/publish-image.sh [options]
#
# Options:
#   --version <ver>  Override version (default: latest from npm registry)
#   --platform <p>   Target platforms (default: linux/amd64,linux/arm64)
#   --no-latest      Don't tag as :latest (default: tag :latest on main branch)
#   --dry-run        Build but don't push
#   --help           Show this help
#
# Prerequisites:
#   - podman or docker installed
#   - skopeo installed (for Zot registry compatibility)
#   - Logged in to registry: podman login registry.j4k.dev
# ==============================================================================

set -euo pipefail

REGISTRY="${REGISTRY:-registry.j4k.dev}"
IMAGE_NAME="${IMAGE_NAME:-axusage}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# All log functions write to stderr to avoid interfering with function returns
log_info() { echo -e "${BLUE}INFO:${NC} $*" >&2; }
log_success() { echo -e "${GREEN}SUCCESS:${NC} $*" >&2; }
log_warn() { echo -e "${YELLOW}WARN:${NC} $*" >&2; }
log_error() { echo -e "${RED}ERROR:${NC} $*" >&2; }

# Detect container runtime (prefer podman for OCI compliance)
detect_runtime() {
    if command -v podman &>/dev/null; then
        # On macOS/Windows, verify podman can connect (machine must be running)
        if [[ "$(uname)" == "Darwin" ]] || [[ "$(uname)" =~ MINGW|MSYS ]]; then
            if ! podman info &>/dev/null; then
                log_warn "Podman not connected, trying to start machine (this may take a moment)..."
                podman machine start 2>/dev/null || true
                # Verify podman now works
                if ! podman info &>/dev/null; then
                    log_error "Failed to connect to Podman. Run 'podman machine start' manually."
                    exit 1
                fi
            fi
        fi
        echo "podman"
    elif command -v docker &>/dev/null; then
        echo "docker"
    else
        log_error "Neither podman nor docker found in PATH"
        exit 1
    fi
}

# Get latest version from npm registry
get_version() {
    local version
    version=$(npm view axusage version 2>/dev/null)
    if [[ -z "$version" ]]; then
        log_error "Could not fetch version from npm registry"
        exit 1
    fi
    echo "$version"
}

# Check if on main branch
is_main_branch() {
    local branch
    branch=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    [[ "$branch" == "main" || "$branch" == "master" ]]
}

# Show help (exit code defaults to 0, pass 2 for usage error)
show_help() {
    sed -n '2,/^# ==/p' "$0" | sed 's/^# //' | sed 's/^#//'
    exit "${1:-0}"
}

# Main
main() {
    local version=""
    local platforms="linux/amd64,linux/arm64"
    local skip_latest=false
    local dry_run=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --version)
                if [[ $# -lt 2 || -z "${2:-}" ]]; then
                    log_error "--version requires a value"
                    exit 2
                fi
                version="$2"
                shift 2
                ;;
            --platform)
                if [[ $# -lt 2 || -z "${2:-}" ]]; then
                    log_error "--platform requires a value"
                    exit 2
                fi
                platforms="$2"
                shift 2
                ;;
            --no-latest)
                skip_latest=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --help|-h)
                show_help
                ;;
            *)
                log_error "Unknown option: $1"
                show_help 2
                ;;
        esac
    done

    # Detect runtime
    local runtime
    runtime=$(detect_runtime)
    log_info "Using container runtime: $runtime"

    # Get version
    if [[ -z "$version" ]]; then
        version=$(get_version)
    fi
    if [[ -z "$version" ]]; then
        log_error "Could not determine version from npm registry"
        exit 1
    fi
    log_info "Version: $version"

    # Determine if we should tag latest (default: yes on main branch)
    local should_tag_latest=false
    if ! $skip_latest && is_main_branch; then
        should_tag_latest=true
        log_info "On main branch, will also tag as :latest"
    fi

    # Full image references
    local image_versioned="$REGISTRY/$IMAGE_NAME:$version"
    local image_latest="$REGISTRY/$IMAGE_NAME:latest"

    # Common build args
    local build_labels=(
        --label "org.opencontainers.image.version=$version"
        --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        --label "org.opencontainers.image.revision=$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
    )

    cd "$PROJECT_DIR"

    # Build multi-arch images
    log_info "Building multi-arch image for platforms: $platforms"

    # Convert comma-separated platforms to array
    IFS=',' read -ra platform_list <<< "$platforms"

    # Remove any existing manifest
    $runtime manifest rm "$image_versioned" 2>/dev/null || true

    # Build for each platform and add to manifest
    for platform in "${platform_list[@]}"; do
        local arch="${platform#*/}"  # Extract arch from linux/amd64 -> amd64
        arch="${arch//\//-}"  # Replace slashes with dashes for variants like arm/v7 -> arm-v7
        local platform_tag="$image_versioned-$arch"

        log_info "Building for $platform..."
        local output_flag=""
        if [[ "$runtime" == "docker" ]] && ! $dry_run; then
            output_flag="--push"
        fi
        $runtime build \
            -f Containerfile \
            --platform "$platform" \
            --build-arg "VERSION=$version" \
            "${build_labels[@]}" \
            $output_flag \
            -t "$platform_tag" \
            .

        log_success "Built: $platform_tag"
    done

    # Push
    if $dry_run; then
        log_warn "Dry run - skipping push"
        log_info "Would push: $image_versioned"
        if $should_tag_latest; then
            log_info "Would push: $image_latest"
        fi
    else
        log_info "Pushing to $REGISTRY..."

        # Push platform-specific images first (required for manifest list)
        # Skip for docker since --push already handled it during build
        if [[ "$runtime" != "docker" ]]; then
            for platform in "${platform_list[@]}"; do
                local arch="${platform#*/}"
                arch="${arch//\//-}"
                log_info "Pushing platform image: $image_versioned-$arch"
                $runtime push "$image_versioned-$arch"
            done
        fi

        # Delete existing manifest if present (Zot registry requires this
        # to replace a single-arch manifest with a manifest list)
        if command -v skopeo &>/dev/null; then
            skopeo delete "docker://$image_versioned" 2>/dev/null || true
            if $should_tag_latest; then
                skopeo delete "docker://$image_latest" 2>/dev/null || true
            fi
        fi

        # Create manifest list from REMOTE images to avoid digest mismatch
        log_info "Creating manifest: $image_versioned"
        $runtime manifest rm "$image_versioned" 2>/dev/null || true
        local remote_manifest_args=()
        for platform in "${platform_list[@]}"; do
            local arch="${platform#*/}"
            arch="${arch//\//-}"
            remote_manifest_args+=("docker://$image_versioned-$arch")
        done
        $runtime manifest create "$image_versioned" "${remote_manifest_args[@]}"
        $runtime manifest push "$image_versioned"
        log_success "Pushed: $image_versioned"

        if $should_tag_latest; then
            log_info "Creating manifest: $image_latest"
            $runtime manifest rm "$image_latest" 2>/dev/null || true
            $runtime manifest create "$image_latest" "${remote_manifest_args[@]}"
            $runtime manifest push "$image_latest"
            log_success "Pushed: $image_latest"
        fi

        # Clean up local platform-specific images
        for platform in "${platform_list[@]}"; do
            local arch="${platform#*/}"
            arch="${arch//\//-}"
            $runtime rmi "$image_versioned-$arch" 2>/dev/null || true
        done
    fi

    # Summary
    echo "" >&2
    log_success "Done!"
    echo "  Image: $image_versioned" >&2
    echo "  Platforms: $platforms" >&2
    if $should_tag_latest; then
        echo "  Latest: $image_latest" >&2
    fi
}

main "$@"
