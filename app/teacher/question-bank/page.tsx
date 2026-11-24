'use client';

import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { Plus, Trash2, Search, CheckCircle2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { MathText } from '@/components/MathText';
import { ImageUrlInput } from '@/components/ImageUrlInput';
import { QuestionImage } from '@/components/QuestionImage';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { questionSchema } from '@/lib/validation';
import type { QuestionBankItem, QuestionOption } from '@/lib/types';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];

function makeDefaultOptions(): QuestionOption[] {
  return [
    { id: 'opt_a', text: '' },
    { id: 'opt_b', text: '' },
    { id: 'opt_c', text: '' },
    { id: 'opt_d', text: '' },
  ];
}

export default function QuestionBankPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [options, setOptions] = useState<QuestionOption[]>(makeDefaultOptions);
  const [correctOptionId, setCorrectOptionId] = useState('opt_a');
  const [points, setPoints] = useState(1);
  const [explanation, setExplanation] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(collection(db, 'questionBank'), where('teacherId', '==', profile.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<QuestionBankItem, 'id'>),
        }));
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setItems(list);
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'questionBank')
    );
    return () => unsub();
  }, [profile?.uid]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError('');
    const parsed = questionSchema.safeParse({
      text,
      imageURL,
      options,
      correctOptionId,
      points,
      explanation,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Periksa kembali isian soal.');
      return;
    }

    setSaving(true);
    try {
      const ref = doc(collection(db, 'questionBank'));
      const tags = tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10);

      await setDoc(ref, {
        teacherId: profile.uid,
        ...(subject.trim() ? { subject: subject.trim() } : {}),
        text: parsed.data.text,
        ...(parsed.data.imageURL ? { imageURL: parsed.data.imageURL } : {}),
        options: parsed.data.options.map((o) => ({
          id: o.id,
          text: o.text,
          ...(o.imageURL ? { imageURL: o.imageURL } : {}),
        })),
        correctOptionId: parsed.data.correctOptionId,
        ...(parsed.data.explanation ? { explanation: parsed.data.explanation } : {}),
        points: parsed.data.points,
        ...(tags.length > 0 ? { tags } : {}),
        createdAt: serverTimestamp(),
      });

      setText('');
      setImageURL('');
      setOptions(makeDefaultOptions());
      setCorrectOptionId('opt_a');
      setPoints(1);
      setExplanation('');
      setTagsText('');
      setShowForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'questionBank');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'questionBank', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `questionBank/${id}`);
    }
  };

  const filtered = items.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.text.toLowerCase().includes(q) ||
      (item.subject || '').toLowerCase().includes(q) ||
      (item.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <AppShell
      requiredRole="teacher"
      title="Bank Soal Pribadi"
      actions={
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Tambah Soal
        </button>
      }
    >
      <div className="space-y-6">
        {showForm && (
          <form
            onSubmit={handleSave}
            className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900">Simpan Soal ke Bank Soal</h2>
            {error && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </p>
            )}
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mata Pelajaran</label>
                <input
                  type="text"
                  maxLength={100}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Contoh: Fisika"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bobot Poin</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tag (pisahkan koma)
                </label>
                <input
                  type="text"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="dinamika, kelas-xi"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teks Soal (mendukung rumus LaTeX seperti $x^2 + y^2$)
              </label>
              <textarea
                rows={3}
                required
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
              />
            </div>

            <ImageUrlInput
              label="Gambar Soal (Opsional — URL atau Link / ID Google Drive)"
              value={imageURL}
              onChange={setImageURL}
            />

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Opsi Jawaban (pilih 1 kunci benar)
                </label>
                <div className="flex gap-2">
                  {options.length < 5 && (
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((prev) => [
                          ...prev,
                          { id: `opt_${OPTION_LABELS[prev.length].toLowerCase()}`, text: '' },
                        ])
                      }
                      className="text-xs text-blue-700 font-semibold"
                    >
                      + Tambah Opsi
                    </button>
                  )}
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = options.slice(0, -1);
                        setOptions(next);
                        if (!next.some((o) => o.id === correctOptionId)) {
                          setCorrectOptionId(next[0].id);
                        }
                      }}
                      className="text-xs text-slate-500"
                    >
                      Kurangi Opsi
                    </button>
                  )}
                </div>
              </div>
              {options.map((opt, idx) => (
                <div key={opt.id} className="space-y-1.5 p-2.5 rounded-xl border border-stone-200 bg-stone-50/50">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="bankCorrect"
                      checked={correctOptionId === opt.id}
                      onChange={() => setCorrectOptionId(opt.id)}
                    />
                    <span className="w-6 text-xs font-bold text-slate-700">{OPTION_LABELS[idx]}</span>
                    <input
                      type="text"
                      required
                      value={opt.text}
                      onChange={(e) =>
                        setOptions((prev) =>
                          prev.map((o) => (o.id === opt.id ? { ...o, text: e.target.value } : o))
                        )
                      }
                      placeholder={`Isi opsi ${OPTION_LABELS[idx]}`}
                      className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div className="pl-11">
                    <ImageUrlInput
                      compact
                      placeholder={`URL / ID Google Drive gambar opsi ${OPTION_LABELS[idx]} (opsional)`}
                      value={opt.imageURL || ''}
                      onChange={(val) =>
                        setOptions((prev) =>
                          prev.map((o) => (o.id === opt.id ? { ...o, imageURL: val } : o))
                        )
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pembahasan (Opsional)
              </label>
              <textarea
                rows={2}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800"
              >
                {saving ? 'Menyimpan...' : 'Simpan ke Bank Soal'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-600"
              >
                Batal
              </button>
            </div>
          </form>
        )}

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari soal berdasarkan isi, mata pelajaran, atau tag..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-700/20"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Memuat bank soal...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center text-sm text-slate-500">
            Belum ada soal di bank soal pribadi Anda.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div key={item.id} className="bg-white border border-stone-200 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1.5">
                      {item.subject || 'Umum'} · Bobot {item.points} poin
                      {item.tags?.length ? ` · ${item.tags.join(', ')}` : ''}
                    </p>
                    <div className="text-sm font-medium text-slate-900">
                      <MathText text={item.text} />
                    </div>
                    {item.imageURL && (
                      <div className="mt-2.5">
                        <QuestionImage
                          src={item.imageURL}
                          alt="Ilustrasi soal bank soal"
                          className="max-h-52 rounded-lg border border-stone-200 object-contain"
                        />
                      </div>
                    )}
                    <div className="mt-3 grid sm:grid-cols-2 gap-2">
                      {item.options.map((opt, idx) => {
                        const isCorrect = opt.id === item.correctOptionId;
                        return (
                          <div
                            key={opt.id}
                            className={`px-3 py-2 rounded-lg border text-xs flex items-start gap-2 ${
                              isCorrect
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold'
                                : 'border-stone-200 bg-stone-50 text-slate-700'
                            }`}
                          >
                            <span>{OPTION_LABELS[idx]}.</span>
                            <div className="flex-1 min-w-0">
                              <MathText text={opt.text} />
                              {opt.imageURL && (
                                <QuestionImage
                                  src={opt.imageURL}
                                  alt={`Gambar opsi ${OPTION_LABELS[idx]}`}
                                  className="mt-1.5 max-h-24 rounded border border-stone-200 object-contain bg-white"
                                />
                              )}
                            </div>
                            {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id!)}
                    className="p-2 text-slate-400 hover:text-red-700 rounded-lg hover:bg-red-50"
                    title="Hapus dari bank soal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
