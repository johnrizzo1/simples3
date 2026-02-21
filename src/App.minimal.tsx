import { useState } from "react";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "sans-serif",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    }}>
      <div style={{
        background: "white",
        padding: "40px",
        borderRadius: "10px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        textAlign: "center"
      }}>
        <h1 style={{ color: "#667eea", marginBottom: "20px" }}>
          SimpleS3 - React is Working! ✅
        </h1>
        <p style={{ marginBottom: "20px", color: "#666" }}>
          The application compiled successfully and React is rendering.
        </p>
        <button
          onClick={() => setCount(count + 1)}
          style={{
            padding: "12px 24px",
            fontSize: "16px",
            background: "#667eea",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            marginBottom: "10px"
          }}
        >
          Click count: {count}
        </button>
        <p style={{ marginTop: "20px", fontSize: "14px", color: "#999" }}>
          Next: Testing Tauri commands...
        </p>
      </div>
    </div>
  );
}

export default App;
