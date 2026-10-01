import { Router } from "express";
import Cafe from "../models/Cafe.js";
import MenuItem from "../models/MenuItem.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Public: list all active cafés (the marketplace screen).
router.get("/", async (_req, res) => {
  const cafes = await Cafe.find({ active: true }).sort({ name: 1 });
  res.json(cafes);
});

// Public: one café + its menu (the menu screen).
router.get("/:id", async (req, res) => {
  const cafe = await Cafe.findById(req.params.id);
  if (!cafe) return res.status(404).json({ error: "Café not found" });
  const items = await MenuItem.find({ cafeId: cafe._id, approvalStatus: "approved" }).sort({ category: 1, name: 1 });
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
  if (!name || !category || price === undefined) {
    return res.status(400).json({ error: "name, category, and price are required" });
  }

  const item = await MenuItem.create({
    cafeId: cafe._id,
    name,
    category,
    price,
    desc,
    photoUrl,
    approvalStatus: "pending",
  });
  res.status(201).json(item);
});

// Partner-only: update a menu item — price, description, photo, or availability.
router.patch("/menu-items/:itemId", requireAuth, requireRole("partner", "admin"), async (req, res) => {
  const item = await MenuItem.findById(req.params.itemId);
  if (!item) return res.status(404).json({ error: "Item not found" });

  const cafe = await Cafe.findById(item.cafeId);
  const isOwner = req.user.role === "admin" || String(cafe.ownerId) === req.user.id;
  if (!isOwner) return res.status(403).json({ error: "You can only edit your own café's menu" });

  const { name, category, price, desc, photoUrl, available } = req.body;
  if (name !== undefined) item.name = name;
  if (category !== undefined) item.category = category;
  if (price !== undefined) item.price = price;
  if (desc !== undefined) item.desc = desc;
  if (photoUrl !== undefined) item.photoUrl = photoUrl;
  if (available !== undefined) item.available = available;
  await item.save();
  res.json(item);
});

export default router;
