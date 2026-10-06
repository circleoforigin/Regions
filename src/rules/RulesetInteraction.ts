import type {
  RulesetInteractionDefinition,
  RulesetInteractionDerivedResult,
} from '@settingforge/module-sdk';
import { moduleEventBus } from '../host/ModuleBus';

export interface ActiveRulesetInteraction
{
  rulesetId: string;
  rulesetName: string;
  rulesetVersion: string;
  interaction: RulesetInteractionDefinition;
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

export async function deriveRulesetInteraction(
  target: string,
  values: Record<string, unknown>
): Promise<RulesetInteractionDerivedResult | null>
{
  if (!moduleEventBus.hosted)
  {
    return null;
  }

  return moduleEventBus.request<
    RulesetInteractionDerivedResult | null
  >(
    'rules.deriveInteraction',
    {
      target,
      values,
    }
  );
}