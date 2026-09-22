import {
  useEffect,
  useState,
} from 'react';

import {
  getJournalViewPage,
} from './JournalIntegration';

import JournalViewRenderer
  from './JournalViewRenderer';

import type {
  JournalViewPageResponse,
} from './JournalViewTypes';

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
  const [
    response,
    setResponse,
  ] = useState<
    JournalViewPageResponse | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (
      !open ||
      !entryId
    ) {
      setResponse(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    void getJournalViewPage(
      entryId,
      pageIndex
    )
      .then((result) => {
        if (cancelled) {
          return;
        }

        setResponse(result);
      })
      .catch((requestError) => {
        if (cancelled) {
          return;
        }

        setResponse(null);

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load Journal page.'
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    entryId,
    pageIndex,
  ]);

  const pageCount =
    response?.pageCount ?? 0;

  const canGoPrevious =
    !loading &&
    pageIndex > 0;

  const canGoNext =
    !loading &&
    pageCount > 0 &&
    pageIndex < pageCount - 1;

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

          {loading && (
            <div className="journal-view-status">
              Loading Journal...
            </div>
          )}

          {!loading &&
            error && (
              <div className="journal-view-status">
                {error}
              </div>
            )}

          {!loading &&
            !error &&
            response && (
              <JournalViewRenderer
  page={response.page}
  presentation={
    response.presentation
  }
  onReferenceClick={(
                  targetEntryId
                ) => {
                  console.log(
                    '[Regions] Journal View reference:',
                    targetEntryId
                  );
                }}
              />
            )}

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