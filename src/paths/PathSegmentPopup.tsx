import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import type {
  PathSegment,
} from '../models/Path';

import RichTextEditor
  from '../components/RichTextEditor';

import type {
  RichTextDocument,
} from '../models/RichText';

import type {
  FeaturePopupAction,
} from '../components/MapViewport';

type PathPopupTab =
  | 'description'
  | 'ruleset'
  | null;

interface PathSegmentPopupProps {
  segment: PathSegment;
  actions?: FeaturePopupAction[];
  position: {
    x: number;
    y: number;
  };

  onNameChange?: (
    segmentId: string,
    name: string
  ) => void;

  onSubtitleChange?: (
    segmentId: string,
    subtitle: string
  ) => void;

  onDescriptionChange?: (
    segmentId: string,
    description: RichTextDocument
  ) => void;

  onPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>
  ) => void;

  onPointerMove: (
    event: ReactPointerEvent<HTMLDivElement>
  ) => void;

  onPointerUp: (
    event: ReactPointerEvent<HTMLDivElement>
  ) => void;

  onPointerCancel: () => void;
}

export default function PathSegmentPopup({
  segment,
  actions = [],
  position,
  onNameChange,
  onSubtitleChange,
  onDescriptionChange,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: PathSegmentPopupProps) {
  const [
    editingName,
    setEditingName,
  ] = useState(false);

  const [
    nameDraft,
    setNameDraft,
  ] = useState('');

  const [
    editingSubtitle,
    setEditingSubtitle,
  ] = useState(false);

  const [
    subtitleDraft,
    setSubtitleDraft,
  ] = useState('');

  const [
    activeTab,
    setActiveTab,
  ] = useState<PathPopupTab>(null);

    const [
    actionsExpanded,
    setActionsExpanded,
  ] = useState(false);

  const [
    expandedActionId,
    setExpandedActionId,
  ] = useState<string | null>(null);

  useEffect(() => {
    setEditingName(false);
    setNameDraft(
      segment.name ?? ''
    );

    setEditingSubtitle(false);
    setSubtitleDraft(
      segment.subtitle ?? ''
    );

    setActiveTab(null);

    setActionsExpanded(false);
    setExpandedActionId(null);
  }, [segment.id]);

  function saveName() {
    const nextName =
      nameDraft.trim();

    setEditingName(false);

    if (
      nextName ===
      (segment.name ?? '')
    ) {
      return;
    }

    onNameChange?.(
      segment.id,
      nextName
    );
  }

  function cancelNameEdit() {
    setNameDraft(
      segment.name ?? ''
    );

    setEditingName(false);
  }

  function saveSubtitle() {
    const nextSubtitle =
      subtitleDraft.trim();

    setEditingSubtitle(false);

    if (
      nextSubtitle ===
      (segment.subtitle ?? '')
    ) {
      return;
    }

    onSubtitleChange?.(
      segment.id,
      nextSubtitle
    );
  }

  function cancelSubtitleEdit() {
    setSubtitleDraft(
      segment.subtitle ?? ''
    );

    setEditingSubtitle(false);
  }

  function toggleTab(
    tab: Exclude<PathPopupTab, null>
  ) {
    setActiveTab((current) =>
      current === tab
        ? null
        : tab
    );
  }

  return (
    <div
      className="feature-popup path-segment-popup"
      style={{
        left: position.x,
        top: position.y,
      }}
      onPointerDown={(event) =>
        event.stopPropagation()
      }
      onClick={(event) =>
        event.stopPropagation()
      }
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        className="feature-popup-header"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={
          onPointerCancel
        }
      >
        {editingName ? (
          <input
            className="feature-popup-name-input"
            type="text"
            value={nameDraft}
            onChange={(event) => {
              setNameDraft(
                event.target.value
              );
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
            onBlur={saveName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                saveName();
              }

              if (event.key === 'Escape') {
                event.preventDefault();
                cancelNameEdit();
              }
            }}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="feature-popup-name"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={() => {
              setNameDraft(
                segment.name ?? ''
              );

              setEditingName(true);
            }}
          >
            {segment.name?.trim() ||
              'Unnamed Path'}
          </button>
        )}

        {editingSubtitle ? (
          <input
            className="feature-popup-subtitle-input"
            type="text"
            value={subtitleDraft}
            placeholder="Subtitle"
            onChange={(event) => {
              setSubtitleDraft(
                event.target.value
              );
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
            onBlur={saveSubtitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                saveSubtitle();
              }

              if (event.key === 'Escape') {
                event.preventDefault();
                cancelSubtitleEdit();
              }
            }}
            autoFocus
          />
        ) : segment.subtitle?.trim() ? (
          <button
            type="button"
            className="feature-popup-subtitle"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={() => {
              setSubtitleDraft(
                segment.subtitle ?? ''
              );

              setEditingSubtitle(true);
            }}
          >
            {segment.subtitle}
          </button>
        ) : (
          <div className="feature-popup-subtitle-empty">
            <span />

            <button
              type="button"
              className="feature-popup-subtitle-add"
              title="Add subtitle"
              aria-label="Add subtitle"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={() => {
                setSubtitleDraft('');
                setEditingSubtitle(true);
              }}
            />

            <span />
          </div>
                )}
      </div>

      <div className="feature-popup-controls path-popup-controls">
        <div />

        <div className="feature-popup-control">
          <button
            type="button"
            className="feature-popup-control-toggle"
            aria-expanded={actionsExpanded}
            onClick={() => {
              setActionsExpanded(
                (current) => !current
              );

              setExpandedActionId(null);
            }}
          >
            Actions{' '}
            <span aria-hidden="true">
              ▾
            </span>
          </button>

          {actionsExpanded && (
            <div className="feature-popup-control-menu actions-menu">
              {actions.map((action) => {
                const hasChildren =
                  Boolean(
                    action.children?.length
                  );

                const submenuExpanded =
                  expandedActionId ===
                  action.id;

                return (
                  <div
                    key={action.id}
                    className="feature-popup-action-group"
                  >
                    <button
                      type="button"
                      disabled={
                        action.disabled
                      }
                      onClick={() => {
                        if (hasChildren) {
                          setExpandedActionId(
                            submenuExpanded
                              ? null
                              : action.id
                          );

                          return;
                        }

                        action.onInvoke?.();

                        setActionsExpanded(
                          false
                        );
                      }}
                    >
                      {action.label}

                      {hasChildren && (
                        <span
                          className="feature-popup-action-arrow"
                          aria-hidden="true"
                        >
                          ›
                        </span>
                      )}
                    </button>

                    {hasChildren &&
                      submenuExpanded && (
                        <div className="feature-popup-action-submenu">
                          {action.children!.map(
                            (child) => (
                              <button
                                key={
                                  child.id
                                }
                                type="button"
                                disabled={
                                  child.disabled
                                }
                                onClick={() => {
                                  child.onInvoke?.();

                                  setExpandedActionId(
                                    null
                                  );

                                  setActionsExpanded(
                                    false
                                  );
                                }}
                              >
                                {
                                  child.label
                                }
                              </button>
                            )
                          )}
                        </div>
                      )}
                  </div>
                );
              })}

              {actions.length === 0 && (
                <span className="feature-popup-no-actions">
                  No actions available.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="path-popup-extender">
        <div className="path-popup-tabs">
          <button
            type="button"
            className={[
              'path-popup-tab',
              activeTab === 'description'
                ? 'active'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={
              activeTab === 'description'
            }
            onClick={() =>
              toggleTab('description')
            }
          >
            Description
          </button>

          <button
            type="button"
            className={[
              'path-popup-tab',
              activeTab === 'ruleset'
                ? 'active'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={
              activeTab === 'ruleset'
            }
            onClick={() =>
              toggleTab('ruleset')
            }
          >
            Ruleset
          </button>
        </div>

        {activeTab && (
          <div className="path-popup-extension">
            {activeTab ===
            'description' ? (
              <RichTextEditor
                key={segment.id}
                value={segment.description}
                onChange={(description) => {
                  onDescriptionChange?.(
                    segment.id,
                    description
                  );
                }}
              />
            ) : (
              <div className="path-popup-ruleset-empty">
                No Ruleset data available.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}