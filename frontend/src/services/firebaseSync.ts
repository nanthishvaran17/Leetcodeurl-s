import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { getOrInitDb } from './firebase';

/**
 * Sync student records from the backend API response into Cloud Firestore.
 *
 * CRITICAL DATA-INTEGRITY RULES:
 *   - NEVER convert null/undefined stats into 0.
 *   - NEVER fabricate a syncStatus of "success" for an unverified student.
 *   - NEVER fabricate a lastVerifiedAt timestamp.
 *   - NEVER fabricate a contest rating.
 *   - Stats (totalSolved, easy, medium, hard) must remain null until
 *     the backend sets syncStatus === "success" with a real lastVerifiedAt.
 */
export async function syncAllStudentsToFirestoreWeb(studentsList: any[]) {
  try {
    const firestoreDb = getOrInitDb();
    if (!firestoreDb || !studentsList || studentsList.length === 0) return;

    console.log(`[Firestore] Syncing ${studentsList.length} students via Web SDK...`);

    let batch = writeBatch(firestoreDb);
    let count = 0;

    for (const s of studentsList) {
      const studId = String(s.id);
      const studentRef = doc(firestoreDb, 'students', studId);
      const statsRef   = doc(firestoreDb, 'leetcodeStats', studId);

      // ── Determine the real sync state ────────────────────────────────────────
      const rawSyncStatus: string | null = s.stats?.sync_status ?? null;
      const isVerified = rawSyncStatus === 'success' || rawSyncStatus === 'OK';

      // Stats are only valid when the backend has confirmed syncStatus === "success"
      // For every other state (pending / failed / mismatch / null) we MUST write null.
      const totalSolved    = isVerified ? (s.stats?.total_solved   ?? null) : null;
      const easySolved     = isVerified ? (s.stats?.easy_solved    ?? null) : null;
      const mediumSolved   = isVerified ? (s.stats?.medium_solved  ?? null) : null;
      const hardSolved     = isVerified ? (s.stats?.hard_solved    ?? null) : null;
      const contestRating  = isVerified ? (s.stats?.contest_rating ?? null) : null;
      const globalRanking  = isVerified ? (s.stats?.contest_global_ranking ?? null) : null;

      // lastVerifiedAt must only come from the backend — NEVER use new Date()
      const lastVerifiedAt: string | null =
        isVerified && s.stats?.last_verified_at ? s.stats.last_verified_at : null;

      // Canonical syncStatus for Firestore — never fall back to "success"
      const syncStatus: string =
        rawSyncStatus ?? (s.username ? 'pending' : 'invalid_profile');

      // ── Student identity document ─────────────────────────────────────────────
      batch.set(studentRef, {
        id:                s.id,
        registerNo:        s.reg_no,
        name:              s.name,
        email:             s.email ?? '',
        department:        s.department?.code ?? s.department ?? 'GEN',
        departmentName:    s.department?.name ?? s.department ?? 'General',
        year:              s.year_level ?? s.year ?? 'III',
        section:           s.section?.name ?? s.section ?? 'A',
        leetcodeUsername:  s.username ?? '',
        leetcodeProfileUrl: s.leetcode_url ?? '',
        isActive:          true
      }, { merge: true });

      // ── LeetCode stats document ───────────────────────────────────────────────
      batch.set(statsRef, {
        studentId:         s.id,
        registerNo:        s.reg_no,
        leetcodeUsername:  s.username ?? '',

        // Stats — null unless actually verified
        totalSolved,
        easySolved,
        mediumSolved,
        hardSolved,
        contestRating,
        globalRanking,

        // Sync state — reflects real backend state
        syncStatus,
        status:            s.stats?.status ?? 'DATA UNAVAILABLE',
        source:            isVerified ? (s.stats?.source ?? 'leetcode_public_profile') : null,
        lastVerifiedAt,

        // Progress (safe to default these to 0 — they are progress counts, not profile stats)
        weeklySolved:      s.weekly_progress ?? 0,
        streakCount:       s.streak_count    ?? 0,
        consistencyScore:  s.consistency_score ?? 0,
        collegeRank:       s.college_rank ?? null
      }, { merge: true });

      count++;

      // Firestore batches: max 500 writes (250 students × 2 docs = 500 ops)
      if (count % 200 === 0) {
        await batch.commit();
        batch = writeBatch(firestoreDb);
      }
    }

    await batch.commit();
    console.log('[Firestore] Successfully committed all student records & stats to Cloud Firestore!');
  } catch (err) {
    console.error('[Firestore] Cloud Firestore Web SDK sync error:', err);
  }
}
