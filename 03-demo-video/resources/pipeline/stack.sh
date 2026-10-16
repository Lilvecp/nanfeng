#!/usr/bin/env bash
# Local NanFeng stack for recording the demo video: quant :8100, backend :8000, agent :8200, web :3100.
# Sandbox OTP (482913), demo build, local anchoring. No provider keys: the agent uses its stand-ins.
# Usage: ./stack.sh up | down | web-build
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../04-source-code" && pwd)"
RUN="$(cd "$(dirname "$0")" && pwd)/.stack"
mkdir -p "$RUN"

export NANFENG_DEMO=true
export NANFENG_OTP_MODE=sandbox
export NANFENG_SANDBOX_OTP=482913
export NANFENG_ANCHOR_BACKEND="${NANFENG_ANCHOR_BACKEND:-local}"
export NANFENG_SANDBOX_IDLE_RESET_S=0
export NANFENG_QUANT_URL=http://localhost:8100
export NANFENG_BACKEND_URL=http://localhost:8000
export NANFENG_COCKPIT_URL=http://localhost:3100
export NANFENG_CORS_ORIGINS='["http://localhost:3100"]'
export NANFENG_DATABASE_URL="sqlite:///$RUN/nanfeng.db"
[ -f "$RUN/agent_token" ] || python3 -c "import secrets; print(secrets.token_urlsafe(32))" > "$RUN/agent_token"
[ -f "$RUN/session_secret" ] || python3 -c "import secrets; print(secrets.token_urlsafe(32))" > "$RUN/session_secret"
NANFENG_AGENT_TOKEN="$(cat "$RUN/agent_token")"; export NANFENG_AGENT_TOKEN
NANFENG_SESSION_SECRET="$(cat "$RUN/session_secret")"; export NANFENG_SESSION_SECRET

start() { # name dir cmd...
  local name=$1 dir=$2; shift 2
  (cd "$dir" && nohup "$@" > "$RUN/$name.log" 2>&1 & echo $! > "$RUN/$name.pid")
}

case "${1:-up}" in
  up)
    start quant "$ROOT/quant" .venv/bin/uvicorn nanfeng_quant.api:app --port 8100
    start backend "$ROOT/backend" .venv/bin/uvicorn app.main:app --port 8000
    start agent "$ROOT/agent" .venv/bin/uvicorn nanfeng_agent.service:app --port 8200
    start web "$ROOT/web" env NEXT_PUBLIC_API_URL=http://localhost:8000 NEXT_PUBLIC_AGENT_URL=http://localhost:8200 npx next start -p 3100
    echo "logs in $RUN"
    ;;
  down)
    for p in "$RUN"/*.pid; do [ -f "$p" ] && kill "$(cat "$p")" 2>/dev/null || true; rm -f "$p"; done
    # npx and uvicorn may leave children behind: free the ports as well
    fuser -k 8100/tcp 8000/tcp 8200/tcp 3100/tcp >/dev/null 2>&1 || true
    ;;
  web-build)
    cd "$ROOT/web" && NEXT_PUBLIC_API_URL=http://localhost:8000 NEXT_PUBLIC_AGENT_URL=http://localhost:8200 npx next build
    ;;
esac
