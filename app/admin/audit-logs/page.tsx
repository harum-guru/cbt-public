'use client';

import React, { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { AppShell } from '@/components/AppShell';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { formatWIB } from '@/lib/time';
import type { AuditLog } from '@/lib/types';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'auditLogs'), orderBy('at', 'desc'), limit(100));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
    );
    return () => unsub();
  }, []);

  return (
    <AppShell requiredRole="admin" title="Audit Log Administrator">
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 border-b border-stone-200 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Waktu (WIB)</th>
                <th className="px-5 py-3 font-semibold">Pelaku</th>
                <th className="px-5 py-3 font-semibold">Aksi</th>
                <th className="px-5 py-3 font-semibold">Target</th>
                <th className="px-5 py-3 font-semibold">Alasan / Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    Belum ada catatan audit.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {formatWIB(log.at)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700">{log.actorEmail}</td>
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-900">
                      {log.action}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600">
                      {log.targetType}/{log.targetId}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">{log.reason || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
