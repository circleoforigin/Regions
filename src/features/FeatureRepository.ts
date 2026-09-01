import {
  hostedCollectionRepository,
} from '../host/HostedCollectionRepository';
import type { Feature } from '../models/Feature';

const FEATURES_COLLECTION = 'features';

export class FeatureRepository {
  async loadFeature(featureId: string): Promise<Feature | null> {
    return hostedCollectionRepository.load<Feature>(
      FEATURES_COLLECTION,
      featureId
    );
  }

  async loadFeatures(featureIds: string[]): Promise<Feature[]> {
    if (featureIds.length === 0) return [];

    const features = await hostedCollectionRepository.loadMany<Feature>(
      FEATURES_COLLECTION,
      featureIds
    );

    features.forEach((feature, index) => {
      if (feature) return;
      console.warn(`Feature "${featureIds[index]}" was not found.`);
    });

    return features.filter(
      (feature): feature is Feature => feature !== null
    );
  }

  async saveFeature(feature: Feature): Promise<void> {
    await hostedCollectionRepository.save(
      FEATURES_COLLECTION,
      feature.id,
      feature
    );
  }

  async deleteFeature(featureId: string): Promise<boolean> {
    return hostedCollectionRepository.delete(
      FEATURES_COLLECTION,
      featureId
    );
  }
}

export const featureRepository = new FeatureRepository();
