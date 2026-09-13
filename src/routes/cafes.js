import { Router } from "express";
import Cafe from "../models/Cafe.js";
import MenuItem from "../models/MenuItem.js";
import User from "../models/User.js";
import MenuReport from "../models/MenuReport.js";
import { requireAuth, requireRole, optionalAuth } from "../middleware/auth.js";
import { approvalForSubmission, validateMenuItem } from "../utils/menuModeration.js";

const router = Router();

// Public: list all active cafés (the marketplace screen).
router.get("/", async (_req, res) => {
  const cafes = await Cafe.find({ active: true }).sort({ name: 1 });
  res.json(cafes);
});

// Public: one café + its menu (the menu screen).
router.get("/:id", optionalAuth, async (req, res) => {
  const cafe = await Cafe.findById(req.params.id);
  if (!cafe) return res.status(404).json({ error: "Café not found" });
  const canSeeUnpublished = req.user && (req.user.role === "admin" || String(cafe.ownerId) === req.user.id);
  const filter = canSeeUnpublished
    ? { cafeId: cafe._id }
    : { cafeId: cafe._id, $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }] };
  const items = await MenuItem.find(filter).sort({ category: 1, name: 1 });
  res.json({ cafe, items });
});

// Partner-only: update your own café's cover photo, tagline, etc.
router.patch("/:id", requireAuth, requireRole("partner", "admin"), async (req, res) => {
  const cafe = await Cafe.findById(req.params.id);
  if (!cafe) return res.status(404).json({ error: "Café not found" });

  const isOwner = req.user.role === "admin" || String(cafe.ownerId) === req.user.id;
  if (!isOwner) return res.status(403).json({ error: "You can only edit your own café" });

  const { tagline, coverPhotoUrl, neighborhood, tags } = req.body;
  if (tagline !== undefined) cafe.tagline = tagline;
  if (coverPhotoUrl !== undefined) cafe.coverPhotoUrl = coverPhotoUrl;
  if (neighborhood !== undefined) cafe.neighborhood = neighborhood;
  if (tags !== undefined) cafe.tags = tags;
  await cafe.save();
  res.json(cafe);
});

// Partner-only: add a new menu item to your own café.
router.post("/:id/menu-items", requireAuth, requireRole("partner", "admin"), async (req, res) => {
  const cafe = await Cafe.findById(req.params.id);
  if (!cafe) return res.status(404).json({ error: "Café not found" });

  const isOwner = req.user.role === "admin" || String(cafe.ownerId) === req.user.id;
  if (!isOwner) return res.status(403).json({ error: "You can only edit your own café's menu" });

  const { name, category, price, desc, photoUrl } = req.body;
  const validation = validateMenuItem({ name, category, price, desc });
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join("; ") });

  const submitter = await User.findById(req.user.id).select("trustTier");
  const decision = approvalForSubmission({
    isAdmin: req.user.role === "admin",
    trustTier: submitter?.trustTier || "new",
    riskFlags: validation.riskFlags,
  });
  const item = await MenuItem.create({
    cafeId: cafe._id,
    name: validation.normalizedName,
    category: validation.normalizedCategory,
    price,
    desc: validation.normalizedDesc,
    photoUrl,
    submittedBy: req.user.id,
    riskFlags: validation.riskFlags,
    ...decision,
    available: decision.approvalStatus === "approved",
  });
  res.status(201).json({ ...item.toObject(), moderationMessage: item.approvalStatus === "approved" ? "Published" : "Submitted for admin approval" });
});

// Partner-only: update a menu item — price, description, photo, or availability.
router.patch("/menu-items/:itemId", requireAuth, requireRole("partner", "admin"), async (req, res) => {
  const item = await MenuItem.findById(req.params.itemId);
  if (!item) return res.status(404).json({ error: "Item not found" });

  const cafe = await Cafe.findById(item.cafeId);
  if (!cafe) return res.status(404).json({ error: "Café not found" });
  const isOwner = req.user.role === "admin" || String(cafe.ownerId) === req.user.id;
  if (!isOwner) return res.status(403).json({ error: "You can only edit your own café's menu" });

  const { name, category, price, desc, photoUrl, available } = req.body;
  const contentChanged = name !== undefined || category !== undefined || price !== undefined || desc !== undefined;
  if (contentChanged) {
    const validation = validateMenuItem({
      name: name ?? item.name,
      category: category ?? item.category,
      price: price ?? item.price,
      desc: desc ?? item.desc,
    });
    if (validation.errors.length) return res.status(400).json({ error: validation.errors.join("; ") });
    const submitter = await User.findById(req.user.id).select("trustTier");
    const decision = approvalForSubmission({
      isAdmin: req.user.role === "admin",
      trustTier: submitter?.trustTier || "new",
      riskFlags: validation.riskFlags,
    });
    item.name = validation.normalizedName;
    item.category = validation.normalizedCategory;
    item.price = price ?? item.price;
    item.desc = validation.normalizedDesc;
    item.riskFlags = validation.riskFlags;
    item.approvalStatus = decision.approvalStatus;
    item.approvalSource = decision.approvalSource;
    if (decision.approvalStatus !== "approved") item.available = false;
  }
  if (photoUrl !== undefined) item.photoUrl = photoUrl;
  if (available !== undefined) item.available = available;
  await item.save();
  res.json(item);
});

router.post("/menu-items/:itemId/reports", requireAuth, requireRole("customer"), async (req, res) => {
  const item = await MenuItem.findById(req.params.itemId);
  if (!item || (item.approvalStatus && item.approvalStatus !== "approved")) return res.status(404).json({ error: "Published item not found" });
  const { reason, details = "" } = req.body;
  if (!["unsafe", "misleading", "quality", "other"].includes(reason)) {
    return res.status(400).json({ error: "Choose a valid report reason" });
  }
  try {
    const report = await MenuReport.create({ menuItemId: item._id, reportedBy: req.user.id, reason, details });
    const openReports = await MenuReport.countDocuments({ menuItemId: item._id, status: "open" });
    if (openReports >= 2) {
      item.approvalStatus = "pending";
      item.approvalSource = "customer-report";
      item.available = false;
      item.riskFlags = [...new Set([...item.riskFlags, "customer-reports"])]
      await item.save();
    }
    res.status(201).json({ report, message: openReports >= 2 ? "Item hidden pending admin review" : "Report sent to the café review queue" });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: "You already reported this item" });
    throw err;
  }
});

export default router;
