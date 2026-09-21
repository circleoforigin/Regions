import JournalViewRenderer
  from './JournalViewRenderer';

import type {
  JournalViewPage,
} from './JournalViewTypes';


const mockJournalPage: JournalViewPage = {
  fragments: [
    {
      type: 'title',
      text: 'The Ruined Shrine',
      top: 0,
      height: 36,
    },
    {
      type: 'subtitle',
      text: 'Temple of the Old Gods',
      top: 40,
      height: 24,
    },
    {
      type: 'brief',
      text:
        'A crumbling shrine hidden among the foothills, ' +
        'abandoned long enough that no living resident ' +
        'remembers who first worshipped here.',
      top: 88,
      height: 70,
    },
    {
      type: 'field',
      text: 'Rumors',
      top: 184,
      height: 24,
    },
    {
      type: 'item',
      top: 216,
      height: 46,
      paragraphs: [
        {
          indented: false,
          runs: [
            {
              text:
                'Travelers report strange lights moving ' +
                'through the ruins after sunset.',
              bold: false,
              italic: false,
              underline: false,
            },
          ],
        },
      ],
    },
    {
      type: 'item',
      top: 274,
      height: 66,
      paragraphs: [
        {
          indented: false,
          runs: [
            {
              text:
                'Several locals insist the activity is ' +
                'connected to ',
              bold: false,
              italic: false,
              underline: false,
            },
            {
              text: 'the Black Abbey',
              bold: false,
              italic: false,
              underline: true,
              targetEntryId: 'mock-black-abbey',
            },
            {
              text: '.',
              bold: false,
              italic: false,
              underline: false,
            },
          ],
        },
      ],
    },
    {
      type: 'field',
      text: 'Notes',
      top: 366,
      height: 24,
    },
    {
      type: 'item',
      top: 398,
      height: 66,
      paragraphs: [
        {
          indented: false,
          runs: [
            {
              text:
                'The altar bears an unfamiliar rune beneath ' +
                'several layers of soot and weathering.',
              bold: false,
              italic: false,
              underline: false,
            },
          ],
        },
      ],
    },
  ],
};

interface JournalViewPanelProps {
  open: boolean;
  entryId: string | null;
  pageIndex: number;
  onClose: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

function JournalViewPanel({
  open,
  entryId,
  pageIndex,
  onClose,
  onPreviousPage,
  onNextPage,
}: JournalViewPanelProps) {
  const mockPageCount = 3;

  const canGoPrevious = pageIndex > 0;
  const canGoNext = pageIndex < mockPageCount - 1;

  return (
    <aside
      className={
        open
          ? 'journal-view-panel journal-view-panel-open'
          : 'journal-view-panel'
      }
      aria-hidden={!open}
    >
      <div className="journal-view-content">
        <div className="journal-view-page">
          {canGoPrevious && (
            <button
              type="button"
              className="
                journal-view-page-turn
                journal-view-page-turn-previous
              "
              onClick={onPreviousPage}
              aria-label="Previous Journal page"
            >
              ‹
            </button>
          )}

          {canGoNext && (
            <button
              type="button"
              className="
                journal-view-page-turn
                journal-view-page-turn-next
              "
              onClick={onNextPage}
              aria-label="Next Journal page"
            >
              ›
            </button>
          )}

          <JournalViewRenderer
  page={mockJournalPage}
  onReferenceClick={(targetEntryId) => {
    console.log(
      '[Regions] Journal View reference:',
      targetEntryId
    );
  }}
/>           

          <div className="journal-view-mock-debug">
            Mock Entry: {entryId ?? 'none'}
          </div>

          <button
            type="button"
            className="journal-view-close"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </aside>
  );
}

export default JournalViewPanel;