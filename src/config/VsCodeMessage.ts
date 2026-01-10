
const VsCodeMessage = {
    EVENT_SOURCE : "erd-designer",

    /** React アプリケーションの初期処理が完了し、VSCode 側に準備完了を通知するためのメッセージ種別。 */
    READY: "ready",

    /** ドキュメントの内容を WebView に反映するためのメッセージ種別。 */
    INITIALIZE_DOCUMENT: "init",

    /** ドキュメントの保存処理の依頼を VSCode 側に通知するためのメッセージ種別。 */
    SAVE_DOCUMENT: "save",

    /** 外部からのドキュメント更新の内容を WebView に反映するためのメッセージ種別。 */
    EXTERNALY_CHANGED_DOCUMENT: "changeDocument",

    /** Canvas 上の短形描画の更新が完了したことを VSCode 側に通知するためのメッセージ種別。 */
    DRAWN_RECTANGLES: "drawnRectangles"
} as const;

export default VsCodeMessage;