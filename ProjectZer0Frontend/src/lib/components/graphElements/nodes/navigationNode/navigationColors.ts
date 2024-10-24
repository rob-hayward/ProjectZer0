export const navigationColors = {
    explore: '#3498db',      // Vibrant blue
    'create-node': '#f1c40f', // Sunflower yellow
    network: '#9b59b6',      // Royal purple
    creations: '#2ecc71',    // Emerald green 
    interactions: '#1abc9c', // Turquoise
    'edit-profile': '#e67e22', // Carrot orange
    logout: '#e74c3c',       // Coral red
  } as const;
  
  export type NavigationNodeType = keyof typeof navigationColors;
  
  export function getNavigationColor(nodeId: string): string {
    return navigationColors[nodeId as NavigationNodeType] || navigationColors.explore;
  }