import React from "react";
import ReactDOM from "react-dom";

import App from "./App";
import { ChatProvider } from "./hooks/useChat";
import "./index.css";

const rootElement = document.getElementById("root");

// Check if using React 18 or below
const root = ReactDOM.createRoot ? ReactDOM.createRoot(rootElement) : ReactDOM.unstable_createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ChatProvider>
      <App />
    </ChatProvider>
  </React.StrictMode>
);
