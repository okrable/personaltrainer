import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import PlanApp from "./App";
import reportWebVitals from "./reportWebVitals";

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <PlanApp />
  </React.StrictMode>
);

reportWebVitals();
