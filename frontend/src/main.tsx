import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import Home from "./Home";
import ParticipantApp from "./apps/participant/ParticipantApp";
import HostApp from "./apps/host/HostApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/participant" element={<ParticipantApp />} />
        <Route path="/host" element={<HostApp />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);