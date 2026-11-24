'use client';

import React from 'react';
import { Image as ImageIcon, X } from 'lucide-react';
import { extractGoogleDriveFileId, isValidImageInput } from '@/lib/image-url';
import { QuestionImage } from '@/components/QuestionImage';

interface ImageUrlInputProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  compact?: boolean;
}

export function ImageUrlInput({
  label,
  value,
  onChange,
  placeholder = 'Tempel URL gambar (https://...) atau Link / ID file Google Drive',
  compact = false,
}: ImageUrlInputProps) {
  const trimmed = value.trim();
  const driveId = trimmed ? extractGoogleDriveFileId(trimmed) : null;
  const isInvalid = Boolean(trimmed) && !isValidImageInput(trimmed);

  return (
    <div className="space-y-2">
      {label && <label className="block text-xs font-semibold text-slate-700">{label}</label>}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <ImageIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            maxLength={1000}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full pl-8 pr-3 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 ${
              compact ? 'py-1.5 text-xs' : 'py-2 text-sm'
            }`}
          />
        </div>
        {trimmed && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-2 rounded-lg border border-stone-200 text-slate-500 hover:text-red-700 hover:bg-red-50"
            title="Hapus gambar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isInvalid ? (
        <p className="text-[11px] text-red-700">
          Masukkan URL gambar yang valid (https://...) atau ID file Google Drive.
        </p>
      ) : driveId ? (
        <p className="text-[11px] text-blue-700">
          File Google Drive terdeteksi (<span className="font-mono">{driveId}</span>). Pastikan izin
          berbagi di Drive diatur ke &ldquo;Siapa saja yang memiliki link&rdquo;.
        </p>
      ) : !compact ? (
        <p className="text-[11px] text-slate-500">
          Mendukung URL gambar langsung (HTTPS) atau link / ID file Google Drive yang dibagikan publik.
        </p>
      ) : null}

      {trimmed && !isInvalid && (
        <div className="pt-1">
          <QuestionImage
            src={trimmed}
            alt="Pratinjau gambar"
            driveHint
            className={`${compact ? 'max-h-28' : 'max-h-44'} rounded-lg border border-stone-200 object-contain bg-white`}
          />
        </div>
      )}
    </div>
  );
}
