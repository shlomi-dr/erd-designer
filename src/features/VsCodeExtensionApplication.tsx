import React from "react";
import { CircularProgress } from "@mui/material";

import ErdDocument from "~/models/ErdDocument";
import InitializeDatabaseDialog from "~/features/start_up/InitializeDatabaseDialog";
import ExportSpecificationContext, { ImageContent } from "~/context/ExportSpecificationContext";
import exportExcelFormatSpecification from "~/features/spec/ExcelFormatSpecification";
import download from "~/components/file-downloader";
import MainView from "~/features/MainView";
import RectangleViewModel from "~/models/RectangleViewModel";
import EventName from "~/config/EventName";
import VsCodeMessage from "~/config/VsCodeMessage";

const VsCodeExtensionApplication = (prop: { vscodeApi: VsCodeApi }) => {
    const [documentUri, setDocumentUri] = React.useState<string>("");
    const [loadResult, setLoadResult] = React.useState<"" | "failure">("");
    const [initDocument, setInitDocument] = React.useState<ErdDocument | null>(null);

    const vscodeApi = prop.vscodeApi;

    // 初期化処理
    React.useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleMessageFromVsCode = (event: MessageEvent<any>) => {
            const message = event.data;
            if (!("eventSource" in message) || !("messageType" in message)
                || !("documentUri" in message) || !("jsonContext" in message)) {
                console.error("Invalid message format received.");
                return;
            }

            if (message.eventSource !== VsCodeMessage.EVENT_SOURCE) {
                return;
            }
            const uri = message.documentUri as string;
            if (uri === "") {
                console.error("Received empty document uri during initialization.");
                return;
            }

            // VSCode 拡張機能側より初期化処理が完了し、ファイルの内容を受信したときの制御
            if (message.messageType === VsCodeMessage.INITIALIZE_DOCUMENT) {
                const jsonContext = message.jsonContext as string;
                let erdDocument: ErdDocument | null = null;
                if (jsonContext.length > 0) {
                    try {
                        erdDocument = ErdDocument.toObject(JSON.parse(jsonContext));
                    } catch (error) {
                        console.warn(`Failed to parse erd document. uri: ${uri}\n\tdetail: ${error}`);
                        setLoadResult("failure");
                        return;
                    }
                }

                setInitDocument(erdDocument);
                setDocumentUri(uri);

                console.info(`Initialized erd-designer: ${uri}`);
                return;
            }

            if (documentUri !== uri) {
                console.debug(`Document URI mismatch: ${documentUri} !== ${uri}`);
                return;
            }

            // ドキュメント変更通知の受信
            if (message.messageType === VsCodeMessage.EXTERNALY_CHANGED_DOCUMENT) {
                const jsonContext = message.jsonContext as string;
                const erdDocument = ErdDocument.toObject(JSON.parse(jsonContext));

                // ドキュメントの履歴管理は MainView 配下で行うため、MainView 配下の ErdCanvas に変更を通知する
                const customEvent = new CustomEvent(EventName.EXTERNAL_DOCUMENT_CHANGED, {
                    detail: {
                        erdDocument: erdDocument
                    }
                });
                window.dispatchEvent(customEvent);

                console.debug("Dispatching a changeDocument event from vscode"
                    + ` to ${EventName.EXTERNAL_DOCUMENT_CHANGED} event: ${documentUri}`);

                return;
            }
        };

        window.addEventListener("message", handleMessageFromVsCode);

        return () => {
            window.removeEventListener("message", handleMessageFromVsCode);
        };
    }, [documentUri]);

    // Canvas 上に描画されたテーブルの矩形情報を受信し、VSCode 拡張機能に伝搬する。
    React.useEffect(() => {
        const handleCanvasRectanglesDrawn = (event: Event) => {
            const customEvent = event as CustomEvent;
            const eventDetail = customEvent.detail;
            if (!("tableRectangles" in eventDetail)) {
                return;
            }

            // TODO memoRectangles も送信するようにする
            const tableRectangles = eventDetail.tableRectangles as Map<string, RectangleViewModel>;
            const rectangles = Array.from(tableRectangles.entries())
                .map(([tableId, rectangle]) => ({
                    tableId,
                    rectangle: { ...rectangle }
                }));

            vscodeApi.postMessage({
                eventSource: VsCodeMessage.EVENT_SOURCE,
                messageType: VsCodeMessage.DRAWN_RECTANGLES,
                documentUri: documentUri,
                rectangles: rectangles
            });
        };

        window.addEventListener(EventName.CANVAS_RECTANGLES_DRAWN, handleCanvasRectanglesDrawn);

        return () => {
            window.removeEventListener(EventName.CANVAS_RECTANGLES_DRAWN, handleCanvasRectanglesDrawn);
        };
    }, [documentUri, vscodeApi]);

    // 初期化処理が終わっていない場合は、読み込み中であることを示す
    if (documentUri === "") {
        // VSCode 側に準備完了を通知する。その後、上記の message イベントが発火されるのを待つ。
        vscodeApi.postMessage({
            eventSource: VsCodeMessage.EVENT_SOURCE,
            messageType: VsCodeMessage.READY
        });

        console.debug("Sent ready event to vscode extension.");

        return (<CircularProgress />);
    }

    // 開いた .erd ファイルの形式が不正だった場合
    if (loadResult === "failure") {
        return (<div>Failed to load erd file.</div>);
    }

    // VSCode 上のファイル保存処理
    const handleSaveDocument = (updating: ErdDocument) => {
        // ファイル保存は VSCode 側に処理を委譲する
        vscodeApi.postMessage({
            eventSource: VsCodeMessage.EVENT_SOURCE,
            messageType: VsCodeMessage.SAVE_DOCUMENT,
            documentUri: documentUri,
            erdDocument: updating.toJSON()
        });
    };

    if (initDocument === null) {
        const handleCreated = (erdDocument: ErdDocument) => {
            setInitDocument(erdDocument);
            handleSaveDocument(erdDocument);
        };

        return (
            <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
                <InitializeDatabaseDialog
                    isOpen={initDocument === null}
                    onCreate={handleCreated}
                    onClose={() => { }} />
            </div>
        );
    }

    const exportSpecification = (erdDocument: ErdDocument, contents: ImageContent) => {
        exportExcelFormatSpecification(erdDocument, contents).then((specs: Blob) => {
            const fileName = `${erdDocument.documentName}.xlsx`;
            download(fileName, specs);
        });
    };

    return (
        <ExportSpecificationContext.Provider value={{ exportSpecification }}>
            <MainView erdDocument={initDocument} onSave={handleSaveDocument} erdExportable={false} />
        </ExportSpecificationContext.Provider>
    );
};

export default VsCodeExtensionApplication;