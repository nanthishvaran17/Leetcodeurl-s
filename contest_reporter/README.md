# 🚀 LeetCode Weekly Contest Report — Automation System

Automated weekly performance reporter for **Nanthish S (`nanthishvaran_07`)**, B.E. CSE (Cyber Security) at Nandha Engineering College.

Automatically fetches contest rating/stats from LeetCode's GraphQL API, tracks history in SQLite, generates a multi-sheet Excel workbook + executive 1-page PDF summary, and emails them with a styled HTML body to Faculty, HOD, and Department Coordinators every week.

---

## 📁 Directory Structure

```text
contest_reporter/
├── main.py                   # Main orchestrator pipeline
├── config.py                 # Environment & config loader / validator
├── database.py               # SQLite storage & idempotency checker
├── fetch.py                  # LeetCode GraphQL API client + rating-settled check
├── analyze.py                # Rating trends, streak counter, tag weakness, narrative engine
├── report_excel.py           # openpyxl 3-sheet Excel workbook generator (with rating chart)
├── report_pdf.py             # ReportLab 1-page executive PDF generator
├── mailer.py                 # Gmail SMTP sender with HTML body & attachments
├── scheduler.py              # APScheduler local runner (runs Mondays 9:30 AM IST)
├── config/
│   ├── settings.yaml         # Student metadata & milestone settings
│   └── recipients.yaml       # Configurable email recipients (Faculty/HOD)
├── .env.example              # Environment variables template
├── requirements.txt          # Dependencies
└── output/                   # Generated .xlsx and .pdf reports
```

---

## ⚡ Quick Start

### 1. Install Dependencies

```bash
cd contest_reporter
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and fill in your Gmail SMTP details:

```env
LEETCODE_USERNAME=nanthishvaran_07
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx       # Gmail App Password (16 chars)
SENDER_NAME=NEC LeetCode Tracker
```

> **Note on Gmail SMTP**: You must generate a **Gmail App Password** at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (requires 2-Factor Authentication enabled).

---

## 🛠️ Usage & Commands

### 1. Test Dry Run (Mock Data, No Email Sent)
Verify report generation without touching the network or sending emails:

```bash
python main.py --dry-run
```

### 2. Test Email (Send to 1st Recipient Only)
Send a live test report to the first recipient in `config/recipients.yaml`:

```bash
python main.py --test-email
```

### 3. Run Live Pipeline
Fetch real stats, generate reports, and email all recipients (idempotent — will skip if already sent for this contest):

```bash
python main.py
```

### 4. Force Resend
Re-run the pipeline even if an email was already sent for the current contest:

```bash
python main.py --force
```

### 5. Local Scheduler
Run the local background daemon (triggers every Monday at 9:30 AM IST):

```bash
python scheduler.py
```

---

## 🤖 GitHub Actions Workflow

The system includes a pre-configured GitHub Actions workflow in `.github/workflows/weekly_report.yml`.

### Setup in GitHub:
1. Push this repository to GitHub.
2. Go to **Settings > Secrets and variables > Actions**.
3. Add the following repository secrets:
   - `LEETCODE_USERNAME`: `nanthishvaran_07`
   - `SMTP_USER`: `your.email@gmail.com`
   - `SMTP_PASSWORD`: `your-16-char-app-password`
4. The workflow will run automatically every **Monday at 04:30 UTC (10:00 AM IST)**.
5. You can also trigger it manually anytime under the **Actions** tab.
