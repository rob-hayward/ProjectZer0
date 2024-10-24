import { navigationColors } from '../nodes/navigationNode/navigationColors';
import type { NavigationNodeType } from '../nodes/navigationNode/navigationColors';

interface NetworkNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number[];
  type: NavigationNodeType;
}

export class NetworkBackground {
  private nodes: NetworkNode[];
  private width: number;
  private height: number;
  private viewportScale: number = 1.5; // Makes the animation area larger than viewport

  constructor(count: number = 25, width: number = 1920, height: number = 1080) {
    this.width = width * this.viewportScale;
    this.height = height * this.viewportScale;
    
    const nodeTypes: NavigationNodeType[] = [
      'explore', 'create-node', 'network', 
      'creations', 'interactions', 'edit-profile'
    ];

    this.nodes = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 0.1, // Reduced from 0.2 for slower movement
      vy: (Math.random() - 0.5) * 0.1, // Reduced from 0.2 for slower movement
      connections: Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => 
        Math.floor(Math.random() * count)).filter(n => n !== i),
      type: nodeTypes[Math.floor(Math.random() * nodeTypes.length)]
    }));
  }

  update(width?: number, height?: number) {
    if (width !== undefined) this.width = width * this.viewportScale;
    if (height !== undefined) this.height = height * this.viewportScale;

    this.nodes.forEach(node => {
      // Update position with slower movement
      node.x += node.vx * 0.5; // Added multiplier to slow down
      node.y += node.vy * 0.5; // Added multiplier to slow down

      // Wrap around instead of bouncing for infinite effect
      if (node.x < -100) node.x = this.width + 100;
      if (node.x > this.width + 100) node.x = -100;
      if (node.y < -100) node.y = this.height + 100;
      if (node.y > this.height + 100) node.y = -100;

      // Add very slight random movement
      node.vx += (Math.random() - 0.5) * 0.005; // Reduced from 0.01
      node.vy += (Math.random() - 0.5) * 0.005; // Reduced from 0.01

      // Limit velocity
      const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (speed > 0.2) { // Reduced from 0.5
        node.vx = (node.vx / speed) * 0.2;
        node.vy = (node.vy / speed) * 0.2;
      }
    });
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Offset to center the expanded animation area
    const offsetX = (this.width - ctx.canvas.width) / 2;
    const offsetY = (this.height - ctx.canvas.height) / 2;
    
    // Function to get very subtle color based on node type
    const getSubtleColor = (type: NavigationNodeType) => {
      const baseColor = navigationColors[type];
      // Convert hex to rgba with very low opacity
      const r = parseInt(baseColor.slice(1, 3), 16);
      const g = parseInt(baseColor.slice(3, 5), 16);
      const b = parseInt(baseColor.slice(5, 7), 16);
      return {
        edge: `rgba(${r}, ${g}, ${b}, 0.03)`,
        node: `rgba(${r}, ${g}, ${b}, 0.1)`
      };
    };

    // Draw edges first
    this.nodes.forEach(node => {
      const nodeColors = getSubtleColor(node.type);
      node.connections.forEach(targetIndex => {
        const target = this.nodes[targetIndex];
        const targetColors = getSubtleColor(target.type);
        
        // Create gradient for edge
        const gradient = ctx.createLinearGradient(
          node.x - offsetX, node.y - offsetY,
          target.x - offsetX, target.y - offsetY
        );
        gradient.addColorStop(0, nodeColors.edge);
        gradient.addColorStop(1, targetColors.edge);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(node.x - offsetX, node.y - offsetY);
        ctx.lineTo(target.x - offsetX, target.y - offsetY);
        ctx.stroke();
      });
    });

    // Draw nodes
    this.nodes.forEach(node => {
      const nodeColors = getSubtleColor(node.type);
      ctx.fillStyle = nodeColors.node;
      ctx.beginPath();
      ctx.arc(node.x - offsetX, node.y - offsetY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}