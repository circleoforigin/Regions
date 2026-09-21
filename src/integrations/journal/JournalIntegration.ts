import {
  moduleEventBus,
} from '../../host/ModuleBus';

export interface JournalSectionSummary {
  sectionId: string;
  sectionName: string;
}

export interface JournalSectionsResponse {
  projectId: string;
  sections: JournalSectionSummary[];
}

export interface JournalCreatePageRequest {
  sectionId: string;
  title: string;
  subtitle?: string;
  brief: string;
}

export interface JournalPageSummary {
  pageId: string;
  title: string;
  subtitle: string;
  brief: string;
  sectionId: string;
  sectionName: string;
}

export async function getJournalSections():
  Promise<JournalSectionsResponse> {
  return moduleEventBus.command<JournalSectionsResponse>(
    'journal',
    'Journal.GetSections',
    {}
  );
}

export async function createJournalPage(
  request: JournalCreatePageRequest
): Promise<JournalPageSummary> {
  return moduleEventBus.command<JournalPageSummary>(
    'journal',
    'Journal.CreatePage',
    request
  );
}

export async function goToJournalPage(
  pageId: string
): Promise<void> {
  await moduleEventBus.command(
    'journal',
    'Journal.GoToPage',
    {
      pageId,
    },
    {
      focus: true,
    }
  );
}