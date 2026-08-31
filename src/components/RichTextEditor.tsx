import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import type {
  RichTextBlockType,
  RichTextDocument,
  RichTextRun,
} from '../models/RichText';
import {
  isRichTextEmpty,
  normalizeRichText,
} from '../models/RichText';

interface RichTextEditorProps {
  value: RichTextDocument | string | undefined;
  onChange: (value: RichTextDocument) => void;
}

interface FormatMenuState {
  x: number;
  y: number;
  hasSelection: boolean;
}

interface RunMarks {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

function sameMarks(left: RichTextRun, right: RichTextRun): boolean {
  return Boolean(left.bold) === Boolean(right.bold) &&
    Boolean(left.italic) === Boolean(right.italic) &&
    Boolean(left.underline) === Boolean(right.underline);
}

function readRuns(node: Node, marks: RunMarks = {}): RichTextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ? [{ text: node.textContent, ...marks }] : [];
  }
  if (!(node instanceof HTMLElement)) return [];
  if (node.tagName === 'BR') return [];

  const nextMarks = { ...marks };
  const weight = node.style.fontWeight;
  if (node.tagName === 'B' || node.tagName === 'STRONG') {
    nextMarks.bold = true;
  }
  if (weight === 'bold' || Number(weight) >= 600) nextMarks.bold = true;
  if (node.tagName === 'I' || node.tagName === 'EM') {
    nextMarks.italic = true;
  }
  if (node.style.fontStyle === 'italic') nextMarks.italic = true;
  if (node.tagName === 'U') nextMarks.underline = true;
  if (node.style.textDecoration.includes('underline')) {
    nextMarks.underline = true;
  }

  return Array.from(node.childNodes).flatMap((child) => {
    return readRuns(child, nextMarks);
  });
}

function mergeRuns(runs: RichTextRun[]): RichTextRun[] {
  return runs.reduce<RichTextRun[]>((merged, run) => {
    const previous = merged.at(-1);
    if (previous && sameMarks(previous, run)) {
      previous.text += run.text;
      return merged;
    }
    merged.push({ ...run });
    return merged;
  }, []);
}

function readEditorDocument(
  root: HTMLElement,
  previous: RichTextDocument
): RichTextDocument {
  const blocks: RichTextDocument['blocks'] = [];

  const addBlock = (node: Node, type: RichTextBlockType) => {
    blocks.push({
      id: previous.blocks[blocks.length]?.id ?? crypto.randomUUID(),
      type,
      runs: mergeRuns(readRuns(node)),
    });
  };

  Array.from(root.childNodes).forEach((node) => {
    if (node instanceof HTMLUListElement) {
      Array.from(node.children).forEach((item) => addBlock(item, 'bullet'));
      return;
    }
    if (node instanceof HTMLOListElement) {
      Array.from(node.children).forEach((item) => addBlock(item, 'numbered'));
      return;
    }
    if (node instanceof HTMLElement) {
      const type = node.dataset.blockType as RichTextBlockType | undefined;
      addBlock(node, type ?? 'paragraph');
      return;
    }
    if (node.textContent) addBlock(node, 'paragraph');
  });

  return normalizeRichText({ blocks });
}

function writeEditorDocument(
  root: HTMLElement,
  value: RichTextDocument
) {
  const elements = value.blocks.map((block) => {
    const element = document.createElement('div');
    element.className = `rich-text-block ${block.type}`;
    element.dataset.blockType = block.type;

    if (block.runs.length === 0) {
      element.append(document.createElement('br'));
      return element;
    }

    block.runs.forEach((run) => {
      const span = document.createElement('span');
      span.textContent = run.text;
      if (run.bold) span.style.fontWeight = 'bold';
      if (run.italic) span.style.fontStyle = 'italic';
      if (run.underline) span.style.textDecoration = 'underline';
      element.append(span);
    });
    return element;
  });

  root.replaceChildren(...elements);
}

function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const [formatMenu, setFormatMenu] = useState<FormatMenuState | null>(null);
  const [initialDocument] = useState(() => normalizeRichText(value));
  const documentRef = useRef(initialDocument);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<Range | null>(null);

  useEffect(() => {
    if (!formatMenu) return;

    const closeMenu = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      setFormatMenu(null);
      selectionRef.current = null;
    };

    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, [formatMenu]);

  function updateFromDom() {
    const editor = editorRef.current;
    if (!editor) return;
    const currentValue = documentRef.current;
    const nextValue = readEditorDocument(editor, currentValue);
    if (JSON.stringify(nextValue) === JSON.stringify(currentValue)) return;
    documentRef.current = nextValue;
    editor.classList.toggle('empty', isRichTextEmpty(nextValue));
    onChange(nextValue);
  }

  function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const editor = editorRef.current;
    const selectionIsInside = Boolean(
      range && editor?.contains(range.commonAncestorContainer)
    );
    selectionRef.current = selectionIsInside ? range?.cloneRange() ?? null : null;
    setFormatMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 180)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 190)),
      hasSelection: Boolean(selectionIsInside && !range?.collapsed),
    });
  }

  function applyCommand(command: string) {
    const editor = editorRef.current;
    const range = selectionRef.current;
    if (!editor || !range) return;

    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand(command, false);
    updateFromDom();
    setFormatMenu(null);
    selectionRef.current = null;
  }

  return (
    <div className="feature-description-section">
      <div className="feature-description-label">Description</div>
      <div
        ref={(element) => {
          editorRef.current = element;
          if (element && element.childNodes.length === 0) {
            writeEditorDocument(element, initialDocument);
          }
        }}
        className={isRichTextEmpty(initialDocument)
          ? 'rich-text-editor empty'
          : 'rich-text-editor'}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder="Add a brief description..."
        onInput={updateFromDom}
        onContextMenu={handleContextMenu}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget;
          if (nextTarget instanceof Node && menuRef.current?.contains(nextTarget)) {
            return;
          }
          setFormatMenu(null);
          selectionRef.current = null;
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      />

      {formatMenu && createPortal(
        <div
          ref={menuRef}
          className="rich-text-format-menu"
          style={{ left: formatMenu.x, top: formatMenu.y }}
          onPointerDown={(event) => event.preventDefault()}
        >
          <button
            type="button"
            disabled={!formatMenu.hasSelection}
            onClick={() => applyCommand('bold')}
          >
            Bold
          </button>
          <button
            type="button"
            disabled={!formatMenu.hasSelection}
            onClick={() => applyCommand('italic')}
          >
            Italic
          </button>
          <button
            type="button"
            disabled={!formatMenu.hasSelection}
            onClick={() => applyCommand('underline')}
          >
            Underline
          </button>
          <div className="rich-text-format-separator" />
          <button
            type="button"
            onClick={() => applyCommand('insertUnorderedList')}
          >
            Bullet List
          </button>
          <button
            type="button"
            onClick={() => applyCommand('insertOrderedList')}
          >
            Numbered List
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

export default RichTextEditor;
