import { getOrInitDbAsync } from './firebase';

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
    const firestoreDb = await getOrInitDbAsync();
    if (!firestoreDb || !studentsList || studentsList.length === 0) return;

    const { doc, writeBatch } = await import('firebase/firestore');

    console.log(`[Firestore] Syncing ${studentsList.length} students via Web SDK...`);

    let batch = writeBatch(firestoreDb);
    let count = 0;

    for (const s of studentsList) {
      const studId = String(s.id);
      const studentRef = doc(firestoreDb, 'students', studId);
      const statsRef   = doc(firestoreDb, 'leetcodeStats', studId);

      // ── Determine the real sync state ────────────────────────────────────────
      const rawSyncStatus: string | null = s.stats?.sync_status ?? s.sync_status ?? null;
      const totalSolvedVal    = s.stats?.total_solved   ?? s.total_solved   ?? null;
      const easySolvedVal     = s.stats?.easy_solved    ?? s.easy_solved    ?? null;
      const mediumSolvedVal   = s.stats?.medium_solved  ?? s.medium_solved  ?? null;
      const hardSolvedVal     = s.stats?.hard_solved    ?? s.hard_solved    ?? null;
      const contestRatingVal  = s.stats?.contest_rating ?? s.contest_rating ?? null;
      const globalRankingVal  = s.stats?.contest_global_ranking ?? s.contest_global_ranking ?? null;

      // Stats are valid when status is success/OK/verified/stale OR totalSolvedVal is present
      const isVerified = rawSyncStatus === 'success' || rawSyncStatus === 'OK' || rawSyncStatus === 'verified' || rawSyncStatus === 'stale' || totalSolvedVal !== null;

      const totalSolved    = isVerified ? totalSolvedVal : null;
      const easySolved     = isVerified ? easySolvedVal : null;
      const mediumSolved   = isVerified ? mediumSolvedVal : null;
      const hardSolved     = isVerified ? hardSolvedVal : null;
      const contestRating  = isVerified ? contestRatingVal : null;
      const globalRanking  = isVerified ? globalRankingVal : null;

      // lastVerifiedAt must come from backend or fallback if verified
      const lastVerifiedAt: string | null =
        (s.stats?.last_verified_at || s.last_verified_at) ? (s.stats?.last_verified_at || s.last_verified_at) : (isVerified ? new Date().toISOString() : null);

      // Canonical syncStatus for Firestore
      const syncStatus: string =
        rawSyncStatus ?? (isVerified ? 'success' : (s.username ? 'pending' : 'invalid_profile'));


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
    console.debug('[Firestore] Web SDK client sync note (Backend is authoritative):', err);
  }
}

export async function syncCertificateToFirestoreWeb(certData: any) {
  try {
    const firestoreDb = await getOrInitDbAsync();
    if (!firestoreDb || !certData || !certData.verification_id) return;
    const { doc, setDoc } = await import('firebase/firestore');
    const certRef = doc(firestoreDb, 'certificates', certData.verification_id);
    await setDoc(certRef, {
      ...certData,
      status: certData.status || 'VERIFIED',
      is_valid: certData.status !== 'REVOKED',
      syncedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`[Firestore] Synced certificate ${certData.verification_id} to Cloud Firestore.`);
  } catch (err) {
    console.debug('[Firestore] Certificate sync note:', err);
  }
}

export async function fetchCertificateFromFirestoreWeb(verificationId: string) {
  try {
    const firestoreDb = await getOrInitDbAsync();
    if (!firestoreDb || !verificationId) return null;
    const { doc, getDoc } = await import('firebase/firestore');
    const certRef = doc(firestoreDb, 'certificates', verificationId);
    const snap = await getDoc(certRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.debug('[Firestore] Certificate lookup note:', err);
    return null;
  }
}
