import { useState } from "react";

function TestApp() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1 style={{ color: "blue" }}>SimpleS3 Test - React is Working!</h1>
      <p>If you can see this, React is rendering correctly.</p>
      <button
        onClick={() => setCount(count + 1)}
        style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer" }}
      >
        Count: {count}
      </button>
      <p style={{ marginTop: "20px", color: "green" }}>✓ Vite is running</p>
      <p style={{ color: "green" }}>✓ Tauri window is displaying</p>
      <p style={{ color: "green" }}>✓ React components are mounting</p>
    </div>
  );
}

export default TestApp;
