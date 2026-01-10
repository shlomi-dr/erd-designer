import React from "react";
import { Box } from "@mui/material";

import EditModeContext from "~/context/EditModeContext";
import { ErdDocumentsHolder, ErdDocumentsHolderContext } from "~/context/ErdDocumentsHolderContext";
import { DEFAULT_LOCAL_SETTING, LocalSettingContext, reduceLocalSetting } from "~/context/LocalSettingContext";
import {
    SelectAction, reduceSelectAction, SelectEntityContext, EMPTY_SELECT_STATE, RELEASE_ACTION
} from "~/context/SelectEntityContext";
import ControlPanel from "~/features/canvas/ControlPanel";
import DisplayScalePanel from "~/features/canvas/DisplayScalePanel";
import ErdCanvas from "~/features/canvas/ErdCanvas";
import TitlePanel from "~/features/canvas/TitlePanel";
import EditMode, { EditModeType } from "~/models/EditMode";
import ErdDocument from "~/models/ErdDocument";
import { useViewport } from "~/features/canvas/Viewport";
import ViewportContext from "~/context/ViewportContext";

type MainViewProps = {
    erdDocument: ErdDocument,
    onSave: (updating: ErdDocument) => void,
    erdExportable?: boolean
};

type ErdDocumentsHolderOptions = {
    erdDocuments: ErdDocument[],
    cursor: number
};

const MainView = ({ erdDocument, onSave, erdExportable = true }: MainViewProps) => {

    const [holderProps, setHolderProps] = React.useState<ErdDocumentsHolderOptions>({ erdDocuments: [erdDocument], cursor: 0 });
    const [selectState, dispatchSelectAction] = React.useReducer(reduceSelectAction, EMPTY_SELECT_STATE);
    const [editMode, dispatchEditMode] = React.useReducer(initReduceEditMode(dispatchSelectAction), EditModeType.SELECT);
    const [localSetting, dispatchLocalSetting] = React.useReducer(reduceLocalSetting, DEFAULT_LOCAL_SETTING);

    const handleOnSave = React.useCallback((documents: ErdDocument[], cursor: number) => {
        if ((cursor < 0) || (cursor >= documents.length)) {
            console.warn(`Invalid cursor value. documents.length: ${documents.length}, cursor: ${cursor}`);
            return;
        }

        onSave(documents[cursor]);
        setHolderProps({ erdDocuments: documents, cursor });
    }, [onSave]);

    const documentsHolder = React.useMemo(
        () => new ErdDocumentsHolder(holderProps.erdDocuments, holderProps.cursor, handleOnSave),
        [holderProps, handleOnSave]
    );

    const editModeValue = React.useMemo(() => ({ editMode, dispatchEditMode }), [editMode]);
    const selectEntityValue = React.useMemo(() => ({ selectState, dispatchSelectAction }), [selectState]);
    const localSettingValue = React.useMemo(() => ({ localSetting, dispatchLocalSetting }), [localSetting]);

    return (
        <ErdDocumentsHolderContext.Provider value={documentsHolder}>
            <EditModeContext.Provider value={editModeValue}>
                <SelectEntityContext.Provider value={selectEntityValue}>
                    <LocalSettingContext.Provider value={localSettingValue}>
                        <InnerCanvasView />
                        <Box sx={titlePanelStyle}>
                            <TitlePanel />
                        </Box>
                        <Box sx={controlPanelStyle}>
                            <ControlPanel erdExportable={erdExportable} />
                        </Box>
                    </LocalSettingContext.Provider>
                </SelectEntityContext.Provider>
            </EditModeContext.Provider>
        </ErdDocumentsHolderContext.Provider>
    );
};

const titlePanelStyle = {
    position: "fixed",
    top: "30px",
    left: "30px",
};
const controlPanelStyle = {
    position: "fixed",
    top: "50%",
    left: "50px",
    transform: "translateY(-50%)",
};

const InnerCanvasView = () => {
    const [scale, setScale] = React.useState<number>(1);
    const { viewport, updateViewportScale } = useViewport();

    const handleOnUpdateScale = React.useCallback((updatingScale: number) => setScale(current => {
        if (current === updatingScale) {
            return current;
        }
        if (updatingScale <= 0) {
            return current;
        }

        updateViewportScale(updatingScale);
        return updatingScale;
    }), [updateViewportScale]);

    return (<>
        <Box sx={{ position: "relative", width: "100%", height: "100vh" }}>
            <ViewportContext.Provider value={viewport}>
                <ErdCanvas />
            </ViewportContext.Provider>
        </Box>
        <Box sx={scalePanelStyle}>
            <DisplayScalePanel scale={scale} onChangeScale={handleOnUpdateScale} />
        </Box>
    </>);
};

const scalePanelStyle = {
    position: "fixed",
    bottom: "30px",
    right: "30px",
};

const initReduceEditMode = (dispatchSelectAction: (action: SelectAction) => void) => {
    return (_current: EditMode, action: EditMode) => {
        dispatchSelectAction(RELEASE_ACTION);

        return action;
    };
};

export default MainView;
