import { Router } from "express";
import User from "../models/User.js";
import Cafe from "../models/Cafe.js";
import MenuItem from "../models/MenuItem.js";
import MenuReport from "../models/MenuReport.js";
import FeedbackReport from "../models/FeedbackReport.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Every route in this file requires an admin-role token.
router.use(requireAuth, requireRole("admin"));

// Paginated + searchable — never loads every user into memory at once.
// GET /api/admin/users?search=ana&page=1&limit=20
router.get("/users", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const search = (req.query.search || "").trim();

  const filter = search
    ? { $or: [{ name: new RegExp(search, "i") }, { email: new RegExp(search, "i") }] }
    : {};

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({ users, total, page, limit, pages: Math.ceil(total / limit) || 1 });
});

// Change someone's role. If promoting to "partner", pass cafeId so they're
// scoped to the right café. Demoting away from "partner" clears cafeId.
router.patch("/users/:id/role", async (req, res) => {
  const { role, cafeId } = req.body;
  if (!["customer", "partner", "admin"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  if (role === "partner" && !cafeId) {
    return res.status(400).json({ error: "cafeId is required when setting role to partner" });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.role = role;
  user.cafeId = role === "partner" ? cafeId : null;
  await user.save();

  if (role === "partner") {
    await Cafe.findByIdAndUpdate(cafeId, { ownerId: user._id });
  }

  res.json(user);
});

router.patch("/users/:id/trust", async (req, res) => {
  const { trustTier } = req.body;
  if (!["new", "trusted", "restricted"].includes(trustTier)) {
    return res.status(400).json({ error: "Invalid trust tier" });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { trustTier }, { new: true });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

router.get("/cafes", async (_req, res) => {
  const cafes = await Cafe.find().populate("ownerId", "name email").sort({ name: 1 });
  res.json(cafes);
});

router.get("/menu-items", async (req, res) => {
  const status = ["pending", "approved", "rejected"].includes(req.query.status) ? req.query.status : "pending";
  const items = await MenuItem.find({ approvalStatus: status })
    .populate("cafeId", "name")
    .populate("submittedBy", "name email trustTier")
    .sort({ updatedAt: -1 });
  const reports = await MenuReport.aggregate([
    { $match: { status: "open" } },
    { $group: { _id: "$menuItemId", count: { $sum: 1 } } },
  ]);
  const reportCounts = Object.fromEntries(reports.map((report) => [String(report._id), report.count]));
  res.json(items.map((item) => ({ ...item.toObject(), openReportCount: reportCounts[String(item._id)] || 0 })));
});

router.patch("/menu-items/:itemId/review", async (req, res) => {
  const { decision, rejectionReason = "" } = req.body;
  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "Decision must be approved or rejected" });
  }
  const item = await MenuItem.findById(req.params.itemId);
  if (!item) return res.status(404).json({ error: "Item not found" });
  item.approvalStatus = decision;
  item.approvalSource = "admin";
  item.rejectionReason = decision === "rejected" ? String(rejectionReason).trim() : "";
  item.available = decision === "approved";
  await item.save();
  await MenuReport.updateMany({ menuItemId: item._id, status: "open" }, { status: decision === "approved" ? "dismissed" : "resolved" });
  res.json(item);
});

router.get("/menu-reports", async (_req, res) => {
  const reports = await MenuReport.find({ status: "open" })
    .populate("menuItemId", "name category price approvalStatus")
    .populate("reportedBy", "name email")
    .sort({ createdAt: -1 });
  res.json(reports);
});

router.get("/feedback", async (req, res) => {
  const status = ["open", "in_review", "resolved", "dismissed"].includes(req.query.status) ? req.query.status : "open";
  const category = ["safety", "quality", "misleading", "order", "delivery", "staff", "other"].includes(req.query.category)
    ? req.query.category
    : null;
  const filter = { status };
  if (category) filter.category = category;
  const [reports, counts] = await Promise.all([
    FeedbackReport.find(filter).populate("reportedBy", "name email").sort({ priority: -1, createdAt: -1 }).limit(100),
    FeedbackReport.aggregate([{ $group: { _id: { status: "$status", category: "$category" }, count: { $sum: 1 } } }]),
  ]);
  res.json({ reports, counts });
});

router.patch("/feedback/:id", async (req, res) => {
  const { status, priority, resolutionNote } = req.body;
  if (status !== undefined && !["open", "in_review", "resolved", "dismissed"].includes(status)) {
    return res.status(400).json({ error: "Invalid feedback status" });
  }
  if (priority !== undefined && !["low", "normal", "high", "urgent"].includes(priority)) {
    return res.status(400).json({ error: "Invalid feedback priority" });
  }
  const report = await FeedbackReport.findByIdAndUpdate(
    req.params.id,
    { ...(status !== undefined ? { status } : {}), ...(priority !== undefined ? { priority } : {}), ...(resolutionNote !== undefined ? { resolutionNote: String(resolutionNote).trim() } : {}), assignedTo: req.user.id },
    { new: true, runValidators: true }
  ).populate("reportedBy", "name email");
  if (!report) return res.status(404).json({ error: "Feedback report not found" });
  res.json(report);
});

export default router;
