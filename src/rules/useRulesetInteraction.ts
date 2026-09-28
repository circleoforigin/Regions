import {
  useEffect,
  useState,
} from 'react';

import {
  getRulesetInteraction,
  type ActiveRulesetInteraction,
} from './RulesetInteraction';

export function useRulesetInteraction(
  target: string
) {
  const [
    interaction,
    setInteraction,
  ] = useState<
    ActiveRulesetInteraction | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setInteraction(null);

    void getRulesetInteraction(
      target
    )
      .then((result) => {
        if (cancelled) {
          return;
        }

        setInteraction(result);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.error(
          `Unable to load Ruleset interaction for "${target}".`,
          error
        );

        setInteraction(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [target]);

  return {
    interaction,
    loading,
  };
}