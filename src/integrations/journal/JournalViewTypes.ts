export interface JournalViewTextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;

  languageId?: string;
  targetEntryId?: string;
}

export interface JournalViewParagraph {
  indented: boolean;
  runs: JournalViewTextRun[];
}

export interface JournalViewInlineItem {
  runs: JournalViewTextRun[];
}

export interface JournalViewTitleFragment {
  type: 'title';
  text: string;
  top: number;
  height: number;
}

export interface JournalViewSubtitleFragment {
  type: 'subtitle';
  text: string;
  top: number;
  height: number;
}

export interface JournalViewBriefFragment {
  type: 'brief';
  text: string;
  top: number;
  height: number;
}

export interface JournalViewFieldFragment {
  type: 'field';
  text: string;
  top: number;
  height: number;
}

export interface JournalViewInlineFieldFragment {
  type: 'inlineField';
  label: string;
  items: JournalViewInlineItem[];
  top: number;
  height: number;
}

export interface JournalViewItemFragment {
  type: 'item';
  paragraphs: JournalViewParagraph[];

  top: number;
  height: number;

  left?: number;
  width?: number;
}

export type JournalViewFragment =
  | JournalViewTitleFragment
  | JournalViewSubtitleFragment
  | JournalViewBriefFragment
  | JournalViewFieldFragment
  | JournalViewInlineFieldFragment
  | JournalViewItemFragment;

export interface JournalViewPage {
  fragments: JournalViewFragment[];
}

export interface JournalViewPageResponse {
  pageCount: number;
  page: JournalViewPage;
}