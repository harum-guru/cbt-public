'use client';

import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { resolveDisplayImageUrl } from '@/lib/image-url';

interface QuestionImageProps {
  src?: string;
  alt: string;
  className?: string;
  driveHint?: boolean;
}

export function QuestionImage({
  src,
  alt,
  className = 'max-h-64 rounded-xl border border-stone-200 object-contain',
  driveHint = false,
}: QuestionImageProps) {
  const resolved = resolveDisplayImageUrl(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!resolved) return null;

  if (failedSrc === resolved) {
    return (
      <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900 flex items-start gap-2">
        <ImageOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Gambar gagal dimuat</p>
          <p className="text-[11px] text-amber-800 mt-0.5">
            {driveHint
              ? 'Jika memakai Google Drive, pastikan akses file diatur ke "Siapa saja yang memiliki link" (Pengakses Lihat / Viewer).'
              : 'Periksa kembali URL gambar atau ID file Google Drive yang dimasukkan.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={resolved}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailedSrc(resolved)}
      className={className}
    />
  );
}
