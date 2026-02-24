FROM node:22-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ffmpeg \
    unzip \
    zip \
    awscli \
    ca-certificates \
    openssh-client \
    rsync \
    sshpass \
    python3 \
    python3-pip \
  && rm -rf /var/lib/apt/lists/*

# Debian bookworm's yt-dlp package is frequently too old for YouTube.
# Install from PyPI at build time so ingest stays current.
RUN pip3 install --no-cache-dir --break-system-packages --upgrade yt-dlp

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY config ./config
COPY docs ./docs
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

CMD ["pnpm", "-C", "apps/control-api", "dev"]
