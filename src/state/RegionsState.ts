export interface RegionsViewportState {
  scale: number;
  panX: number;
  panY: number;
}

export interface RegionsPoint {
  x: number;
  y: number;
}

export interface RegionsLayerVisibility {
  features: boolean;
  locations: boolean;
  areas: boolean;
  zones: boolean;
  borders: boolean;
  boundary: boolean;
}

export type RegionsLayer = keyof RegionsLayerVisibility;

export const defaultLayerVisibility: RegionsLayerVisibility = {
  features: true,
  locations: true,
  areas: true,
  zones: true,
  borders: true,
  boundary: true,
};

export type RegionsEditingMode =
  | 'browse'
  | 'move-feature'
  | 'edit-feature';

export interface RegionsContextMenuState {
  kind: 'map' | 'feature';
  screenX: number;
  screenY: number;
  mapX: number;
  mapY: number;
  targetId?: string;
}

export interface RegionsNavigationEntry {
  mapId: string;
  focusFeatureId?: string;
}

export interface RegionsSessionState {
  activeProjectId: string | null;
  activeMapId: string | null;
  selectedFeatureId: string | null;
  selectedFeaturePopupOffset: RegionsPoint;
  layerVisibility: RegionsLayerVisibility;
  navigationHistory: RegionsNavigationEntry[];
  viewport: RegionsViewportState;
  editingMode: RegionsEditingMode;
  contextMenu: RegionsContextMenuState | null;
  movingFeatureId: string | null;
  movingFeaturePreviewPosition: RegionsPoint | null;
}

export type RegionsStateAction =
  | { type: 'session.reset' }
  | { type: 'project.activate'; projectId: string }
  | { type: 'map.activate'; mapId: string | null }
  | { type: 'feature.select'; featureId: string }
  | { type: 'feature.clearSelection' }
  | { type: 'featurePopup.setOffset'; offset: RegionsPoint }
  | { type: 'featurePopup.resetOffset' }
  | { type: 'layers.setVisibility'; layer: RegionsLayer; visible: boolean }
  | { type: 'viewport.set'; viewport: RegionsViewportState }
  | { type: 'viewport.setScale'; scale: number }
  | { type: 'viewport.setPan'; panX: number; panY: number }
  | { type: 'viewport.fit'; scale: number }
  | { type: 'contextMenu.open'; menu: RegionsContextMenuState }
  | { type: 'contextMenu.close' }
  | { type: 'editingMode.set'; mode: RegionsEditingMode }
  | {
      type: 'featureMove.start';
      featureId: string;
      position: RegionsPoint;
    }
  | { type: 'featureMove.preview'; position: RegionsPoint }
  | { type: 'featureMove.cancel' }
  | { type: 'navigation.push'; entry: RegionsNavigationEntry }
  | { type: 'navigation.back' }
  | { type: 'navigation.clear' };

export const initialRegionsState: RegionsSessionState = {
  activeProjectId: null,
  activeMapId: null,
  selectedFeatureId: null,
  selectedFeaturePopupOffset: { x: 0, y: 0 },
  layerVisibility: { ...defaultLayerVisibility },
  navigationHistory: [],
  viewport: {
    scale: 1,
    panX: 0,
    panY: 0,
  },
  editingMode: 'browse',
  contextMenu: null,
  movingFeatureId: null,
  movingFeaturePreviewPosition: null,
};

export function regionsStateReducer(
  state: RegionsSessionState,
  action: RegionsStateAction
): RegionsSessionState {
  switch (action.type) {
    case 'session.reset':
      return initialRegionsState;

    case 'project.activate':
      return {
        ...initialRegionsState,
        activeProjectId: action.projectId,
      };

    case 'map.activate':
      return {
        ...state,
        activeMapId: action.mapId,
        selectedFeatureId: null,
        selectedFeaturePopupOffset: { x: 0, y: 0 },
        viewport: initialRegionsState.viewport,
        editingMode: 'browse',
        contextMenu: null,
        movingFeatureId: null,
        movingFeaturePreviewPosition: null,
      };

    case 'feature.select':
      return {
        ...state,
        selectedFeatureId: action.featureId,
        selectedFeaturePopupOffset: { x: 0, y: 0 },
      };

    case 'feature.clearSelection':
      return {
        ...state,
        selectedFeatureId: null,
        selectedFeaturePopupOffset: { x: 0, y: 0 },
      };

    case 'featurePopup.setOffset':
      return { ...state, selectedFeaturePopupOffset: action.offset };

    case 'featurePopup.resetOffset':
      return {
        ...state,
        selectedFeaturePopupOffset: { x: 0, y: 0 },
      };

    case 'layers.setVisibility':
      return {
        ...state,
        layerVisibility: {
          ...(state.layerVisibility ?? defaultLayerVisibility),
          [action.layer]: action.visible,
        },
      };

    case 'viewport.set':
      return { ...state, viewport: action.viewport };

    case 'viewport.setScale':
      return {
        ...state,
        viewport: { ...state.viewport, scale: action.scale },
      };

    case 'viewport.setPan':
      return {
        ...state,
        viewport: {
          ...state.viewport,
          panX: action.panX,
          panY: action.panY,
        },
      };

    case 'viewport.fit':
      return {
        ...state,
        viewport: { scale: action.scale, panX: 0, panY: 0 },
      };

    case 'contextMenu.open':
      return { ...state, contextMenu: action.menu };

    case 'contextMenu.close':
      return { ...state, contextMenu: null };

    case 'editingMode.set':
      return { ...state, editingMode: action.mode };

    case 'featureMove.start':
      return {
        ...state,
        editingMode: 'move-feature',
        contextMenu: null,
        selectedFeatureId: null,
        movingFeatureId: action.featureId,
        movingFeaturePreviewPosition: action.position,
      };

    case 'featureMove.preview':
      return { ...state, movingFeaturePreviewPosition: action.position };

    case 'featureMove.cancel':
      return {
        ...state,
        editingMode: 'browse',
        movingFeatureId: null,
        movingFeaturePreviewPosition: null,
      };

    case 'navigation.push':
      return {
        ...state,
        navigationHistory: [...state.navigationHistory, action.entry],
      };

    case 'navigation.back': {
      const history = state.navigationHistory.slice(0, -1);
      const destination = history.at(-1);

      return {
        ...state,
        activeMapId: destination?.mapId ?? state.activeMapId,
        selectedFeatureId: destination?.focusFeatureId ?? null,
        navigationHistory: history,
        contextMenu: null,
      };
    }

    case 'navigation.clear':
      return { ...state, navigationHistory: [] };
  }
}
