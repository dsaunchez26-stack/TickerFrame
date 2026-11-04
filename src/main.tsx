import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { followSystemTheme } from "./lib/theme";

followSystemTheme();

createRoot(document.getElementById("root")!).render(<App />);
