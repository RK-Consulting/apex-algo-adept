// frontend/src/main.tsx
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Note: No providers are added here because they are strategically 
// nested inside App.tsx to respect Public vs Protected route boundaries.
createRoot(document.getElementById("root")!).render(<App />);
