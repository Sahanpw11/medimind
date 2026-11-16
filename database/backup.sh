#!/usr/bin/env bash
# Backup medimind_db to a compressed archive.
#   Local (Docker):  ./database/backup.sh
#   Remote MongoDB: MONGODB_URI="mongodb://host/..." ./database/backup.sh   (requires mongodump on PATH)
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${MONGODB_DB:-medimind_db}"
OUT="backups/${DB}-$(date -u +%Y%m%dT%H%M%SZ).archive.gz"
mkdir -p backups
if [[ -n "${MONGODB_URI:-}" && "${MONGODB_URI}" != mongodb://localhost* ]]; then
  mongodump --uri="$MONGODB_URI" --db="$DB" --gzip --archive="$OUT"
else
  docker compose exec -T mongo mongodump --db="$DB" --gzip --archive > "$OUT"
fi
echo "Backup written: $OUT ($(du -h "$OUT" | cut -f1))"
echo "$OUT" > backups/LATEST
