import { Router } from "express";
import User from "../models/User.js";
import Cafe from "../models/Cafe.js";
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

router.get("/cafes", async (_req, res) => {
  const cafes = await Cafe.find().populate("ownerId", "name email").sort({ name: 1 });
  res.json(cafes);
});

export default router;
