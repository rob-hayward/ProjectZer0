// export interface PreviewTextConfig {
//   font: string;
//   color: string;
//   align: CanvasTextAlign;
//   baseline: CanvasTextBaseline;
// }

// // Base text styles that can be customized per implementation
// export const PREVIEW_TEXT_STYLES = {
//   word: {
//       title: {
//           font: '24px "Orbitron", sans-serif',
//           color: 'rgba(255, 255, 255, 0.9)',
//           align: 'center' as const,
//           baseline: 'middle' as const
//       },
//       value: {
//           font: '26px "Orbitron", sans-serif',
//           color: 'rgba(255, 255, 255, 1)',
//           align: 'center' as const,
//           baseline: 'middle' as const
//       },
//       hover: {
//           font: '14px "Orbitron", sans-serif',
//           color: 'rgba(255, 255, 255, 0.7)',
//           align: 'center' as const,
//           baseline: 'middle' as const
//       }
//   },
//   definition: {
//       title: {
//           font: '18px "Orbitron", sans-serif',
//           color: 'rgba(255, 255, 255, 0.9)',
//           align: 'left' as const,
//           baseline: 'middle' as const
//       },
//       value: {
//           font: '16px "Orbitron", sans-serif',
//           color: 'rgba(255, 255, 255, 1)',
//           align: 'left' as const,
//           baseline: 'middle' as const
//       },
//       hover: {
//           font: '14px "Orbitron", sans-serif',
//           color: 'rgba(255, 255, 255, 0.7)',
//           align: 'left' as const,
//           baseline: 'middle' as const
//       }
//   }
// };

// class PreviewNodeCanvasClass {
//   static initializeCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null {
//       const dpr = window.devicePixelRatio || 1;
//       canvas.width = width * dpr;
//       canvas.height = height * dpr;
      
//       const ctx = canvas.getContext('2d');
//       if (!ctx) return null;

//       ctx.scale(dpr, dpr);
//       ctx.imageSmoothingEnabled = true;
//       ctx.imageSmoothingQuality = 'high';
      
//       return ctx;
//   }

//   static clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
//       ctx.clearRect(0, 0, width, height);
//   }

//   static setTextStyle(ctx: CanvasRenderingContext2D, style: PreviewTextConfig): void {
//       ctx.font = style.font;
//       ctx.fillStyle = style.color;
//       ctx.textAlign = style.align;
//       ctx.textBaseline = style.baseline;
//   }

//   static drawNodeBackground(
//       ctx: CanvasRenderingContext2D, 
//       centerX: number, 
//       centerY: number, 
//       radius: number,
//       isHovered: boolean
//   ): void {
//       // Draw main circle background
//       ctx.beginPath();
//       ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
//       ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
//       ctx.fill();

//       // Draw glow effect
//       if (isHovered) {
//           ctx.save();
//           ctx.beginPath();
//           ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
//           ctx.clip();

//           const gradient = ctx.createRadialGradient(
//               centerX, centerY, radius * 0.8,
//               centerX, centerY, radius * 1.1
//           );
//           gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
//           gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
//           ctx.fillStyle = gradient;
//           ctx.fill();
//           ctx.restore();
//       }

//       // Draw main border
//       ctx.beginPath();
//       ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
//       ctx.strokeStyle = isHovered ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)';
//       ctx.lineWidth = 5;
//       ctx.stroke();

//   }

//   static drawWrappedText(
//       ctx: CanvasRenderingContext2D,
//       text: string,
//       x: number,
//       startY: number,
//       maxWidth: number,
//       lineHeight: number,
//       align: CanvasTextAlign = 'left'
//   ): number {
//       const originalAlign = ctx.textAlign;
//       ctx.textAlign = align;

//       const words = text.split(' ');
//       let line = '';
//       let y = startY;

//       for (const word of words) {
//           const testLine = line + (line ? ' ' : '') + word;
//           const metrics = ctx.measureText(testLine);
          
//           if (metrics.width > maxWidth && line !== '') {
//               if (align === 'center') {
//                   ctx.fillText(line, x + (maxWidth / 2), y);
//               } else {
//                   ctx.fillText(line, x, y);
//               }
//               line = word;
//               y += lineHeight;
//           } else {
//               line = testLine;
//           }
//       }
      
//       if (line) {
//           if (align === 'center') {
//               ctx.fillText(line, x + (maxWidth / 2), y);
//           } else {
//               ctx.fillText(line, x, y);
//           }
//           y += lineHeight;
//       }

//       ctx.textAlign = originalAlign;
//       return y;
//   }

//   static drawTruncatedText(
//       ctx: CanvasRenderingContext2D,
//       text: string,
//       x: number,
//       y: number,
//       maxWidth: number,
//       align: CanvasTextAlign = 'left'
//   ): void {
//       const originalAlign = ctx.textAlign;
//       ctx.textAlign = align;

//       const metrics = ctx.measureText(text);
//       if (metrics.width > maxWidth) {
//           let truncated = text;
//           while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
//               truncated = truncated.slice(0, -1);
//           }
//           text = truncated + '...';
//       }

//       if (align === 'center') {
//           ctx.fillText(text, x + (maxWidth / 2), y);
//       } else {
//           ctx.fillText(text, x, y);
//       }

//       ctx.textAlign = originalAlign;
//   }
// }

// export const PreviewNodeCanvas = {
//   initializeCanvas: PreviewNodeCanvasClass.initializeCanvas,
//   clearCanvas: PreviewNodeCanvasClass.clearCanvas,
//   setTextStyle: PreviewNodeCanvasClass.setTextStyle,
//   drawNodeBackground: PreviewNodeCanvasClass.drawNodeBackground,
//   drawWrappedText: PreviewNodeCanvasClass.drawWrappedText,
//   drawTruncatedText: PreviewNodeCanvasClass.drawTruncatedText
// };

// export type PreviewNodeCanvasType = typeof PreviewNodeCanvas;