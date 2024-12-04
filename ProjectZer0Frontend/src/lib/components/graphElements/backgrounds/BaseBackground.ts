// ProjectZer0Frontend/src/lib/components/graphElements/backgrounds/BaseBackground.ts
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

export class ZoomBackground {
  private nodes: NetworkNode[];
  private width: number;
  private height: number;
  private viewportScale: number = 1.5;

  constructor(count: number = 35, width: number = 1920, height: number = 1080) {
    this.width = width * this.viewportScale;
    this.height = height * this.viewportScale;
    
    const nodeTypes: NavigationNodeType[] = [
      'explore', 'create-node', 'network', 
      'creations', 'interactions', 'edit-profile'
    ];

    // Create more interesting initial positions with better distribution
    this.nodes = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      connections: Array.from(
        { length: 2 + Math.floor(Math.random() * 3) }, // Increased max connections
        () => Math.floor(Math.random() * count)
      ).filter(n => n !== i),
      type: nodeTypes[Math.floor(Math.random() * nodeTypes.length)]
    }));
  }

  update(width?: number, height?: number) {
    if (width !== undefined) this.width = width * this.viewportScale;
    if (height !== undefined) this.height = height * this.viewportScale;

    this.nodes.forEach(node => {
      node.x += node.vx * 0.5;
      node.y += node.vy * 0.5;

      // Smoother wrapping
      if (node.x < -100) node.x = this.width + 98;
      if (node.x > this.width + 100) node.x = -98;
      if (node.y < -100) node.y = this.height + 98;
      if (node.y > this.height + 100) node.y = -98;

      // Slightly more dynamic movement
      node.vx += (Math.random() - 0.5) * 0.008;
      node.vy += (Math.random() - 0.5) * 0.008;

      // Maintain controlled speed
      const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (speed > 0.25) {
        node.vx = (node.vx / speed) * 0.25;
        node.vy = (node.vy / speed) * 0.25;
      }
    });
  }

  draw(ctx: CanvasRenderingContext2D) {
    const offsetX = (this.width - ctx.canvas.width) / 2;
    const offsetY = (this.height - ctx.canvas.height) / 2;
    
    const getSubtleColor = (type: NavigationNodeType) => {
      const baseColor = navigationColors[type];
      const r = parseInt(baseColor.slice(1, 3), 16);
      const g = parseInt(baseColor.slice(3, 5), 16);
      const b = parseInt(baseColor.slice(5, 7), 16);
      return {
        edge: `rgba(${r}, ${g}, ${b}, 0.08)`, // Increased from 0.03
        node: `rgba(${r}, ${g}, ${b}, 0.15)` // Increased from 0.1
      };
    };

    // Draw edges with enhanced gradients
    this.nodes.forEach(node => {
      const nodeColors = getSubtleColor(node.type);
      node.connections.forEach(targetIndex => {
        const target = this.nodes[targetIndex];
        const targetColors = getSubtleColor(target.type);
        
        const gradient = ctx.createLinearGradient(
          node.x - offsetX, node.y - offsetY,
          target.x - offsetX, target.y - offsetY
        );
        
        // Enhanced gradient with middle stop
        gradient.addColorStop(0, nodeColors.edge);
        gradient.addColorStop(0.5, `rgba(255, 255, 255, 0.04)`); // Added middle highlight
        gradient.addColorStop(1, targetColors.edge);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.2; // Slightly thicker lines
        ctx.beginPath();
        ctx.moveTo(node.x - offsetX, node.y - offsetY);
        ctx.lineTo(target.x - offsetX, target.y - offsetY);
        ctx.stroke();
      });
    });

    // Draw nodes with subtle glow
    this.nodes.forEach(node => {
      const nodeColors = getSubtleColor(node.type);
      
      // Subtle glow
      const glowGradient = ctx.createRadialGradient(
        node.x - offsetX, node.y - offsetY, 0,
        node.x - offsetX, node.y - offsetY, 6
      );
      glowGradient.addColorStop(0, nodeColors.node);
      glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(node.x - offsetX, node.y - offsetY, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Node center
      ctx.fillStyle = nodeColors.node;
      ctx.beginPath();
      ctx.arc(node.x - offsetX, node.y - offsetY, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}