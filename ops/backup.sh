#!/bin/sh
# A compressed dump of the database, written next to this stack and pruned after KEEP days.
#
# A named volume survives `docker compose down`, a container removed by mistake, and an image
# rebuild. It does not survive a failed disk, a wrong `down -v`, or a bad migration. That is
# what this is for, and a dump you have never restored is not yet a backup: test one.
#
#   ./ops/backup.sh                      write a dump into ./backups
#   BACKUP_DIR=/mnt/x KEEP=60 ./ops/backup.sh
#
# Nightly, from the repository root, via `crontab -e`:
#   15 3 * * * cd /srv/zeema && ./ops/backup.sh >> /var/log/zeema-backup.log 2>&1
#
# Copy the dumps off this machine as well: object storage, or another host over ssh.
#
# To restore into an empty database:
#   gunzip -c backups/zeema-YYYYmmdd-HHMMSS.sql.gz | docker compose exec -T db psql -U zeema -d zeema
set -eu

cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${KEEP:-30}"
USER_NAME="${POSTGRES_USER:-zeema}"
DB_NAME="${POSTGRES_DB:-zeema}"

mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y%m%d-%H%M%S)"
out="$BACKUP_DIR/zeema-$stamp.sql.gz"

# --clean --if-exists makes the dump replayable into a database that already has the schema.
docker compose exec -T db pg_dump -U "$USER_NAME" -d "$DB_NAME" --clean --if-exists \
  | gzip -9 > "$out.partial"
mv "$out.partial" "$out"

size="$(wc -c < "$out")"
if [ "$size" -lt 1024 ]; then
  echo "backup looks empty ($size bytes): $out" >&2
  exit 1
fi
echo "wrote $out ($size bytes)"

find "$BACKUP_DIR" -name 'zeema-*.sql.gz' -type f -mtime "+$KEEP" -print -delete
