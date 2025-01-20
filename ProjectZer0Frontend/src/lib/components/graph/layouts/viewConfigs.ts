// ProjectZer0Frontend/src/lib/components/graph/layouts/viewConfigs.ts
import type { ViewType, LayoutConfig } from '$lib/types/graph';

export const VIEW_CONFIGS: Record<ViewType, LayoutConfig> = {
    dashboard: {
        centerNode: true,
        navigationRadius: {
            preview: 130,
            detail: 355
        },
        forceConfig: {
            charge: -500,
            collisionStrength: 1.0
        }
    },
    'edit-profile': {
        centerNode: true,
        navigationRadius: {
            preview: 130,
            detail: 355
        },
        forceConfig: {
            charge: -500,
            collisionStrength: 1.0
        }
    },
    'create-node': {
        centerNode: true,
        navigationRadius: {
            preview: 130,
            detail: 355
        },
        forceConfig: {
            charge: -500,
            collisionStrength: 1.0
        }
    },
    word: {
        centerNode: true,
        navigationRadius: {
            preview: 130,
            detail: 355
        },
        forceConfig: {
            charge: {
                word: -500,
                definition: -300
            },
            collisionStrength: 0.8,
            linkStrength: 0.5
        }
    },
    statement: {
        centerNode: true,
        navigationRadius: {
            preview: 130,
            detail: 355
        },
        forceConfig: {
            charge: -500,
            collisionStrength: 1.0
        }
    },
    network: {
        centerNode: false,
        navigationRadius: {
            preview: 130,
            detail: 355
        },
        forceConfig: {
            charge: -500,
            collisionStrength: 1.0
        }
    }
};