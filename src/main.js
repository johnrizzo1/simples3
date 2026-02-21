import React from "react";
import ReactDOM from "react-dom/client";

// Test without JSX - use createElement directly
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  React.createElement("div", { style: { padding: "20px", fontFamily: "sans-serif" } },
    React.createElement("h1", { style: { color: "green" } }, "REACT WORKS! 🎉"),
    React.createElement("p", null, "The React module loading issue is now fixed!"),
    React.createElement("p", null, "Vite is properly pre-bundling React and converting CommonJS to ESM.")
  )
);
