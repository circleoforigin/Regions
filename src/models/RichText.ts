export type RichTextBlockType = 'paragraph' | 'bullet' | 'numbered';

export interface RichTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface RichTextBlock {
  id: string;
  type: RichTextBlockType;
  runs: RichTextRun[];
}

export interface RichTextDocument {
  blocks: RichTextBlock[];
}

function createBlockId(): string {
  return crypto.randomUUID();
}

export function createEmptyRichTextDocument(): RichTextDocument {
  return {
    blocks: [{ id: createBlockId(), type: 'paragraph', runs: [] }],
  };
}

export function richTextFromPlainText(text: string): RichTextDocument {
  return {
    blocks: [{
      id: 'legacy-0',
      type: 'paragraph',
      runs: text ? [{ text }] : [],
    }],
  };
}

export function normalizeRichText(
  value: RichTextDocument | string | null | undefined
): RichTextDocument {
  if (typeof value === 'string') return richTextFromPlainText(value);
  if (!value || !Array.isArray(value.blocks)) {
    return createEmptyRichTextDocument();
  }

  const blocks = value.blocks.map((block, index) => ({
    id: typeof block?.id === 'string' ? block.id : `block-${index}`,
    type: block?.type === 'bullet' || block?.type === 'numbered'
      ? block.type
      : 'paragraph' as const,
    runs: Array.isArray(block?.runs)
      ? block.runs.filter((run) => typeof run?.text === 'string').map(
        (run) => ({
          text: run.text,
          bold: run.bold || undefined,
          italic: run.italic || undefined,
          underline: run.underline || undefined,
        })
      )
      : [],
  }));

  return blocks.length > 0 ? { blocks } : createEmptyRichTextDocument();
}

export function isRichTextEmpty(value: RichTextDocument): boolean {
  return value.blocks.every((block) => {
    return block.runs.every((run) => run.text.trim().length === 0);
  });
}
