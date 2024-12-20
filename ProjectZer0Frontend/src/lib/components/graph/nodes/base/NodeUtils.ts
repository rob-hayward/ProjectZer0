// src/lib/components/graph/nodes/base/SvgNodeUtils.ts
export interface NodeTransform {
    x: number;
    y: number;
    scale: number;
    rotation?: number;
}

export class SvgNodeUtils {
    static createGradientId(prefix: string): string {
        return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
    }

    static createTransformString(transform: NodeTransform): string {
        const { x, y, scale, rotation = 0 } = transform;
        return `translate(${x}, ${y}) scale(${scale}) rotate(${rotation})`;
    }

    static calculateViewBox(width: number, height: number, padding = 0): string {
        return `${-padding} ${-padding} ${width + padding * 2} ${height + padding * 2}`;
    }

    static createFilterString(options: {
        blur?: number;
        brightness?: number;
        opacity?: number;
    }): string {
        const filters: string[] = [];
        if (options.blur) filters.push(`blur(${options.blur}px)`);
        if (options.brightness) filters.push(`brightness(${options.brightness})`);
        if (options.opacity) filters.push(`opacity(${options.opacity})`);
        return filters.join(' ');
    }
}