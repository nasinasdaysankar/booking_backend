import express from "express";
import { Notification } from "../models/index.js";

const router = express.Router();

// Create a Notification + Broadcast to users
router.post("/send", async (req, res) => {
  try {
    const { title, message } = req.body;

    const data = await Notification.create({ title, message });

    req.io.emit("new_notification", data);  // <--- REAL-TIME PUSH 🚀

    res.json({ success: true, message: "Notification sent ✓", data });
  } 
  catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch All Notifications
router.get("/", async (req, res) => {
  const data = await Notification.findAll({ order:[["id","DESC"]] });
  res.json(data);
});

export default router;
