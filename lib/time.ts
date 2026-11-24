import { Timestamp } from 'firebase/firestore';
import type { IndonesianTimezone } from '@/lib/types';

export const TIMEZONE_OPTIONS: {
  value: IndonesianTimezone;
  label: string;
  iana: string;
  offset: string;
}[] = [
  {
    value: 'WIB',
    label: 'WIB — Waktu Indonesia Barat (UTC+7)',
    iana: 'Asia/Jakarta',
    offset: '+07:00',
  },
  {
    value: 'WITA',
    label: 'WITA — Waktu Indonesia Tengah (UTC+8)',
    iana: 'Asia/Makassar',
    offset: '+08:00',
  },
  {
    value: 'WIT',
    label: 'WIT — Waktu Indonesia Timur (UTC+9)',
    iana: 'Asia/Jayapura',
    offset: '+09:00',
  },
];

export function normalizeTimezone(tz?: string | null): IndonesianTimezone {
  if (tz === 'WITA' || tz === 'Asia/Makassar') return 'WITA';
  if (tz === 'WIT' || tz === 'Asia/Jayapura') return 'WIT';
  return 'WIB';
}

export function getTimezoneMeta(tz?: string | null) {
  const normalized = normalizeTimezone(tz);
  return TIMEZONE_OPTIONS.find((t) => t.value === normalized) || TIMEZONE_OPTIONS[0];
}

export function toDate(ts?: Timestamp | Date | number | null): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === 'number') return new Date(ts);
  if (typeof (ts as Timestamp).toDate === 'function') {
    return (ts as Timestamp).toDate();
  }
  return null;
}

export function formatWIB(
  ts?: Timestamp | Date | number | null,
  tz?: string | null
): string {
  const date = toDate(ts);
  if (!date) return '—';
  const meta = getTimezoneMeta(tz);
  return (
    new Intl.DateTimeFormat('id-ID', {
      timeZone: meta.iana,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date) + ` ${meta.value}`
  );
}

export function formatShortTimeWIB(
  ts?: Timestamp | Date | number | null,
  tz?: string | null
): string {
  const date = toDate(ts);
  if (!date) return '—';
  const meta = getTimezoneMeta(tz);
  return (
    new Intl.DateTimeFormat('id-ID', {
      timeZone: meta.iana,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date) + ` ${meta.value}`
  );
}

export function toDatetimeLocalWIB(
  ts?: Timestamp | Date | null,
  tz?: string | null
): string {
  const date = toDate(ts) || new Date();
  const meta = getTimezoneMeta(tz);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: meta.iana,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export function parseDatetimeLocalWIB(value: string, tz?: string | null): Date {
  const meta = getTimezoneMeta(tz);
  return new Date(`${value}:00${meta.offset}`);
}

export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return '00:00:00';
  const totalSec = Math.floor(msRemaining / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function formatDurationMs(ms?: number): string {
  if (!ms || ms < 1000) return '< 1 dtk';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} dtk`;
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${mins} mnt ${rem} dtk` : `${mins} mnt`;
}
