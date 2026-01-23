/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
