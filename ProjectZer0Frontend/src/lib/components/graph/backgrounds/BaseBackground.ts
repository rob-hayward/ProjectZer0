// ProjectZer0Frontend/src/lib/components/graph/backgrounds/BaseBackground.ts

interface BackgroundNode {
    x: number;
    y: number;
    vx: number;
    vy: number;
    connections: number[];
    style: {
      edge: string;
      node: string;
    };
  }
  
  export class BaseBackground {
    protected nodes: BackgroundNode[];
    protected width: number;
    protected height: number;
    protected viewportScale: number = 1.5;
  
    constructor(count: number = 35, width: number = 1920, height: number = 1080) {
      this.width = width * this.viewportScale;
      this.height = height * this.viewportScale;
      
      // Create nodes with basic styling
      this.nodes = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        connections: Array.from(
          { length: 2 + Math.floor(Math.random() * 3) },
          () => Math.floor(Math.random() * count)
        ).filter(n => n !== i),
        style: {
          edge: 'rgba(255, 255, 255, 0.08)',
          node: 'rgba(255, 255, 255, 0.15)'
        }
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
  
      // Draw edges with enhanced gradients
      this.nodes.forEach(node => {
        node.connections.forEach(targetIndex => {
          const target = this.nodes[targetIndex];
          
          const gradient = ctx.createLinearGradient(
            node.x - offsetX, node.y - offsetY,
            target.x - offsetX, target.y - offsetY
          );
          
          gradient.addColorStop(0, node.style.edge);
          gradient.addColorStop(0.5, `rgba(255, 255, 255, 0.04)`);
          gradient.addColorStop(1, target.style.edge);
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(node.x - offsetX, node.y - offsetY);
          ctx.lineTo(target.x - offsetX, target.y - offsetY);
          ctx.stroke();
        });
      });
  
      // Draw nodes with subtle glow
      this.nodes.forEach(node => {
        const glowGradient = ctx.createRadialGradient(
          node.x - offsetX, node.y - offsetY, 0,
          node.x - offsetX, node.y - offsetY, 6
        );
        glowGradient.addColorStop(0, node.style.node);
        glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(node.x - offsetX, node.y - offsetY, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = node.style.node;
        ctx.beginPath();
        ctx.arc(node.x - offsetX, node.y - offsetY, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  
    protected createGradient(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
      return ctx.createLinearGradient(x1, y1, x2, y2);
    }
  }