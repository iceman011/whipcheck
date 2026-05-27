import app from "./api/index.js";
import path from "path";
import express from "express";
import { createServer as createViteServer } from "vite";

const PORT = 3000;

async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on http://localhost:${PORT}`);
  });
}

// Start local port listener only if not running in the Vercel serverless environment
if (!process.env.VERCEL) {
  setupServer();
}

export default app;
