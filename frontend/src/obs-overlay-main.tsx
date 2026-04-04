import { createRoot } from "react-dom/client";

import OBSOverlayApp from "./apps/obs-overlay/OBSOverlayApp";
import "./index.css";

createRoot(document.getElementById("obs-root")!).render(<OBSOverlayApp />);
