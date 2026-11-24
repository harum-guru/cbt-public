import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export async function writeAuditLog(params: {
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: 'user' | 'class' | 'exam' | 'settings';
  targetId: string;
  reason?: string;
  meta?: Record<string, unknown>;
}) {
  await addDoc(collection(db, 'auditLogs'), {
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    ...(params.reason ? { reason: params.reason } : {}),
    ...(params.meta ? { meta: params.meta } : {}),
    at: serverTimestamp(),
  });
}
