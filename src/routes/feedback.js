import { Router } from "express";
import Cafe from "../models/Cafe.js";
import MenuItem from "../models/MenuItem.js";
import Rating from "../models/Rating.js";
import FeedbackReport from "../models/FeedbackReport.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

async function refreshRating(targetType, targetId) {
  const [summary] = await Rating.aggregate([
    { $match: { targetType, targetId } },
    { $group: { _id: null, average: { $avg: "$value" }, count: { $sum: 1 } } },
  ]);
  const rating = summary ? Number(summary.average.toFixed(2)) : 5;
  const ratingCount = summary?.count || 0;
  const Model = targetType === "cafe" ? Cafe : MenuItem;
  await Model.findByIdAndUpdate(targetId, { rating, ratingCount });
  return { rating, ratingCount };
}

router.post("/ratings", requireAuth, requireRole("customer"), async (req, res) => {
  const { targetType, targetId, value } = req.body;
  if (!["cafe", "menuItem"].includes(targetType) || !targetId || !Number.isInteger(value) || value < 1 || value > 5) {
    return res.status(400).json({ error: "targetType, targetId, and an integer rating from 1 to 5 are required" });
  }

  const Model = targetType === "cafe" ? Cafe : MenuItem;
  const target = await Model.findById(targetId);
  if (!target || (targetType === "menuItem" && target.approvalStatus && target.approvalStatus !== "approved")) {
    return res.status(404).json({ error: "Rating target not found" });
  }

  const rating = await Rating.findOneAndUpdate(
    { targetType, targetId, userId: req.user.id },
    { value },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const summary = await refreshRating(targetType, target._id);
  res.json({ rating, ...summary });
});

router.post("/feedback", requireAuth, requireRole("customer"), async (req, res) => {
  const { targetType, targetId = null, category, details } = req.body;
  const categories = ["safety", "quality", "misleading", "order", "delivery", "staff", "other"];
  if (!["cafe", "menuItem", "service"].includes(targetType) || !categories.includes(category)) {
    return res.status(400).json({ error: "Choose a valid feedback target and category" });
  }
  if (typeof details !== "string" || details.trim().length < 10 || details.trim().length > 1000) {
    return res.status(400).json({ error: "Feedback must be between 10 and 1000 characters" });
  }

  let targetName = "Customer service";
  if (targetType === "cafe") {
    const cafe = await Cafe.findById(targetId).select("name");
    if (!cafe) return res.status(404).json({ error: "Café not found" });
    targetName = cafe.name;
  } else if (targetType === "menuItem") {
    const item = await MenuItem.findById(targetId).populate("cafeId", "name");
    if (!item || (item.approvalStatus && item.approvalStatus !== "approved")) return res.status(404).json({ error: "Menu item not found" });
    targetName = `${item.name} (${item.cafeId?.name || "café"})`;
  }

  const existing = await FeedbackReport.findOne({
    targetType,
    targetId,
    reportedBy: req.user.id,
    status: { $in: ["open", "in_review"] },
  });
  if (existing) return res.status(409).json({ error: "You already have an active report for this subject" });

  const priority = category === "safety" ? "urgent" : ["order", "delivery"].includes(category) ? "high" : "normal";
  const report = await FeedbackReport.create({
    targetType,
    targetId,
    targetName,
    reportedBy: req.user.id,
    category,
    details: details.trim(),
    priority,
  });
  res.status(201).json({ report, message: "Thanks. Your feedback is in the review queue." });
});

router.get("/feedback/mine", requireAuth, requireRole("customer"), async (req, res) => {
  const reports = await FeedbackReport.find({ reportedBy: req.user.id }).sort({ createdAt: -1 }).limit(50);
  res.json(reports);
});

export default router;
