import React from "react";

import Viewport from "~/features/canvas/Viewport";

const ViewportContext = React.createContext<Viewport>({} as Viewport);

export default ViewportContext;
