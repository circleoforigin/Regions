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
  routeActive?: boolean;
  areaActive?: boolean;
}

export default function ModeHelp({
  mode,
  routeActive = false,
  areaActive = false,
}: ModeHelpProps) {
      const areaRows: HelpRow[] = [
    {
      input: 'Shift + Left Click',
      action: 'Start Area',
    },
    {
      input: 'Shift + Left Click Node',
      action: 'Start Attached Area',
    },
    {
      input: 'Left Click',
      action: 'Add Boundary Node',
    },
    {
      input: 'Left Click Origin',
      action: 'Complete Area',
    },
    {
      input: 'Left Click Edge',
      action: 'Insert Boundary Node',
    },
    {
      input: 'Drag Node',
      action: 'Adjust Boundary',
    },
    {
      input: 'Right Click Node',
      action: 'Delete Node',
    },
    {
      input: 'Right Click Draft Origin',
      action: 'Cancel Area',
    },
    {
      input: 'Right Click Area Icon',
      action: 'Area Options',
    },
  ];
  const routeRows: HelpRow[] = [
    {
      input: 'Left Click',
      action: 'Add Route Node',
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
      action: 'Cancel Route',
    },
    {
      input: 'Shift + Left Click',
      action: 'Set Route',
    },
  ];

  const rows =
    areaActive
      ? areaRows
      : routeActive
        ? routeRows
        : HELP[mode];

  if (!rows || rows.length === 0) {
    return null;
  }

  return (
    <div className="mode-help">
      <div className="mode-help-title">
{areaActive
  ? 'AREA'
  : routeActive
    ? 'ROUTE'
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