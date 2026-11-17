# Privacy Policy for Nandha LeetCode Intelligence

**Effective Date:** November 17, 2026  
**Last Updated:** November 17, 2026  

**Application Name:** Nandha LeetCode Intelligence  
**Developer/Institution:** Nandha Engineering College (Autonomous), Erode, Tamil Nadu, India  
**Contact Email:** support@nandhaengg.org / nanthishvaran17@gmail.com  

---

## 1. Overview
Nandha LeetCode Intelligence is an educational and institutional performance-tracking application developed specifically for students, faculty mentors, department heads (HODs), and administrators of Nandha Engineering College (Autonomous). The application monitors students' LeetCode weekly contest performance, attendance, problem-solving growth, and departmental programming analytics.

We value your privacy and are committed to protecting all personal and academic data in full compliance with applicable data protection laws and Google Play Developer Program Policies.

---

## 2. Information We Collect

### A. Academic & Profile Information
When authorized by the institution, we collect and store:
- Student Name and College Registration Number (Roll Number)
- Department (e.g., CSE, Cyber Security, IoT, IT, ECE, EEE, Mechanical)
- Academic Year / Cohort Batch (I, II, III, IV Year)
- Institutional Email Address
- Public LeetCode Username (provided by the student or mentor)

### B. Public Contest & Coding Data
From publicly available LeetCode GraphQL endpoints, we fetch:
- Contest participation status, contest ranking, and contest rating
- Number of problems solved during designated weekly contests
- Global problem-solving rank and badge statistics

### C. Technical & Device Information
- **Push Notification Tokens (FCM):** When notifications are enabled, a Firebase Cloud Messaging token is registered to deliver contest alerts and ranking notifications.
- **Anonymized Diagnostic Data:** Application crash logs and network error reports (without personal identifiers) for platform stability.
- **Hashed IP & Session Identifiers:** One-way salted hashes of IP addresses used strictly for security auditing and blocking unauthorized login attempts.

---

## 3. How We Use the Information
The collected information is used solely for educational and institutional purposes:
1. Tracking participation and ranking in LeetCode weekly coding contests.
2. Generating academic attendance, performance snapshots, and departmental leaderboards.
3. Facilitating faculty mentorship and action center guidance for underperforming students.
4. Sending timely push notifications about upcoming contests, rank updates, and institutional reports.
5. Securing access to institutional dashboards via Role-Based Access Control (RBAC).

---

## 4. Data Sharing & Third-Party Services
We do **not** sell, rent, or trade your personal data. Data is shared only with trusted technical providers required for app functionality:
- **Firebase / Google Cloud:** Used for secure push notification delivery (FCM) and optional cloud sync.
- **Brevo / SMTP:** Used strictly for sending automated institutional contest summary emails to department heads and coordinators.
- **Public LeetCode APIs:** Public profile usernames are queried against public GraphQL endpoints to fetch public contest statistics.

We do **not** use advertising SDKs, tracking pixels, or third-party behavioral analytics.

---

## 5. Data Security & Storage
- All network communication between the mobile application and the backend API is strictly encrypted via Transport Layer Security (TLS 1.3 / HTTPS). Cleartext HTTP is disabled.
- Sensitive authentication tokens (JWT) are securely stored on the device using sandboxed app storage.
- Passwords are never stored in plaintext and are hashed using bcrypt with adaptive salt rounds.
- Database access is protected by PostgreSQL role authentication, SSL connections, and server-side authorization checks on all administrative endpoints.

---

## 6. User Rights & Account Deletion
Students and staff have the right to:
- Access and review their tracked academic and contest records.
- Request correction of mismatched registration numbers or LeetCode usernames.
- Request account deletion and data removal:
  - Users can request deletion by emailing **support@nandhaengg.org** or contacting their Department HOD / Faculty Mentor.
  - Upon institutional verification, the student's profile, session logs, and associated personal records will be permanently removed from the active database within 30 business days.

---

## 7. Children's Privacy
Our application is intended exclusively for undergraduate and postgraduate engineering college students (typically aged 17 and above). We do not knowingly collect personal data from children under the age of 13.

---

## 8. Disclaimer Regarding LeetCode
Nandha LeetCode Intelligence is an independent institutional tracking tool developed by Nandha Engineering College. It is not affiliated with, sponsored by, or endorsed by LeetCode or LeetCode LLC.

---

## 9. Changes to This Privacy Policy
We may update this Privacy Policy from time to time to reflect operational or regulatory changes. Updated versions will be published within the app and on the official college repository.

---

## 10. Contact Us
If you have any questions regarding this Privacy Policy or wish to exercise your data rights, please contact:
- **Data Protection Officer / Admin:** Nandha Engineering College (Autonomous)
- **Email:** support@nandhaengg.org / nanthishvaran17@gmail.com
- **Address:** Perundurai Main Road, Erode - 638 052, Tamil Nadu, India
