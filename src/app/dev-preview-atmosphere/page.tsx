"use client";

import { useState } from "react";
import { Atmosphere } from "@/components/dashboard/atmosphere";

/** TEMPORARY no-login preview of the Atmosphere background drift. Delete this route before merging. */
export default function DevPreviewAtmosphere() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  return <div className="dashboard-shell" data-theme={theme}>
    <Atmosphere />
    <div style={{ position: "relative", color: theme === "dark" ? "#e8ecf4" : "#15181f", fontFamily: "sans-serif" }}>
      <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} style={{ padding: "8px 14px", border: "1px solid currentColor", borderRadius: 4, background: "transparent", color: "inherit", cursor: "pointer" }}>
        Switch to {theme === "dark" ? "light" : "dark"} theme
      </button>
      <p style={{ marginTop: 16, opacity: 0.7 }}>Dev-only preview — watch the contour lines drift for ~30-60s.</p>
    </div>
  </div>;
}
