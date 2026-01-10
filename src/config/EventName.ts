
const EventName = {

    /** VSCode 拡張機能にてドキュメントが変更された際に発生するイベント。 MainView に通知するのが目的。 */
    EXTERNAL_DOCUMENT_CHANGED: "externalDocumentChanged",

    /** Canvas 上の矩形描画が更新されたときに発生するイベント。 ErdCanvas が発火する。 */
    CANVAS_RECTANGLES_DRAWN: "canvasRectanglesDrawn"

} as const;

export const VS_CODE_EVENT_SOURCE = "erd-designer";

export default EventName;