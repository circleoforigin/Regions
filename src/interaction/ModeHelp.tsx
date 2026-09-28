import type {
  InteractionMode,
} from './InteractionMode';

interface HelpRow {
  input: string;
  action: string;
}

const HELP: Partial<
  Record<InteractionMode, HelpRow[]>
> = {
  path: [
    {
      input: 'Ctrl + Left Click',
      action: 'Start / End Path',
    },
    {
      input: 'Right Click Path',
      action: 'Add Shape Point',
    },
    {
      input: 'Ctrl + Right Click Path',
      action: 'Split at Terminal',
    },
    {
      input: 'Drag Node',
      action: 'Move Node',
    },
    {
      input: 'Shift + Click Shape',
      action: 'Delete Shape Point',
    },
    {
      input: 'Shift + Click Path',
      action: 'Delete Path',
    },
  ],

  distance: [
    {
      input: 'Left Click',
      action: 'Add Measurement Point',
    },
    {
      input: 'Left Click Path',
      action: 'Measure to Path',
    },
    {
      input: 'Ctrl + Left Click Path',
      action: 'Measure Along Path',
    },
    {
      input: 'Right Click Node',
      action: 'Remove Point',
    },
    {
      input: 'Right Click Elsewhere',
      action: 'Clear Measurement',
    },
  ],
};

interface ModeHelpProps {
  mode: InteractionMode;
  waypointActive?: boolean;
}

export default function ModeHelp({
  mode,
  waypointActive = false,
}: ModeHelpProps) {
  const waypointRows: HelpRow[] = [
    {
      input: 'Left Click',
      action: 'Add Waypath Node',
    },
    {
      input: 'Left Click Path',
      action: 'Route to Path',
    },
    {
      input: 'Ctrl + Left Click Path',
      action: 'Route Along Path',
    },
    {
      input: 'Right Click Node',
      action: 'Remove Node',
    },
    {
      input: 'Right Click Elsewhere',
      action: 'Cancel Waypoint',
    },
    {
      input: 'Shift + Left Click',
      action: 'Set Waypoint',
    },
  ];

  const rows =
    waypointActive
      ? waypointRows
      : HELP[mode];

  if (!rows || rows.length === 0) {
    return null;
  }

  return (
    <div className="mode-help">
      <div className="mode-help-title">
        {waypointActive
            ? 'WAYPOINT'
            : mode.toUpperCase()}
      </div>

      {rows.map((row) => (
        <div
          className="mode-help-row"
          key={`${row.input}-${row.action}`}
        >
          <span className="mode-help-input">
            {row.input}
          </span>

          <span className="mode-help-action">
            {row.action}
          </span>
        </div>
      ))}
    </div>
  );
}