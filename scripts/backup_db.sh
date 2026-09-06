#!/usr/bin/env bash
# ==============================================================================
# Automated Zero-Cost Production PostgreSQL Backup Script
# Retention: 14 Days
# Usage: ./scripts/backup_db.sh
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="${POSTGRES_DB:-nec_leetcode_prod}"
DB_USER="${POSTGRES_USER:-nec_admin}"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[BACKUP] Starting PostgreSQL backup for database: ${DB_NAME} at $(date)"

# Perform consistent custom pg_dump compressed with gzip
pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists --no-owner --no-privileges | gzip > "${BACKUP_FILE}"

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[BACKUP] ✅ Backup completed successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Retain only last 14 days of backups
echo "[BACKUP] Purging backups older than 14 days..."
find "${BACKUP_DIR}" -name "${DB_NAME}_backup_*.sql.gz" -type f -mtime +14 -delete

echo "[BACKUP] Backup cycle finished cleanly."
