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
      input: 'Ctrl + Click',
      action: 'Terminal',
    },
    {
      input: 'Right Click',
      action: 'Shape Point',
    },
    {
      input: 'Drag',
      action: 'Move Node',
    },
    {
      input: 'Shift + Click',
      action: 'Delete Shape / Path',
    },
  ],

  distance: [
    {
      input: 'Left Click',
      action: 'Measure',
    },
    {
      input: 'Right Click',
      action: 'Remove / Clear',
    },
  ],
};

interface ModeHelpProps {
  mode: InteractionMode;
}

export default function ModeHelp({
  mode,
}: ModeHelpProps) {
  const rows = HELP[mode];

  if (!rows || rows.length === 0) {
    return null;
  }

  return (
    <div className="mode-help">
      <div className="mode-help-title">
        {mode.toUpperCase()}
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