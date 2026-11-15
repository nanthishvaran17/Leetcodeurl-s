# Android Release Archive

Latest Release: **v4.5.1 (VersionCode 92)**

Download the production signed APK:
- [Nandha_LeetCode_Intelligence_v4.5.1_latest.apk](./Nandha_LeetCode_Intelligence_v4.5.1_latest.apk)
- [Nandha-LeetCode-Tracker-Latest.apk](./Nandha-LeetCode-Tracker-Latest.apk)
- [nandha-leetcode.apk](./nandha-leetcode.apk)

### Changelog v4.5.1 (Latest)
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
