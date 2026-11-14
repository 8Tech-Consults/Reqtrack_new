import { Fragment, ReactNode } from 'react';
import clsx from 'clsx';

// Renders the small markdown subset used by help articles and assistant
// answers: paragraphs, "1." numbered lists, "-"/"*" bullet lists and
// **bold**. Builds React elements directly (never innerHTML), so content
// from the database or the AI provider can't inject markup.

const renderInline = (text: string): ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={index} className="font-semibold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  );

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ol' | 'ul'; items: string[] };

const parseBlocks = (source: string): Block[] => {
  const blocks: Block[] = [];
  for (const rawLine of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    const last = blocks[blocks.length - 1];
    if (!line) {
      blocks.push({ kind: 'p', lines: [] });
      continue;
    }
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (ordered || bullet) {
      const kind = ordered ? 'ol' : 'ul';
      const item = (ordered || bullet)![1];
      if (last && last.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
      continue;
    }
    if (last && last.kind === 'p') last.lines.push(line);
    else blocks.push({ kind: 'p', lines: [line] });
  }
  return blocks.filter((block) => (block.kind === 'p' ? block.lines.length > 0 : block.items.length > 0));
};

export const HelpText = ({ text, className }: { text: string; className?: string }) => (
  <div className={clsx('space-y-2 text-sm leading-relaxed text-slate-700', className)}>
    {parseBlocks(text || '').map((block, index) => {
      if (block.kind === 'p') {
        return <p key={index}>{renderInline(block.lines.join(' '))}</p>;
      }
      const ListTag = block.kind === 'ol' ? 'ol' : 'ul';
      return (
        <ListTag
          key={index}
          className={clsx('space-y-1 pl-5', block.kind === 'ol' ? 'list-decimal' : 'list-disc')}
        >
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ListTag>
      );
    })}
  </div>
);
