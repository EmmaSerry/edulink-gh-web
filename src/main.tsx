import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "bootstrap-icons/font/bootstrap-icons.css";
import "@styles/theme.css";
import App from "./App";
import { CloudAuthProvider } from "@contexts/CloudAuthContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <CloudAuthProvider>
        <App />
      </CloudAuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
