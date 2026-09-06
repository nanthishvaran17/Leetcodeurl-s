#!/usr/bin/env bash
# ==============================================================================
# Production Database Safe Restore & Verification Script
# Usage: ./scripts/restore_db.sh <path_to_backup_file.sql.gz>
# ==============================================================================

set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path_to_backup_file.sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"
DB_NAME="${POSTGRES_DB:-nec_leetcode_prod}"
DB_USER="${POSTGRES_USER:-nec_admin}"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "❌ Error: Backup file '${BACKUP_FILE}' does not exist."
    exit 1
fi

echo "[RESTORE] ⚠️  WARNING: Restoring '${BACKUP_FILE}' into '${DB_NAME}'"
echo "[RESTORE] Starting restore at $(date)..."

# Decompress and execute in transaction
gunzip -c "${BACKUP_FILE}" | psql -U "${DB_USER}" -d "${DB_NAME}" --single-transaction

echo "[RESTORE] ✅ Database restore completed."
echo "[RESTORE] Running post-restore integrity check..."

# Verify row counts
STUDENTS_COUNT=$(psql -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM students WHERE is_active=true;" | xargs)
echo "[RESTORE] Active Students in Database: ${STUDENTS_COUNT}"

if [ "${STUDENTS_COUNT}" -eq 318 ]; then
    echo "[RESTORE] ✅ 318/318 Master Roster Students verified successfully!"
else
    echo "[RESTORE] ⚠️  Warning: Found ${STUDENTS_COUNT} students (expected 318)."
fi
