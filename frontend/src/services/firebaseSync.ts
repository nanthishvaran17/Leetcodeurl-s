import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { getOrInitDb } from './firebase';

export async function syncAllStudentsToFirestoreWeb(studentsList: any[]) {
  try {
    const firestoreDb = getOrInitDb();
    if (!firestoreDb || !studentsList || studentsList.length === 0) return;

    console.log(`Syncing ${studentsList.length} students to Cloud Firestore via Web SDK...`);

    let batch = writeBatch(firestoreDb);
    let count = 0;

    for (const s of studentsList) {
      const studId = String(s.id);
      const studentRef = doc(firestoreDb, "students", studId);
      const statsRef = doc(firestoreDb, "leetcodeStats", studId);

      const tot = s.stats?.total_solved || 0;
      const ez = s.stats?.easy_solved || 0;
      const med = s.stats?.medium_solved || 0;
      const hd = s.stats?.hard_solved || 0;
      const rating = s.stats?.contest_rating || 1355.3;
      const grank = s.stats?.contest_global_ranking || null;

      batch.set(studentRef, {
        id: s.id,
        registerNo: s.reg_no,
        name: s.name,
        email: s.email || '',
        department: s.department?.code || s.department || 'GEN',
        departmentName: s.department?.name || s.department || 'General',
        year: s.year_level || s.year || 'III',
        section: s.section?.name || s.section || 'A',
        leetcodeUsername: s.username || '',
        leetcodeProfileUrl: s.leetcode_url || '',
        isActive: true
      }, { merge: true });

      batch.set(statsRef, {
        studentId: s.id,
        registerNo: s.reg_no,
        leetcodeUsername: s.username || '',
        totalSolved: tot,
        easySolved: ez,
        mediumSolved: med,
        hardSolved: hd,
        contestRating: rating,
        globalRanking: grank,
        status: s.stats?.status || 'OK',
        weeklySolved: s.weekly_progress || 0,
        streakCount: s.streak_count || 0,
        consistencyScore: s.consistency_score || 0,
        collegeRank: s.college_rank || null
      }, { merge: true });

      count++;

      // Firestore batches support max 500 writes (250 students * 2 docs = 500 ops)
      if (count % 200 === 0) {
        await batch.commit();
        batch = writeBatch(firestoreDb);
      }
    }

    await batch.commit();
    console.log("Successfully committed all student records & stats to Cloud Firestore!");
  } catch (err) {
    console.error("Cloud Firestore Web SDK sync error:", err);
  }
}
