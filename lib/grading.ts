import type { AnswerKey, ExamAttempt, ExamQuestion, StudentAnswerEntry } from './types';

export interface GradeComputation {
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  totalGradedQuestions: number;
  passed?: boolean;
}

export function gradeAttempt(
  questions: ExamQuestion[],
  answerKeys: Record<string, AnswerKey>,
  answers: Record<string, StudentAnswerEntry>,
  passingScore?: number
): GradeComputation {
  let score = 0;
  let maxScore = 0;
  let correctCount = 0;
  let totalGradedQuestions = 0;

  for (const q of questions) {
    if (q.voided === 'excluded') {
      continue;
    }
    totalGradedQuestions += 1;
    maxScore += q.points;

    if (q.voided === 'all_correct') {
      score += q.points;
      correctCount += 1;
      continue;
    }

    const key = answerKeys[q.id];
    const studentEntry = answers[q.id];
    if (key && studentEntry?.optionId && studentEntry.optionId === key.correctOptionId) {
      score += q.points;
      correctCount += 1;
    }
  }

  const percentage =
    maxScore > 0 ? Math.round(((score / maxScore) * 100 + Number.EPSILON) * 100) / 100 : 0;

  const passed =
    typeof passingScore === 'number' && !Number.isNaN(passingScore)
      ? percentage >= passingScore
      : undefined;

  return {
    score,
    maxScore,
    percentage,
    correctCount,
    totalGradedQuestions,
    passed,
  };
}

export interface QuestionItemAnalysis {
  questionId: string;
  order: number;
  text: string;
  correctOptionId: string;
  voided?: 'none' | 'all_correct' | 'excluded';
  totalResponses: number;
  correctResponses: number;
  correctRate: number;
  optionDistribution: Array<{
    optionId: string;
    label: string;
    text: string;
    count: number;
    percentage: number;
    isCorrect: boolean;
  }>;
}

export function analyzeExamItems(
  questions: ExamQuestion[],
  answerKeys: Record<string, AnswerKey>,
  attempts: ExamAttempt[]
): QuestionItemAnalysis[] {
  const submitted = attempts.filter((a) => a.status === 'submitted');
  const labels = ['A', 'B', 'C', 'D', 'E'];

  return questions.map((q) => {
    const key = answerKeys[q.id];
    const counts: Record<string, number> = {};
    for (const opt of q.options) {
      counts[opt.id] = 0;
    }

    let correctResponses = 0;
    for (const att of submitted) {
      const chosen = att.answers?.[q.id]?.optionId;
      if (chosen && counts[chosen] !== undefined) {
        counts[chosen] += 1;
      }
      if (q.voided === 'all_correct' || (key && chosen === key.correctOptionId)) {
        correctResponses += 1;
      }
    }

    const totalResponses = submitted.length;
    const correctRate =
      totalResponses > 0 ? Math.round((correctResponses / totalResponses) * 100) : 0;

    return {
      questionId: q.id,
      order: q.order,
      text: q.text,
      correctOptionId: key?.correctOptionId || '',
      voided: q.voided,
      totalResponses,
      correctResponses,
      correctRate,
      optionDistribution: q.options.map((opt, idx) => ({
        optionId: opt.id,
        label: labels[idx] || String(idx + 1),
        text: opt.text,
        count: counts[opt.id] || 0,
        percentage: totalResponses > 0 ? Math.round(((counts[opt.id] || 0) / totalResponses) * 100) : 0,
        isCorrect: key?.correctOptionId === opt.id,
      })),
    };
  });
}

export function buildCsv(headers: string[], rows: Array<Array<string | number | boolean | undefined>>): string {
  const escapeCell = (val: string | number | boolean | undefined) => {
    const str = val === undefined || val === null ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  return [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
}
