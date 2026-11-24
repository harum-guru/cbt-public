'use client';

import React, { useMemo } from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
}

type Segment =
  | { type: 'text'; value: string }
  | { type: 'inline-math'; value: string }
  | { type: 'block-math'; value: string };

function splitMath(input: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: input.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ type: 'block-math', value: match[1].trim() });
    } else if (match[2] !== undefined) {
      segments.push({ type: 'inline-math', value: match[2].trim() });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < input.length) {
    segments.push({ type: 'text', value: input.slice(lastIndex) });
  }
  return segments;
}

function renderSimpleInline(text: string, keyPrefix: string): React.ReactNode[] {
  // Supports **bold** and *italic* safely via React nodes (no raw HTML injection)
  const nodes: React.ReactNode[] = [];
  const lines = text.split('\n');

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) {
      nodes.push(<br key={`${keyPrefix}-br-${lineIdx}`} />);
    }
    const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let partIdx = 0;
    while ((m = tokenRegex.exec(line)) !== null) {
      if (m.index > last) {
        nodes.push(line.slice(last, m.index));
      }
      const token = m[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        nodes.push(
          <strong key={`${keyPrefix}-${lineIdx}-${partIdx++}`} className="font-semibold text-slate-900">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        nodes.push(
          <em key={`${keyPrefix}-${lineIdx}-${partIdx++}`} className="italic">
            {token.slice(1, -1)}
          </em>
        );
      }
      last = m.index + token.length;
    }
    if (last < line.length) {
      nodes.push(line.slice(last));
    }
  });

  return nodes;
}

export function MathText({ text, className = '' }: MathTextProps) {
  const rendered = useMemo(() => {
    const parts = splitMath(text || '');
    return parts.map((seg, idx) => {
      if (seg.type === 'text') {
        return <React.Fragment key={idx}>{renderSimpleInline(seg.value, `t-${idx}`)}</React.Fragment>;
      }
      const html = katex.renderToString(seg.value, {
        displayMode: seg.type === 'block-math',
        throwOnError: false,
        strict: false,
        trust: false,
      });
      if (seg.type === 'block-math') {
        return (
          <span
            key={idx}
            className="block my-2 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }
      return (
        <span
          key={idx}
          className="inline-block align-middle"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    });
  }, [text]);

  return <span className={className}>{rendered}</span>;
}
