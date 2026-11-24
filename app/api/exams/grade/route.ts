import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { unsealAnswerKeys, verifyFirebaseBearerToken } from '@/lib/server-auth';

const gradeSchema = z.object({
  examId: z.string().min(1).max(128),
  sealedKeyToken: z.string().min(10).max(50000),
  answers: z.record(
    z.string(),
    z.object({
      optionId: z.string().nullable(),
      flagged: z.boolean().optional(),
      updatedAt: z.number().optional(),
    })
  ),
  passingScore: z.number().min(0).max(100).optional(),
  includeKeyBreakdown: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const tokenUser = await verifyFirebaseBearerToken(req.headers.get('authorization'));
    if (!tokenUser.email_verified) {
      return NextResponse.json({ error: 'Email belum terverifikasi.' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = gradeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data penilaian tidak valid.' }, { status: 400 });
    }

    const { examId, sealedKeyToken, answers, passingScore, includeKeyBreakdown } = parsed.data;

    let sealed;
    try {
      sealed = unsealAnswerKeys(sealedKeyToken);
    } catch {
      return NextResponse.json({ pendingTeacherSync: true }, { status: 200 });
    }

    if (sealed.examId !== examId) {
      return NextResponse.json({ error: 'Token segel tidak cocok dengan ujian ini.' }, { status: 403 });
    }

    let score = 0;
    let maxScore = 0;
    let correctCount = 0;
    let totalGraded = 0;

    const breakdown: Record<string, { correctOptionId: string; explanation?: string; isCorrect: boolean }> = {};

    for (const [qId, info] of Object.entries(sealed.keys)) {
      if (info.voided === 'excluded') continue;
      totalGraded += 1;
      maxScore += info.points;

      const chosen = answers[qId]?.optionId || null;
      const isCorrect =
        info.voided === 'all_correct' || (chosen !== null && chosen === info.correctOptionId);

      if (isCorrect) {
        score += info.points;
        correctCount += 1;
      }

      if (includeKeyBreakdown) {
        breakdown[qId] = {
          correctOptionId: info.correctOptionId,
          explanation: info.explanation,
          isCorrect,
        };
      }
    }

    const percentage =
      maxScore > 0 ? Math.round(((score / maxScore) * 100 + Number.EPSILON) * 100) / 100 : 0;
    const passed = typeof passingScore === 'number' ? percentage >= passingScore : undefined;

    return NextResponse.json({
      pendingTeacherSync: false,
      score,
      maxScore,
      percentage,
      correctCount,
      totalGraded,
      passed,
      breakdown: includeKeyBreakdown ? breakdown : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memproses penilaian.';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
