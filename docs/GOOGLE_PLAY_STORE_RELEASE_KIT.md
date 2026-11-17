# Google Play Store Release Preparation Kit
## Nandha LeetCode Intelligence (v4.5.5 - VersionCode 96)

---

### 1. Identity & Application Metadata
| Field | Value |
|---|---|
| **App Title** | Nandha LeetCode Intelligence |
| **Short Description** | Institutional LeetCode contest tracking, performance analytics & attendance for Nandha Engineering College. |
| **Package Name / App ID** | `org.nandhaengg.leetcodesync` |
| **Version Name** | `4.5.5` |
| **Version Code** | `96` |
| **Min SDK** | `24` (Android 7.0 Nougat) |
| **Target SDK** | `36` (Android 16 / Play Store 2026 Ready) |
| **Compile SDK** | `36` |
| **Category** | Education |
| **Tags** | Education, Coding, Performance Tracking, College, Analytics |
| **Content Rating** | Everyone (PEGI 3 / ESRB Everyone) |
| **Contact Email** | `nanthishvaran17@gmail.com` / `support@nandhaengg.org` |
| **Privacy Policy URL** | `https://nandha-leetcode.duckdns.org/privacy-policy.html` |

---

### 2. Store Listing Copy

#### Short Description (Max 80 Characters):
> Institutional LeetCode contest tracking & analytics for Nandha Engineering College.

#### Full Description (Max 4000 Characters):
```
Nandha LeetCode Intelligence is the official institutional contest tracking and programming intelligence platform for students, faculty mentors, department heads, and placement coordinators at Nandha Engineering College (Autonomous), Erode.

Built to foster high-velocity competitive programming, the application provides automated, real-time insights into students' performance across weekly coding contests.

KEY FEATURES:

1. REAL-TIME CONTEST TRACKING
• Automated baseline (08:00 AM IST) and final snapshot (09:30 AM IST) capture for official weekly contests.
• Live scoreboards with instant problem-solving verification and rating deltas.
• Strict virtual participant and post-contest activity integrity filters.

2. DEPARTMENTAL & COHORT LEADERBOARDS
• Live rankings across all engineering departments: Computer Science (Cyber Security, IoT), Information Technology, Electronics & Communication, and more.
• Batch and academic year filtering (1st, 2nd, 3rd, and Final Year cohorts).
• Top performer spotlights, problem milestones, and consistency streak badges.

3. FACULTY & MENTOR ACTION CENTER
• Dedicated staff portals for mentor-student allocation.
• Instant attendance tracking and non-participation alerts.
• Academic intervention tracking and student milestone recognition.

4. HOD & PLACEMENT COMMAND INTELLIGENCE
• Cross-departmental performance comparisons and placement readiness metrics.
• Automated weekly contest reports in Excel and PDF formats.
• Data-driven identification of prospective talent for campus recruitment drives.

5. SECURE & RELIABLE ARCHITECTURE
• Institution-grade Role-Based Access Control (Student, Staff Mentor, HOD, Placement Coordinator, Admin).
• High-performance native Android experience powered by hardware-accelerated WebView.
• High-priority notification channels for upcoming contests, rating changes, and institutional circulars.

IMPORTANT NOTICE & LEGAL DISCLAIMER:
Nandha LeetCode Intelligence is an independent institutional tracking tool designed and operated exclusively for Nandha Engineering College (Autonomous). This application is NOT affiliated with, sponsored by, or endorsed by LeetCode or LeetCode LLC. All LeetCode statistics are queried from publicly accessible student profile data with student consent for academic evaluation.
```

---

### 3. "What's New" Release Notes (v4.5.5)
```
What's new in v4.5.5:
• Android 16 (API 36) Target SDK upgrade for full compliance with Google Play November 2026 requirements.
• Enhanced ProGuard/R8 code shrinking and resource optimization for a faster, lighter APK.
• Secure release signing architecture decoupled from version control.
• Strict HTTPS network security policy with disabled cleartext HTTP.
• Improved mobile drawer navigation and touch response on low-memory devices.
• Real-time contest telemetry with sub-millisecond caching.
```

---

### 4. Google Play Data Safety Declaration Checklist

When completing the **Data safety form** in Google Play Console:

| Question | Selection | Details / Purpose |
|---|---|---|
| **Does your app collect or share any user data?** | **Yes** | Required for academic contest tracking |
| **Is all user data encrypted in transit?** | **Yes** | All network traffic uses TLS 1.3 / HTTPS |
| **Do you provide a way for users to request data deletion?** | **Yes** | Via email to support@nandhaengg.org or via HOD |
| **Personal Info — Name** | Collected (Optional/Admin) | App functionality (Student identity) |
| **Personal Info — Email address** | Collected | Account management, report delivery |
| **Personal Info — User IDs** | Collected | College Roll Number & LeetCode Username |
| **App Info & Performance — Diagnostics** | Collected (Ephemeral) | Crash logs and performance debugging |
| **Device or other IDs** | Collected | Firebase Cloud Messaging (FCM) token for push notifications |
| **Data Sharing** | **No** | Data is never shared with third-party advertisers or brokers |

---

### 5. App Access Instructions for Google Reviewers

To comply with Google Play App Access requirements:

1. **Access Credentials:**
   - **Role:** Staff Mentor / Reviewer
   - **Username:** `reviewer@nandhaengg.org` (or demo reviewer account)
   - **Password:** Provided in Console Reviewer Notes (e.g., `Reviewer@NEC2026`)
   - Alternatively, a **Public Guest / Student View** mode allows browsing live public leaderboards without requiring login credentials.

2. **Testing Instructions for Reviewers:**
   - **Step 1:** Launch the application. The splash screen opens into the Main Leaderboard.
   - **Step 2:** Select any Department tab (e.g. CSE - Cyber Security) to view live student contest rankings.
   - **Step 3:** Tap "Sign In" at the top right to access the Staff/Admin login portal using the provided reviewer credentials.
   - **Step 4:** Once authenticated, navigate to the "Weekly Contests" and "Reports" tabs to verify institutional analytics.

---

### 6. Release Signing Configuration & Keystore Setup

The application uses an authoritative Android release keystore:
- **Keystore File:** `frontend/android/nandha-release-key.jks`
- **Key Alias:** `nandha-key`
- **Signing Algorithm:** RSA 2048-bit with V1 (JAR) and V2 (Full APK) signing enabled.
- **Environment Variables for CI/CD:**
  - `KEYSTORE_PATH`: Path to the `.jks` file.
  - `KEYSTORE_STORE_PASSWORD`: Keystore store password.
  - `KEYSTORE_KEY_ALIAS`: `nandha-key`
  - `KEYSTORE_KEY_PASSWORD`: Keystore key password.

---

### 7. Google Play Pre-Launch Checklist

- [x] Application ID verified: `org.nandhaengg.leetcodesync`
- [x] Target SDK updated to API 36 (Android 16)
- [x] Cleartext HTTP disabled in production (`android:usesCleartextTraffic="false"`)
- [x] Network security configuration restricts cleartext to localhost/emulator only
- [x] Hardcoded credentials and passwords removed from Gradle build scripts
- [x] Keystore files and passwords excluded from Git tracking
- [x] Full ProGuard/R8 rules configured for WebView, Capacitor, and Firebase
- [x] Privacy Policy published in markdown and hosted HTML
- [x] Comprehensive Data Safety declaration prepared
- [x] App access instructions for Play Store reviewers prepared
- [x] Release bundle command: `./gradlew bundleRelease`
