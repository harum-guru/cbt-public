import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
  Timestamp,
  addDoc,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { gradeAttempt } from '@/lib/grading';
import type { AnswerKey, Exam, ExamAttempt, ExamQuestion } from '@/lib/types';

export async function syncExamRefsForClasses(
  examId: string,
  examData: Pick<
    Exam,
    'teacherId' | 'title' | 'subject' | 'status' | 'settings' | 'questionCount' | 'classIds'
  >,
  previousClassIds: string[] = []
) {
  const batch = writeBatch(db);
  for (const oldClassId of previousClassIds) {
    if (!examData.classIds.includes(oldClassId)) {
      batch.delete(doc(db, 'classes', oldClassId, 'examRefs', examId));
    }
  }
  for (const classId of examData.classIds) {
    batch.set(doc(db, 'classes', classId, 'examRefs', examId), {
      examId,
      teacherId: examData.teacherId,
      title: examData.title,
      subject: examData.subject,
      status: examData.status,
      opensAt: examData.settings.opensAt,
      closesAt: examData.settings.closesAt,
      ...(examData.settings.timezone ? { timezone: examData.settings.timezone } : {}),
      durationMinutes: examData.settings.durationMinutes,
      questionCount: examData.questionCount,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function sealExamKeysFromServer(
  examId: string,
  questions: ExamQuestion[],
  answerKeys: Record<string, AnswerKey>
): Promise<string | undefined> {
  const user = auth.currentUser;
  if (!user) return undefined;
  const idToken = await user.getIdToken();

  const keysPayload: Record<
    string,
    {
      correctOptionId: string;
      points: number;
      voided?: 'none' | 'all_correct' | 'excluded';
      explanation?: string;
    }
  > = {};

  for (const q of questions) {
    const k = answerKeys[q.id];
    if (!k?.correctOptionId) continue;
    keysPayload[q.id] = {
      correctOptionId: k.correctOptionId,
      points: q.points,
      voided: q.voided || 'none',
      ...(k.explanation ? { explanation: k.explanation } : {}),
    };
  }

  const res = await fetch('/api/exams/seal-keys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ examId, keys: keysPayload }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || 'Gagal menyegel kunci jawaban.');
  }
  const data = await res.json();
  return data.sealedKeyToken as string;
}

export async function regradeAllSubmittedAttempts(
  examId: string,
  exam: Exam,
  questions: ExamQuestion[],
  answerKeys: Record<string, AnswerKey>,
  attempts: ExamAttempt[]
): Promise<number> {
  const submitted = attempts.filter((a) => a.status === 'submitted' && a.id);
  if (submitted.length === 0) return 0;

  const batch = writeBatch(db);
  for (const att of submitted) {
    const result = gradeAttempt(
      questions,
      answerKeys,
      att.answers || {},
      exam.settings.passingScore
    );
    const updatePayload: Record<string, unknown> = {
      score: result.score,
      maxScore: result.maxScore,
      percentage: result.percentage,
      correctCount: result.correctCount,
      gradedAt: serverTimestamp(),
      resultReleased:
        exam.resultsReleased ||
        exam.settings.resultsPolicy === 'answers_immediate' ||
        exam.settings.resultsPolicy === 'score_immediate',
    };
    if (typeof result.passed === 'boolean') {
      updatePayload.passed = result.passed;
    }
    batch.update(doc(db, 'exams', examId, 'attempts', att.id!), updatePayload);
  }
  await batch.commit();
  return submitted.length;
}

export async function notifyClassStudents(
  classIds: string[],
  title: string,
  body: string,
  href: string
) {
  const notified = new Set<string>();
  for (const classId of classIds) {
    try {
      const membersSnap = await getDocs(collection(db, 'classes', classId, 'members'));
      for (const m of membersSnap.docs) {
        const uid = m.id;
        if (notified.has(uid)) continue;
        notified.add(uid);
        await addDoc(collection(db, 'notifications', uid, 'items'), {
          userId: uid,
          classId,
          title,
          body,
          href,
          read: false,
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }
    } catch {
      // ignore notification fanout failures
    }
  }
}

export async function duplicateExamToDraft(
  sourceExam: Exam,
  teacherId: string,
  teacherName: string
): Promise<string> {
  if (!sourceExam.id) throw new Error('ID ujian tidak ditemukan.');
  const newExamRef = doc(collection(db, 'exams'));
  const questionsSnap = await getDocs(collection(db, 'exams', sourceExam.id, 'questions'));
  const keysSnap = await getDocs(collection(db, 'exams', sourceExam.id, 'answerKeys'));

  const batch = writeBatch(db);
  batch.set(newExamRef, {
    teacherId,
    teacherName,
    ...(sourceExam.schoolName ? { schoolName: sourceExam.schoolName } : {}),
    title: `${sourceExam.title} (Salinan)`,
    ...(sourceExam.description ? { description: sourceExam.description } : {}),
    subject: sourceExam.subject,
    classIds: sourceExam.classIds,
    status: 'draft',
    settings: sourceExam.settings,
    totalPoints: sourceExam.totalPoints,
    questionCount: sourceExam.questionCount,
    attemptCount: 0,
    resultsReleased: false,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  });

  for (const qDoc of questionsSnap.docs) {
    const qData = qDoc.data();
    delete qData.voided;
    batch.set(doc(db, 'exams', newExamRef.id, 'questions', qDoc.id), qData);
  }
  for (const kDoc of keysSnap.docs) {
    batch.set(doc(db, 'exams', newExamRef.id, 'answerKeys', kDoc.id), kDoc.data());
  }

  await batch.commit();
  return newExamRef.id;
}
