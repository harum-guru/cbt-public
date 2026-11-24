import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sealAnswerKeys, verifyFirebaseBearerToken } from '@/lib/server-auth';

const sealSchema = z.object({
  examId: z.string().min(1).max(128),
  keys: z.record(
    z.string(),
    z.object({
      correctOptionId: z.string().min(1).max(64),
      points: z.number().min(0).max(100),
      voided: z.enum(['none', 'all_correct', 'excluded']).optional(),
      explanation: z.string().max(3000).optional(),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const tokenUser = await verifyFirebaseBearerToken(req.headers.get('authorization'));
    if (!tokenUser.email_verified) {
      return NextResponse.json({ error: 'Email belum terverifikasi.' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = sealSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload kunci jawaban tidak valid.' }, { status: 400 });
    }

    const sealedKeyToken = sealAnswerKeys({
      examId: parsed.data.examId,
      teacherUid: tokenUser.uid,
      keys: parsed.data.keys,
      sealedAt: Date.now(),
    });

    return NextResponse.json({ sealedKeyToken });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyegel kunci jawaban.';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
