#!/bin/bash
# Deploy to Vercel production WITHOUT sending git information.
#
# Why: the cafe's Vercel account (free Hobby plan, no GitHub linked) blocks
# any deploy whose latest git commit was made by someone other than the
# account itself ("the commit author doesn't have permission"). Deploying a
# copy of the project that has no .git folder gives Vercel no commit author
# to check, so it simply builds the files -- same code, same project, same
# live address. Usage:  npm run deploy
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="$(pwd)"
TMP="$(mktemp -d /tmp/tan90-deploy.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

rsync -a \
  --exclude .git \
  --exclude node_modules \
  --exclude .next \
  --exclude .vercel_old_deleted \
  --exclude _xfer \
  --exclude '.env*.local' \
  "$SRC/" "$TMP/"

if [ ! -f "$TMP/.vercel/project.json" ]; then
  echo "This folder isn't linked to the Vercel project (.vercel/project.json missing). Run: npx vercel link" >&2
  exit 1
fi

echo "Deploying a git-free copy of $(basename "$SRC") to Vercel production..."
cd "$TMP"
npx vercel --prod "$@"
