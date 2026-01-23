/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import express from "express";
import { prisma } from "./db.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Members endpoints
app.get("/members", async (_req, res) => {
  try {
    const members = await prisma.member.findMany({
      include: {
        createdBy: true,
        referredBy: true,
        assignedCollector: true
      }
    });
    res.json(members);
  } catch (error) {
    console.error("Error fetching members:", error);
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

app.get("/members/:id", async (req, res) => {
  try {
    const member = await prisma.member.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: true,
        referredBy: true,
        assignedCollector: true,
        loans: true,
        messages: {
          include: { attachments: true }
        }
      }
    });
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    res.json(member);
  } catch (error) {
    console.error("Error fetching member:", error);
    res.status(500).json({ error: "Failed to fetch member" });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
