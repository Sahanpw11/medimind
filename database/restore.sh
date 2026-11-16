#!/usr/bin/env bash
# Restore the latest (or given) archive into a SEPARATE database so the source is never overwritten.
#   ./database/restore.sh [archive]      -> restores into medimind_restore_test
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${MONGODB_DB:-medimind_db}"; TARGET="${RESTORE_DB:-medimind_restore_test}"
FILE="${1:-$(cat backups/LATEST)}"
[[ -f "$FILE" ]] || { echo "Archive not found: $FILE" >&2; exit 1; }
docker compose exec -T mongo mongorestore --gzip --archive --drop --nsFrom="${SRC}.*" --nsTo="${TARGET}.*" < "$FILE"
echo "Restored $FILE into $TARGET"
