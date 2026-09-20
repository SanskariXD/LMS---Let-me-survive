import { ensureDbInitialized } from '@/db';
import { 
  upsertUser, 
  getUserByEnrollment, 
  getUserById,
  createTask, 
  getUserTasks,
  saveUserPreferences,
  getUserPreferences,
  addManualCourse,
  getUserManualCourses,
  createResource,
  getResources,
  toggleResourceVote,
  toggleResourceBookmark,
  saveUniversityCachedData,
  getUniversityCachedData
} from '@/lib/db/queries';
import { hashPin, verifyPin, encryptSecret, decryptSecret } from '@/lib/portal/auth';
import { createSessionToken, parseSessionToken } from '@/lib/portal/session';

async function runVerification() {
  console.log('=== Step 1: Database Initialization ===');
  await ensureDbInitialized();
  console.log('✓ Database initialized successfully');

  console.log('\n=== Step 2: Auth & Crypto Verification ===');
  const pinA = '123456';
  const hashedA = await hashPin(pinA);
  const isValidA = await verifyPin(pinA, hashedA);
  const isInvalidA = await verifyPin('654321', hashedA);
  console.log(`PIN verification: valid=${isValidA}, invalid=${!isInvalidA}`);
  if (!isValidA || isInvalidA) throw new Error('PIN verification failed');

  const secretPass = 'SecretAmityPassword!2026';
  const encrypted = encryptSecret(secretPass);
  const decrypted = decryptSecret(encrypted);
  console.log(`AES-256-GCM encryption/decryption: match=${decrypted === secretPass}`);
  if (decrypted !== secretPass) throw new Error('Credential encryption failed');

  const sessionCookie = createSessionToken('user-test-a', {
    enrollment: 'A86605224188',
    name: 'Mr Anjan Shetty C'
  });
  const verifiedSession = parseSessionToken(sessionCookie);
  console.log(`Session HMAC verification: valid=${verifiedSession?.userId === 'user-test-a'}`);
  const tamperedSession = parseSessionToken(sessionCookie + 'tampered');
  console.log(`Tampered session rejected: ${tamperedSession === null}`);
  if (!verifiedSession || tamperedSession !== null) throw new Error('Session cookie signing failed');

  console.log('\n=== Step 3: Multi-User Upsert & Data Isolation ===');
  // Upsert User A
  const userA = await upsertUser({
    enrollmentNumber: 'A86605224188',
    email: 'A86605224188@blr.amity.edu',
    studentName: 'Anjan Shetty C',
    programCode: 'B.Tech. (CSE)',
    pinHash: hashedA,
    universityPasswordEncrypted: encrypted
  });
  console.log(`✓ User A upserted: ${userA.id} (${userA.enrollment_number})`);

  // Upsert User B
  const hashedB = await hashPin('987654');
  const userB = await upsertUser({
    enrollmentNumber: 'A86605224999',
    email: 'A86605224999@blr.amity.edu',
    studentName: 'Second Student B',
    programCode: 'B.Tech. (ECE)',
    pinHash: hashedB,
    universityPasswordEncrypted: encryptSecret('UserBPassword!2026')
  });
  console.log(`✓ User B upserted: ${userB.id} (${userB.enrollment_number})`);

  // Tasks Isolation
  await createTask(userA.id, {
    title: 'User A Exclusive Math Assignment',
    course: 'MATH101',
    priority: 'high',
    isAssignment: true,
  });

  await createTask(userB.id, {
    title: 'User B Exclusive Physics Lab',
    course: 'PHYS101',
    priority: 'low',
    isAssignment: false,
  });

  const tasksForA = await getUserTasks(userA.id);
  const tasksForB = await getUserTasks(userB.id);

  console.log(`User A tasks count: ${tasksForA.length}, first title: "${tasksForA[0]?.title}"`);
  console.log(`User B tasks count: ${tasksForB.length}, first title: "${tasksForB[0]?.title}"`);
  const leakageAtoB = tasksForB.some(t => t.title.includes('User A'));
  const leakageBtoA = tasksForA.some(t => t.title.includes('User B'));
  console.log(`Zero cross-tenant leakage between User A and User B: ${!leakageAtoB && !leakageBtoA}`);
  if (leakageAtoB || leakageBtoA) throw new Error('Cross-tenant data leakage detected!');

  console.log('\n=== Step 4: Manual Past Courses Isolation ===');
  await addManualCourse(userA.id, {
    semester: 'Fall 2024-25',
    courseCode: 'CSE101',
    courseName: 'Intro to Programming',
    credits: 4,
    grade: 'A+'
  });

  const coursesA = await getUserManualCourses(userA.id);
  const coursesB = await getUserManualCourses(userB.id);
  console.log(`User A manual courses: ${coursesA.length}, User B manual courses: ${coursesB.length}`);
  if (coursesA.length < 1 || coursesB.length !== 0) throw new Error('Manual courses isolation failed');

  console.log('\n=== Step 5: Resource Hub Sharing, Voting & Bookmarking ===');
  const res = await createResource(userA.id, userA.student_name || 'Anjan Shetty C', {
    title: 'DSA Comprehensive Cheat Sheet',
    description: 'All trees and graph algorithms for midterm',
    resourceType: 'Open Book Notes',
    course: 'CSE2001',
    professor: 'Dr. Ramesh Kumar',
    slot: 'B',
    semester: 'Fall 2025-26',
    fileUrl: 'https://example.blob.vercel-storage.com/dsa-notes.pdf',
    fileName: 'dsa-notes.pdf',
    fileSize: 1800000,
  });
  console.log(`✓ User A shared public resource: ${res.id}`);

  // User B votes helpful
  const voteRes = await toggleResourceVote(userB.id, res.id);
  console.log(`User B voted helpful: voted=${voteRes?.voted}, total=${voteRes?.count}`);

  // User B bookmarks
  const bookmarkRes = await toggleResourceBookmark(userB.id, res.id);
  console.log(`User B bookmarked resource: bookmarked=${bookmarkRes.bookmarked}`);

  const publicResources = await getResources(userB.id);
  const found = publicResources.find(r => r.id === res.id);
  console.log(`Resource list returns for User B: hasVoted=${found?.hasVoted}, isBookmarked=${found?.isBookmarked}`);
  if (!found?.hasVoted || !found?.isBookmarked) throw new Error('Resource voting/bookmarking failed');

  console.log('\n=== Step 6: University Offline Cache Isolation ===');
  await saveUniversityCachedData(userA.id, {
    attendanceJson: JSON.stringify({ overall: 88, courses: [{ code: 'CSE2001', pct: 90 }] }),
    timetableJson: JSON.stringify({ slot: 'B' })
  });

  const cachedA = await getUniversityCachedData(userA.id);
  const cachedB = await getUniversityCachedData(userB.id);
  console.log(`User A cached data available: ${Boolean(cachedA?.attendance_json)}`);
  console.log(`User B cached data empty: ${cachedB === null}`);
  if (!cachedA?.attendance_json || cachedB !== null) throw new Error('Cached university data isolation failed');

  console.log('\n=============================================');
  console.log('🎉 ALL MULTI-USER SYSTEM TESTS PASSED SUCCESSFULLY!');
  console.log('=============================================');
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
