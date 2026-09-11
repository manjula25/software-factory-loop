FROM python:3.12-slim

# System dependencies: git, curl, jq, and the GitHub CLI (gh apt repo — not in
# Debian main).
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    jq \
    ca-certificates \
    gnupg \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Node 22 — copied from the official image (no NodeSource apt detour).
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# Python test tooling for target repos.
RUN pip install --no-cache-dir pytest

# Build-args for UID/GID alignment: `sandcastle docker build-image` defaults
# these to the host user's UID/GID so image-built and bind-mounted files share
# an owner without runtime chown.
ARG AGENT_UID=1000
ARG AGENT_GID=1000

# Non-root agent user.
RUN groupadd -o -g $AGENT_GID agent \
    && useradd -o -u $AGENT_UID -g $AGENT_GID -m -s /bin/bash agent

# Agent CLIs, installed as the agent user into its local bin.
USER agent
WORKDIR /home/agent
ENV PATH="/home/agent/.local/bin:${PATH}"
RUN curl -fsSL https://claude.ai/install.sh | bash
RUN npm install -g @openai/codex opencode-ai --prefix /home/agent/.local

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at
# /home/agent/workspace and overrides the working directory there at start.
ENTRYPOINT ["sleep", "infinity"]
