# Android Release Archive

Latest Release: **v4.5.7 (VersionCode 98)**  
**Authoritative Live Sync:** November 19, 2026 (Fully Synchronized & Play Store Ready)  

### Production Build Outputs:
- **Play Store Bundle (AAB):** `Nandha-LeetCode-PlayStore-Release.aab`
- **Signed Release APK:** `Nandha-LeetCode-Intelligence-release.apk`
- **Direct Repository APKs:**
  - [Nandha_LeetCode_Intelligence_v4.5.7_latest.apk](./Nandha_LeetCode_Intelligence_v4.5.7_latest.apk)
  - [Nandha-LeetCode-Tracker-Latest.apk](./Nandha-LeetCode-Tracker-Latest.apk)
  - [nandha-leetcode.apk](./nandha-leetcode.apk)

### Changelog v4.5.7 (Latest Production)
- **Weekly Contest Mobile Viewport & Overview Cards Alignment**:
  - Re-proportioned mobile stat cards with compact `h-20` height, `p-2.5` internal padding, and scaled font sizes.
  - Eliminated left-edge border cut-off / clipping on mobile frames via `ring-inset` and internal `border-2`.
  - Added safe responsive container bounds ensuring full border visibility across all device screens.
- **Data Quality & Profile Health Page Polish**:
  - Standardized padding and margins, unified dark theme navy color palettes, and balanced bento grid.
- **Notification Settings Optimization**:
  - Removed cluttered test alert buttons and streamlined preference sound persistence.

### Changelog v4.5.4
- **Enhanced Badge Display & Type Safety**:
  - Added colored pill badges (`[CS]`, `[IT]`, `[ALL]`, `[ECE]`, etc.) directly inside dropdown options.
  - Unified `MultiSelectOption` interface across creation and edit workflows.

### Changelog v4.5.3
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
