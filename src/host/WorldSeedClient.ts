
import {
  moduleEventBus,
} from './ModuleBus';

export interface WorldSeedContext
{
  worldId: string;
  seed: number;
}

export async function getWorldSeed():
  Promise<WorldSeedContext | null>
{
  if (!moduleEventBus.hosted)
  {
    return null;
  }

  const response =
    await moduleEventBus.request(
      'world.getSeed'
    );

  if (
    !response ||
    typeof response !== 'object'
  )
  {
    throw new Error(
      'Invalid World seed response.'
    );
  }

  const context =
    response as Partial<WorldSeedContext>;

  if (
    typeof context.worldId !== 'string' ||
    !context.worldId ||
    typeof context.seed !== 'number' ||
    !Number.isSafeInteger(context.seed) ||
    context.seed < 0 ||
    context.seed > 0xFFFFFFFF
  )
  {
    throw new Error(
      'Invalid World seed context.'
    );
  }

  return {
    worldId: context.worldId,
    seed: context.seed,
  };
}
