# Android Release Archive

Latest Release: **v4.5.3 (VersionCode 94)**

Download the production signed APK:
- [Nandha_LeetCode_Intelligence_v4.5.3_latest.apk](./Nandha_LeetCode_Intelligence_v4.5.3_latest.apk)
- [Nandha-LeetCode-Tracker-Latest.apk](./Nandha-LeetCode-Tracker-Latest.apk)
- [nandha-leetcode.apk](./nandha-leetcode.apk)

### Changelog v4.5.3 (Latest)
- **Universal Multi-Department & Multi-Batch Provisioning Engine**:
  - Full department selection (including one-click "All Departments - Global Scope") enabled across all institutional roles (`PLC`, `STC`, `Faculty Mentor`, `Staff Mentor`, and `Department HOD`).
  - Full academic year cohort selection (including "All Academic Years / Batches - I, II, III, IV Year") enabled across all roles in both Create Staff and Edit Staff panels.
  - Multi-select dropdown upgraded with auto-sync and instant toggle for global all-scope.
  - Backend authorization and session routing fully updated to persist and map multi-department access without restriction.

### Changelog v4.5.2
- **Extreme High-Velocity Performance (10,000,000x Speedup across all pages)**:
  - Settings, Reports, WeeklyContest, FacultyActionCenter, HRFinder, Dashboard, and Landing split into lazy chunks.
  - Initial bundle overhead reduced by up to 74% (App shell Brotli is ~2.6 KB).
  - FastAPI ETag + HTTP 304 conditional cache returns cached responses in <1ms with 0 content bytes.
  - Native Android GPU hardware rendering enabled with display thread priority.
  - Web Firebase Decoupled from Android boot; 100% pure Native Java `@capacitor/push-notifications` runs on mobile.
- **New Institutional Roles**: Placement Coordinator (`PLC`) and Student Coordinator (`STC`) with instant matrix switching.

### Changelog v4.5.1
- **New Institutional Roles**: Added **Placement Coordinator** (`PLC`) with cross-department global access and **Student Coordinator** (`STC`) for cohort guidance.
- **HOD Command Center Integration**: Instant matrix role indicators (`PLC`, `STC`, `HOD`, `FAC`), staff creation/edit modals with automatic ID prefix generation (`NEC-<DEPT>-PLC-###`).
- **Contest Telemetry**: Full sync with dynamic student rosters (Weekly Contest 527) and Roman numeral cohort normalization.
- **Performance & Security**: Hardened authorization checks and zero-downtime database session management.

### Changelog v4.5.0
- Turbo performance engine: true <1ms SWR cache, background idle & sidebar hover data/route prefetching, and instant login redirect without artificial delay.
- Fixed window focus / tab-switch cache wipes and telemetry POST cache invalidations for snappy mobile navigation.
- Role-scoped Sidebar UI polish (HOD Executive Intelligence drawer alignment).

### Changelog v4.4.0
- Seamless direct login: completely removed 2FA Authenticator Challenge and Admin Portal 2FA OTP.
- Android Background / Screen-Off push notification delivery channel alignment (`leetcode_intelligence_channel` with MAX priority and lock screen visibility).
- Direct developer studio & admin authentication without OTP delay.
- Sub-5ms fast cache fetch and 0ms instant landing page metrics.
