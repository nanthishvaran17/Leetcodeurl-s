# Oracle Cloud Always Free (₹0/Month) Master Production Migration & Hardening Guide

## 1. Executive Summary & Architecture

| Layer | Previous (Cloud) | Target Production (₹0 / Always Free) | Protocol / Port |
| :--- | :--- | :--- | :--- |
| **Frontend** | Vercel Free / Hobby | **Vercel Free / Hobby** (Unchanged) | HTTPS (Port 443) |
| **Edge / Gateway** | Render Default Routing | **Nginx Reverse Proxy + Let's Encrypt TLS** | Ports 80, 443 |
| **Compute VM** | Render Free Tier (Spin-down limits) | **Oracle Cloud Always Free VM** (`VM.Standard.A1.Flex` / `VM.Standard.E2.1.Micro`) | Internal Docker Bridge |
| **Application API** | FastAPI Backend | **FastAPI (Uvicorn / Docker)** | `127.0.0.1:8000` |
| **Live Sync Workers** | In-process timer | **Dedicated Background Sync Worker Container** | Isolated Worker Pool |
| **Database** | Render Managed PostgreSQL | **Self-Hosted PostgreSQL 16 (Alpine Docker)** | `127.0.0.1:5432` (Internal Only) |
| **Realtime Gateway** | WebSocket via Render | **Nginx WebSocket Upgrade (`/ws/`) to FastAPI** | WSS / WS |
| **Monthly Cost** | **₹0.00** | **₹0.00 (Strictly Always Free Eligible)** | **₹0.00 / Month** |

---

## 2. Oracle Cloud Always Free Provisioning (Rule #1: ₹0)

### Eligible Shapes & Quotas:
- **Recommended**: Ampere A1 Compute (`VM.Standard.A1.Flex`)
  - **OCPU**: 2 OCPU (Always Free tenancy allowance is up to 4 OCPU)
  - **RAM**: 12 GB RAM (Always Free tenancy allowance is up to 24 GB)
  - **Boot Volume**: 50 GB to 100 GB (Always Free allows up to 200 GB total)
  - **OS**: Ubuntu 22.04 LTS or 24.04 LTS (AArch64)
- **Alternative**: AMD Micro (`VM.Standard.E2.1.Micro`)
  - **OCPU**: 1 OCPU
  - **RAM**: 1 GB RAM

> [!IMPORTANT]
> Always verify in the Oracle Cloud Console that the shape is labeled **"Always Free Eligible"** with a distinct gray/green badge before clicking "Create".

### Network Security & Port Exposure (Rule: Least Privilege):
1. **Publicly Exposed Ingress Rules**:
   - `22/TCP` → SSH (Management)
   - `80/TCP` → HTTP (ACME Challenge & HTTPS Redirect)
   - `443/TCP` → HTTPS (Public API & WebSocket)
2. **Blocked / Internal Only Ports**:
   - `5432/TCP` → PostgreSQL (Bound only to internal docker network)
   - `8000/TCP` → FastAPI (Proxied behind Nginx)

---

## 3. Deployment Artifacts & Configuration Files

The following production configurations are prepared in the repository:

1. [`docker-compose.prod.yml`](file:///e:/Leetcode%20Web/docker-compose.prod.yml):
   - `postgres` (PostgreSQL 16 Alpine with internal healthcheck, volume persistence, internal network only)
   - `backend` (FastAPI with Uvicorn, healthcheck on `/health`, internal network)
   - `worker` (Controlled background sync worker pool for 318 students)
   - `nginx` (Nginx Alpine reverse proxy with SSL termination and WebSocket upgrade)
   - `certbot` (Automated Let's Encrypt certificate renewal)
2. [`nginx/nginx.conf`](file:///e:/Leetcode%20Web/nginx/nginx.conf) & [`nginx/conf.d/app.conf`](file:///e:/Leetcode%20Web/nginx/conf.d/app.conf):
   - HTTP to HTTPS redirection
   - WebSocket `/ws/` upgrade headers (`Upgrade $http_upgrade; Connection "upgrade";`) with 7200s timeout for live contest windows
   - Security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
3. [`scripts/backup_db.sh`](file:///e:/Leetcode%20Web/scripts/backup_db.sh):
   - Automated `pg_dump` with gzip compression and 14-day rolling retention
4. [`scripts/restore_db.sh`](file:///e:/Leetcode%20Web/scripts/restore_db.sh):
   - Safe transaction-bound restore with 318-student master roster count verification
5. [`scripts/migrate_postgres.py`](file:///e:/Leetcode%20Web/scripts/migrate_postgres.py):
   - Replicates all tables from Render/SQLite to Oracle PostgreSQL and asserts `Source Count == Dest Count` across all tables.

---

## 4. Database Migration & Row Integrity Verification

### Step 1: Export from Render Database
```bash
pg_dump -U <RENDER_USER> -h <RENDER_HOST> -d <RENDER_DB> --clean --if-exists | gzip > render_prod_backup.sql.gz
```

### Step 2: Transfer Backup to Oracle VM
```bash
scp -i ~/.ssh/oracle_key render_prod_backup.sql.gz ubuntu@<ORACLE_VM_IP>:/home/ubuntu/
```

### Step 3: Restore to Oracle PostgreSQL Container
```bash
docker compose -f docker-compose.prod.yml exec -T postgres /bin/sh -c "gunzip -c /backups/render_prod_backup.sql.gz | psql -U nec_admin -d nec_leetcode_prod"
```

### Step 4: Validate Roster Integrity
```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U nec_admin -d nec_leetcode_prod -c \
  "SELECT 'Active Students' AS metric, COUNT(*) FROM students WHERE is_active=true;"
```
**Expected Output**: `318` (100% match).

---

## 5. Absolute Rule #3 & #4: Incremental Live Sync Engine

### Operational Behavior:
1. **Zero Batch Blocking**: Every student is processed independently.
2. **Immediate Emission**: When Student A solves a problem or is validated, their row is committed to PostgreSQL and emitted via WebSocket (`CONTEST_RESULT_UPDATED` / `STUDENT_LEETCODE_UPDATE`).
3. **Frontend Incremental State Merge**:
   - `frontend/src/components/PreviousWeekContestPanel.tsx` updates **only** `updated[idx] = { ...currentRec, ... }`.
   - Other students' solved questions and ranks are never cleared or zeroed out.
   - `dynamicMetrics` uses `useMemo` to recalculate KPI counters instantly.
4. **Fault Isolation**: If Student C experiences a transient LeetCode timeout, exponential backoff retries isolated to Student C without halting the queue for the remaining students.

---

## 6. Staging-First Verification Checklist

Before altering production Vercel DNS or API URLs:

1. **Backend Health Check**:
   ```bash
   curl -f https://<ORACLE_STAGING_DOMAIN>/health
   ```
   *Expected*: `{"status":"healthy","database":"connected","time":"..."}`
2. **WebSocket Live Connection**:
   - Connect frontend to `wss://<ORACLE_STAGING_DOMAIN>/ws/contest/518`.
   - Verify heartbeat ping/pong and initial snapshot response.
3. **Authentication & RBAC**:
   - Verify Firebase student email/pass login and Admin login.
4. **318-Student Reconciliation Test**:
   - Run `pytest backend/tests/test_roster_reconciliation_318.py -v` → **18/18 Passed**.
5. **Mobile & PDF Verification**:
   - Verify PDF generation and Android download/share without false success alerts.

---

## 7. Zero-Downtime Production Cutover & Rollback Runbook

### Cutover Procedure (Render → Oracle Cloud):
1. **Take Final Render Snapshot**:
   ```bash
   python scripts/migrate_postgres.py --source $RENDER_DATABASE_URL --dest $ORACLE_DATABASE_URL
   ```
2. **Update Vercel Production Environment Variable**:
   - In Vercel Project Settings > Environment Variables:
     - Update `VITE_API_BASE_URL` to `https://api.nandhaengg.org` (or your Oracle domain).
3. **Trigger Vercel Production Redeployment**:
   - Deploy production build.
4. **Monitor Live Telemetry**:
   - Observe real-time WebSocket events, student lookups, and API health.

### Instant Rollback Plan (Zero Risk):
- **If any unexpected anomaly occurs on Oracle**:
  1. In Vercel Environment Variables, switch `VITE_API_BASE_URL` back to the existing Render backend URL (`https://...onrender.com`).
  2. Click "Redeploy". Production immediately returns to Render in < 60 seconds with 0 data loss.
- **Keep Render active in parallel for 48–72 hours** until Oracle stability is fully proven.
