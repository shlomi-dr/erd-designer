import React from "react";

import { getScroll, Point } from "~/features/canvas/support";

type InnerViewport = {
    center: Point;
    screen: { width: number, height: number };
    scale: number;
};

export default class Viewport {

    private readonly innerViewport: InnerViewport;
    private readonly updateInnerViewport: (updating: InnerViewport) => void;

    constructor(viewport: InnerViewport, updateInnerViewport: (updating: InnerViewport) => void) {
        this.innerViewport = viewport;
        this.updateInnerViewport = updateInnerViewport;
    }

    public get center(): Point {
        return this.innerViewport.center;
    }

    public get screen(): { width: number, height: number } {
        return this.innerViewport.screen;
    }

    public get scale(): number {
        return this.innerViewport.scale;
    }

    /**
     * displayScale の表示拡大率を無視した、論理的な点座標を取得する。
     * なお、論理的な点座標とは、キャンバス中央を (0, 0) とした座標を指す。
     * 
     * @param event マウスイベント
     * @returns 理論的な点座標
     */
    public toLogicalPoint(event: React.MouseEvent | MouseEvent): Point {
        const { scrollX, scrollY } = getScroll();

        const x = this.center.x + (event.clientX + scrollX) / this.scale - this.screen.width / 2;
        const y = this.center.y + (event.clientY + scrollY) / this.scale - this.screen.height / 2;

        return {
            x: Math.floor(x * 100) / 100,
            y: Math.floor(y * 100) / 100
        };
    }

    /**
     * 指定された理論点座標を、Viewport 上の実際の表示点座標に変換する。
     * 
     * @param logicalPoint 理論的な点座標
     * @returns Viewport 上の表示点座標
     */
    public toViewportPoint(logicalPoint: Point): Point {
        return {
            x: logicalPoint.x - this.center.x + this.screen.width / 2,
            y: logicalPoint.y - this.center.y + this.screen.height / 2
        };
    }

    public panViewport(delta: Point): void {
        this.updateInnerViewport({
            ...this.innerViewport,
            center: {
                x: this.center.x + delta.x,
                y: this.center.y + delta.y
            }
        });
    }

    public resizeViewport(width: number, height: number): void {
        const nextWidth = Math.max(800, width) / this.scale;
        const nextHeight = Math.max(500, height) / this.scale;

        if ((this.screen.width === nextWidth) && (this.screen.height === nextHeight)) {
            return;
        }

        const deltaWidth = nextWidth - this.screen.width;
        const deltaHeight = nextHeight - this.screen.height;

        // Keep the same logical point at the visual center when the viewport size changes
        this.updateInnerViewport({
            center: {
                x: this.center.x + deltaWidth / 2,
                y: this.center.y + deltaHeight / 2
            },
            scale: this.scale,
            screen: { width: nextWidth, height: nextHeight }
        });
    }
}

export const useViewport = () => {

    const [innerViewport, setInnerViewport] = React.useState(() => {
        const scale = 1;
        const screen = (typeof window !== "undefined") ? {
            width: Math.max(800, window.innerWidth) / scale,
            height: Math.max(500, window.innerHeight) / scale
        } : { width: 800, height: 500 };

        return { center: { x: 0, y: 0 }, scale, screen };
    });

    const viewport = new Viewport(innerViewport, setInnerViewport);
    const updateViewportScale = (updating: number) => {
        setInnerViewport(current => {
            if (current.scale === updating) {
                return current;
            }

            const nextWidth = Math.max(800, window.innerWidth) / updating;
            const nextHeight = Math.max(500, window.innerHeight) / updating;

            return {
                center: current.center,
                screen: { width: nextWidth, height: nextHeight },
                scale: updating
            };
        });
    };

    return { viewport, updateViewportScale };
};