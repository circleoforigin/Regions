import type {
  JournalViewPage,
  JournalViewTextRun,
} from './JournalViewTypes';

interface JournalViewRendererProps {
  page: JournalViewPage;
  onReferenceClick?: (
    targetEntryId: string
  ) => void;
}

function JournalViewRenderer({
  page,
  onReferenceClick,
}: JournalViewRendererProps) {
  function renderRuns(
    runs: JournalViewTextRun[]
  ) {
    return runs.map((run, index) => {
      const isReference =
        Boolean(run.targetEntryId);

      return (
        <span
          key={index}
          className={
            isReference
              ? 'journal-view-reference'
              : undefined
          }
          data-language-id={run.languageId}
          style={{
            fontWeight: run.bold
              ? 700
              : undefined,
            fontStyle: run.italic
              ? 'italic'
              : undefined,
            textDecoration: run.underline
              ? 'underline'
              : undefined,
          }}
          onClick={
            isReference &&
            run.targetEntryId &&
            onReferenceClick
              ? (event) => {
                  event.stopPropagation();

                  onReferenceClick(
                    run.targetEntryId!
                  );
                }
              : undefined
          }
        >
          {run.text}
        </span>
      );
    });
  }

  return (
    <div className="journal-view-renderer">
      {page.fragments.map(
        (fragment, fragmentIndex) => {
          const baseStyle = {
            top: fragment.top,
            height: fragment.height,
          };

          if (fragment.type === 'title') {
            return (
              <div
                key={fragmentIndex}
                className="journal-view-entry-title"
                style={baseStyle}
              >
                {fragment.text}
              </div>
            );
          }

          if (fragment.type === 'subtitle') {
            return (
              <div
                key={fragmentIndex}
                className="journal-view-entry-subtitle"
                style={baseStyle}
              >
                {fragment.text}
              </div>
            );
          }

          if (fragment.type === 'brief') {
            return (
              <div
                key={fragmentIndex}
                className="journal-view-entry-brief"
                style={baseStyle}
              >
                {fragment.text}
              </div>
            );
          }

          if (fragment.type === 'field') {
            return (
              <div
                key={fragmentIndex}
                className="journal-view-field-label"
                style={baseStyle}
              >
                {fragment.text}
              </div>
            );
          }

          if (fragment.type === 'inlineField') {
            return (
              <div
                key={fragmentIndex}
                className="journal-view-inline-field"
                style={baseStyle}
              >
                <strong>
                  {fragment.label} -{' '}
                </strong>

                {fragment.items.map(
                  (item, itemIndex) => (
                    <span key={itemIndex}>
                      {renderRuns(item.runs)}

                      {itemIndex <
                      fragment.items.length - 1
                        ? ', '
                        : ''}
                    </span>
                  )
                )}
              </div>
            );
          }

          return (
            <div
              key={fragmentIndex}
              className="journal-view-item"
              style={{
                ...baseStyle,
                left: fragment.left ?? 0,
                width:
                  fragment.width ?? '100%',
              }}
            >
              {fragment.paragraphs.map(
                (paragraph, paragraphIndex) => (
                  <div
                    key={paragraphIndex}
                    className="journal-view-paragraph"
                    style={{
                      textIndent:
                        paragraph.indented
                          ? '2em'
                          : 0,
                    }}
                  >
                    {renderRuns(
                      paragraph.runs
                    )}
                  </div>
                )
              )}
            </div>
          );
        }
      )}
    </div>
  );
}

export default JournalViewRenderer;