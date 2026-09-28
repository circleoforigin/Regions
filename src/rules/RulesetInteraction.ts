import type {
  RulesetInteractionDefinition,
} from '@settingforge/module-sdk';

import {
  moduleEventBus,
} from '../host/ModuleBus';

export interface ActiveRulesetInteraction {
  rulesetId: string;
  rulesetVersion: string;
  interaction:
    RulesetInteractionDefinition;
}

export async function getRulesetInteraction(
  target: string
): Promise<
  ActiveRulesetInteraction | null
> {
  if (!moduleEventBus.hosted) {
    return null;
  }

  return moduleEventBus.request<
    ActiveRulesetInteraction | null
  >(
    'rules.getInteraction',
    {
      target,
    }
  );
}