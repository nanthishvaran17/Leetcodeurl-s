# Security Policy

## Supported Versions

We actively maintain the latest production version of the application and provide security fixes for supported releases.

| Version                     | Supported          |
| --------------------------- | ------------------ |
| Latest / Main               | :white_check_mark: |
| Previous production release | :white_check_mark: |
| Older releases              | :x:                |

Security updates will primarily be applied to the latest production release.

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it privately rather than creating a public GitHub issue.

### How to Report

Please contact the project maintainer or security administrator through the project's official private communication channel.

When reporting a vulnerability, please include:

* A clear description of the vulnerability
* Steps required to reproduce the issue
* The affected feature, endpoint, or component
* Potential security impact
* Screenshots, logs, or proof-of-concept details when applicable
* Any suggested mitigation, if available

Please do not include passwords, API keys, access tokens, student credentials, or other sensitive personal information in the report.

### What Happens After Reporting

We will:

1. Review and validate the reported vulnerability.
2. Acknowledge the report as soon as reasonably possible.
3. Assess its severity and potential impact.
4. Develop and test an appropriate fix.
5. Deploy the security fix when appropriate.
6. Notify the reporter about the resolution or planned mitigation.

If a report is determined not to be a security vulnerability, we will explain the reason when possible.

### Responsible Disclosure

Please allow reasonable time for the issue to be investigated and fixed before publicly disclosing security details.

Public disclosure of vulnerabilities before a fix is available may expose students, faculty, authentication systems, attendance records, or other application data to unnecessary risk.

## Security Scope

Security reports may include, but are not limited to:

* Authentication and authorization vulnerabilities
* Student or faculty data exposure
* Supabase/PostgreSQL security issues
* Row Level Security (RLS) bypasses
* API endpoint vulnerabilities
* LeetCode account or contest-data exposure
* Unauthorized access to attendance records
* Email or notification abuse
* API key or secret exposure
* Cross-site scripting (XSS)
* SQL injection
* Insecure direct object references
* Session or token security issues

Thank you for helping keep this project and its users secure.
