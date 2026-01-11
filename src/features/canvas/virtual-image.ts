import Viewport from "~/features/canvas/Viewport";
import ErdDocument from "~/models/ErdDocument";
import RectangleViewModel from "~/models/RectangleViewModel";

type RectangleArea = {
    tableRectangles: Map<string, RectangleViewModel>,
    memoRectangles: Map<string, RectangleViewModel>
};

export const initVirtualImageContainer = (
    erdDocument: ErdDocument, viewport: Viewport, rectangleArea: RectangleArea, erdCanvas: HTMLElement
) => {
    const logicalBounds = calculateLogicalBounds(rectangleArea);
    const margin = 20;

    // 論理座標で境界を完結（リレーションの境界も論理座標で計算）
    let minLogicalX = logicalBounds.minX;
    let maxLogicalX = logicalBounds.maxX;
    let minLogicalY = logicalBounds.minY;
    let maxLogicalY = logicalBounds.maxY;

    // リレーションの境界を論理座標で取得
    erdDocument.getRelationViewModels().forEach(relationView => {
        // edgeの各点を境界に含める
        relationView.lineViewModel.edges.forEach(edge => {
            minLogicalX = Math.min(minLogicalX, edge.x);
            maxLogicalX = Math.max(maxLogicalX, edge.x);
            minLogicalY = Math.min(minLogicalY, edge.y);
            maxLogicalY = Math.max(maxLogicalY, edge.y);
        });

        // orthogonal line の各点を境界に含める
        relationView.lineViewModel.orthogonalLines.forEach(line => {
            if (line.direction === "horizontal") {
                minLogicalY = Math.min(minLogicalY, line.position);
                maxLogicalY = Math.max(maxLogicalY, line.position);
            } else if (line.direction === "vertical") {
                minLogicalX = Math.min(minLogicalX, line.position);
                maxLogicalX = Math.max(maxLogicalX, line.position);
            }
        });
    });

    // 論理座標での出力範囲を計算
    const outputMinX = minLogicalX - margin;
    const outputMinY = minLogicalY - margin;
    const outputWidth = (maxLogicalX - minLogicalX) + margin * 2;
    const outputHeight = (maxLogicalY - minLogicalY) + margin * 2;

    const virtualCanvas = erdCanvas.cloneNode(true) as HTMLElement;

    // テーブルの位置を論理座標基準で再配置（親要素を変更）
    rectangleArea.tableRectangles.forEach((rect, tableId) => {
        try {
            const element = virtualCanvas.querySelector(`#${CSS.escape(tableId)}`);
            if (element && element.parentElement) {
                const parentBox = element.parentElement as HTMLElement;
                const left = rect.left - outputMinX;
                const top = rect.top - outputMinY;
                parentBox.style.position = "absolute";
                parentBox.style.left = `${left}px`;
                parentBox.style.top = `${top}px`;
                parentBox.style.transform = "none";
            }
        } catch (exc) {
            console.warn(`Failed to reposition table ${tableId}:`, exc);
        }
    });

    // メモの位置を論理座標基準で再配置（親要素を変更）
    rectangleArea.memoRectangles.forEach((rect, memoId) => {
        try {
            const element = virtualCanvas.querySelector(`#${CSS.escape(memoId)}`);
            if (element && element.parentElement) {
                const parentBox = element.parentElement as HTMLElement;
                const left = rect.left - outputMinX;
                const top = rect.top - outputMinY;
                parentBox.style.position = "absolute";
                parentBox.style.left = `${left}px`;
                parentBox.style.top = `${top}px`;
                parentBox.style.transform = "none";
            }
        } catch (exc) {
            console.warn(`Failed to reposition memo ${memoId}:`, exc);
        }
    });

    virtualCanvas.style.transform = "scale(1)";
    virtualCanvas.style.position = "absolute";
    virtualCanvas.style.top = "0";
    virtualCanvas.style.left = "0";
    virtualCanvas.style.width = `${outputWidth}px`;
    virtualCanvas.style.height = `${outputHeight}px`;
    virtualCanvas.style.overflow = "visible";
    virtualCanvas.style.backgroundImage = "none"; // 背景グリッドは出力しない

    // SVGを論理座標系で設定
    Array.from(virtualCanvas.querySelectorAll<SVGElement>('[data-role="erd-relation-svg"]')).forEach(svgElement => {
        // 拡大・縮小がかかった computed width/height は論理座標変換に不要なので、
        // 論理座標ベースの viewport.screen をそのまま基準とする
        const originalWidth = viewport.screen.width;
        const originalHeight = viewport.screen.height;

        if (!svgElement.getAttribute("viewBox")) {
            svgElement.setAttribute("viewBox", `0 0 ${originalWidth} ${originalHeight}`);
        }

        // SVG path をビューポート座標から論理座標に変換（viewBoxが固定された状態で変換）
        convertSvgPathsToLogicalCoordinates(svgElement, viewport, originalWidth, originalHeight);

        // viewBox を論理座標範囲で設定（座標変換後に変更）
        svgElement.setAttribute("viewBox", `${outputMinX} ${outputMinY} ${outputWidth} ${outputHeight}`);

        // styleプロパティも更新（attributeだけでは不十分）
        svgElement.style.position = "absolute";
        svgElement.style.top = "0";
        svgElement.style.left = "0";
        svgElement.style.width = `${outputWidth}px`;
        svgElement.style.height = `${outputHeight}px`;
        svgElement.style.pointerEvents = "none";
    });

    const imageContainer = document.createElement("div");
    imageContainer.style.position = "absolute";
    imageContainer.style.top = `${-1.1 * outputHeight}px`;
    imageContainer.style.left = "0";
    imageContainer.style.width = `${outputWidth}px`;
    imageContainer.style.height = `${outputHeight}px`;
    imageContainer.style.overflow = "visible";
    imageContainer.style.backgroundColor = "white";
    imageContainer.appendChild(virtualCanvas);

    return { imageContainer, outputWidth, outputHeight };
};

const convertSvgPathsToLogicalCoordinates = (
    svgElement: SVGElement, viewport: Viewport, originalWidth: number, originalHeight: number
) => {
    // ビューポート座標 → 論理座標の逆変換
    // viewportX = logicalX - viewport.center.x + viewport.screen.width / 2
    // → logicalX = viewportX + viewport.center.x - viewport.screen.width / 2
    // 
    // 元のSVGのサイズを使用して正しいoffsetを計算
    const offsetX = viewport.center.x - originalWidth / 2;
    const offsetY = viewport.center.y - originalHeight / 2;

    // path 要素の d 属性を変換（defs内を除外）
    svgElement.querySelectorAll("path").forEach(path => {
        // defs内は除外
        if (isInDefs(path)) {
            return
        };

        const dAttribute = path.getAttribute("d");
        if (!dAttribute) {
            return
        };

        try {
            // M x,y や L x,y などの座標を変換（カンマ区切りとスペース区切り両対応）
            // cSpell:ignore MLHVCSQTAZ
            const logicalD = dAttribute.replace(/([MLHVCSQTAZ])[\s,]*([\d.-]+)[\s,]*([\d.-]*)/gi,
                (match, command, x, y) => {
                    command = command.toUpperCase();

                    // H (horizontal line) と V (vertical line) の特殊処理
                    if (command === 'H') {
                        return `${command} ${parseFloat(x) + offsetX}`;
                    }
                    if (command === 'V') {
                        return `${command} ${parseFloat(x) + offsetY}`;
                    }

                    // Z (close path) には座標がない
                    if (command === 'Z') {
                        return command;
                    }

                    // 座標が1つだけの場合（y が空文字列）
                    if (y === '') {
                        return match;
                    }

                    // 通常の x, y 座標変換
                    return `${command} ${parseFloat(x) + offsetX},${parseFloat(y) + offsetY}`;
                }
            );

            path.setAttribute("d", logicalD);
        } catch (exc) {
            console.warn("Failed to convert path coordinates:", exc);
        }
    });

    // circle 要素の cx, cy を変換（defs内を除外）
    svgElement.querySelectorAll("circle").forEach(circle => {
        // defs内は除外
        if (isInDefs(circle)) {
            return
        };

        try {
            const cx = parseFloat(circle.getAttribute("cx") || "0");
            const cy = parseFloat(circle.getAttribute("cy") || "0");

            circle.setAttribute("cx", String(cx + offsetX));
            circle.setAttribute("cy", String(cy + offsetY));
        } catch (exc) {
            console.warn("Failed to convert circle coordinates:", exc);
        }
    });

    // ellipse 要素の cx, cy を変換（defs内を除外）
    svgElement.querySelectorAll("ellipse").forEach(ellipse => {
        // defs内は除外
        if (isInDefs(ellipse)) {
            return
        };

        try {
            const cx = parseFloat(ellipse.getAttribute("cx") || "0");
            const cy = parseFloat(ellipse.getAttribute("cy") || "0");

            ellipse.setAttribute("cx", String(cx + offsetX));
            ellipse.setAttribute("cy", String(cy + offsetY));
        } catch (exc) {
            console.warn("Failed to convert ellipse coordinates:", exc);
        }
    });

    // rect 要素の x, y を変換（defs内を除外）
    svgElement.querySelectorAll("rect").forEach(rect => {
        // defs内は除外
        if (isInDefs(rect)) {
            return
        };

        try {
            const x = parseFloat(rect.getAttribute("x") || "0");
            const y = parseFloat(rect.getAttribute("y") || "0");

            rect.setAttribute("x", String(x + offsetX));
            rect.setAttribute("y", String(y + offsetY));
        } catch (exc) {
            console.warn("Failed to convert rect coordinates:", exc);
        }
    });

    // line 要素の x1, y1, x2, y2 を変換（defs内を除外）
    svgElement.querySelectorAll("line").forEach(line => {
        // defs内は除外
        if (isInDefs(line)) {
            return
        };

        try {
            const x1 = parseFloat(line.getAttribute("x1") || "0");
            const y1 = parseFloat(line.getAttribute("y1") || "0");
            const x2 = parseFloat(line.getAttribute("x2") || "0");
            const y2 = parseFloat(line.getAttribute("y2") || "0");

            line.setAttribute("x1", String(x1 + offsetX));
            line.setAttribute("y1", String(y1 + offsetY));
            line.setAttribute("x2", String(x2 + offsetX));
            line.setAttribute("y2", String(y2 + offsetY));
        } catch (exc) {
            console.warn("Failed to convert line coordinates:", exc);
        }
    });

    // polygon と polyline の points を変換（defs内を除外）
    svgElement.querySelectorAll("polygon, polyline").forEach(poly => {
        // defs内は除外
        if (isInDefs(poly)) {
            return
        };

        try {
            const pointsAttribute = poly.getAttribute("points");
            if (!pointsAttribute) {
                return
            };

            const logicalPoints = pointsAttribute.replace(/([\d.-]+)[,\s]+([\d.-]+)/g,
                (_match, x, y) => `${parseFloat(x) + offsetX},${parseFloat(y) + offsetY}`
            );

            poly.setAttribute("points", logicalPoints);
        } catch (exc) {
            console.warn("Failed to convert polygon/polyline coordinates:", exc);
        }
    });
};

// defs内の要素を判定するヘルパー関数
const isInDefs = (element: Element): boolean => {
    let parent = element.parentElement;
    while (parent) {
        if (parent.tagName.toLowerCase() === 'defs') {
            return true;
        }

        parent = parent.parentElement;
    }

    return false;
};

const calculateLogicalBounds = (rectangleArea: RectangleArea) => {
    if ((rectangleArea.tableRectangles.size + rectangleArea.memoRectangles.size) === 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = Number.MAX_SAFE_INTEGER;
    let minY = Number.MAX_SAFE_INTEGER;
    let maxX = Number.MIN_SAFE_INTEGER;
    let maxY = Number.MIN_SAFE_INTEGER;

    rectangleArea.tableRectangles.forEach(rect => {
        minX = Math.min(minX, rect.left);
        minY = Math.min(minY, rect.top);
        maxX = Math.max(maxX, rect.right);
        maxY = Math.max(maxY, rect.bottom);
    });

    rectangleArea.memoRectangles.forEach(rect => {
        minX = Math.min(minX, rect.left);
        minY = Math.min(minY, rect.top);
        maxX = Math.max(maxX, rect.right);
        maxY = Math.max(maxY, rect.bottom);
    });

    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};
