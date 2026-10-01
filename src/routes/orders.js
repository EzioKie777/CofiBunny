import { Router } from "express";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import MenuItem from "../models/MenuItem.js";
import Cafe from "../models/Cafe.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { computeDelivery } from "../utils/delivery.js";
import { notifyUser, notifyCafePartners } from "../utils/push.js";

const router = Router();

// Customer: place an order. Body: { items: [{ menuItemId, qty }], pin: {x,y}, address }
// Prices and the delivery fee are always computed server-side from the
// database — never trust amounts sent by the client.
router.post("/", requireAuth, requireRole("customer"), async (req, res) => {
  try {
    const { items, pin, address } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items must be a non-empty array" });
    }
    if (!pin || typeof pin.x !== "number" || typeof pin.y !== "number") {
      return res.status(400).json({ error: "pin: { x, y } is required" });
    }

    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } });
    if (menuItems.length !== items.length) {
      return res.status(400).json({ error: "One or more menu items were not found" });
    }
    const unavailable = menuItems.filter((m) => !m.available);
    if (unavailable.length) {
      return res.status(400).json({ error: `Sold out right now: ${unavailable.map((m) => m.name).join(", ")}` });
    }

    // Group into stops, preserving the order cafés first appear in the cart.
    const cafeOrder = [];
    const stopsByCafe = {};
    for (const { menuItemId, qty } of items) {
      const menuItem = menuItems.find((m) => String(m._id) === String(menuItemId));
      const cafeId = String(menuItem.cafeId);
      if (!stopsByCafe[cafeId]) {
        stopsByCafe[cafeId] = [];
        cafeOrder.push(cafeId);
      }
      stopsByCafe[cafeId].push({
        menuItemId: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        qty: Math.max(1, qty | 0),
      });
    }

    const cafes = await Cafe.find({ _id: { $in: cafeOrder } });
    const stops = cafeOrder.map((cafeId) => {
      const cafe = cafes.find((c) => String(c._id) === cafeId);
      return { cafeId, cafeName: cafe.name, items: stopsByCafe[cafeId], ready: false };
    });

    const cafePositions = cafeOrder.map((cafeId) => cafes.find((c) => String(c._id) === cafeId).mapPosition);
    const { fee: deliveryFee } = computeDelivery(cafePositions, pin);

    const subtotal = stops.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.price * i.qty, 0), 0);
    const total = subtotal + deliveryFee;

    const order = await Order.create({
      userId: req.user.id,
      stops,
      pin,
      address: address || "",
      subtotal,
      deliveryFee,
      total,
      status: "preparing",
    });

    res.status(201).json(order);

    // Fire-and-forget: don't make the customer wait on push delivery.
    notifyCafePartners(cafeOrder, {
      title: "New order — Cofi Bunny",
      body: stops.length > 1
        ? `An order needs items from your café (part of a ${stops.length}-café hop).`
        : "You've got a new order to prepare.",
      url: "/",
    }).catch((err) => console.warn("notifyCafePartners failed:", err.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer: my own order history, most recent first.
router.get("/mine", requireAuth, requireRole("customer"), async (req, res) => {
  const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
  res.json(orders);
});

// Partner: orders that include a stop at my café and aren't finished yet.
router.get("/incoming", requireAuth, requireRole("partner"), async (req, res) => {
  if (!req.user.cafeId) return res.status(400).json({ error: "Your account isn't linked to a café yet" });
  const orders = await Order.find({
    "stops.cafeId": new mongoose.Types.ObjectId(req.user.cafeId),
    status: { $in: ["preparing", "shipping"] },
  }).sort({ createdAt: -1 });
  res.json(orders);
});

// Admin: every order that isn't finished yet.
router.get("/active", requireAuth, requireRole("admin"), async (_req, res) => {
  const orders = await Order.find({ status: { $in: ["preparing", "shipping"] } }).sort({ createdAt: -1 });
  res.json(orders);
});

// Partner: mark your café's stop in this order as ready for pickup.
// Once every stop is ready, the whole order flips to "shipping" — this is
// the event you'd broadcast over a WebSocket/Pusher channel in production.
router.patch("/:id/ready", requireAuth, requireRole("partner"), async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const stop = order.stops.find((s) => String(s.cafeId) === String(req.user.cafeId));
  if (!stop) return res.status(403).json({ error: "This order has nothing from your café" });

  stop.ready = true;
  const justStartedShipping = order.stops.every((s) => s.ready) && order.status !== "shipping";
  if (justStartedShipping) order.status = "shipping";
  await order.save();
  res.json(order);

  if (justStartedShipping) {
    notifyUser(order.userId, {
      title: "Your order is on the way — Cofi Bunny",
      body: "Your rider has picked everything up and is heading your way.",
      url: "/",
    }).catch((err) => console.warn("notifyUser failed:", err.message));
  }
});

// Admin: force a status change (used for the "mark delivered" / demo actions).
router.patch("/:id/status", requireAuth, requireRole("admin"), async (req, res) => {
  const { status } = req.body;
  if (!["preparing", "shipping", "delivered", "cancelled"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { $set: { status, ...(status === "shipping" ? { "stops.$[].ready": true } : {}) } },
    { new: true }
  );
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);

  if (status === "shipping" || status === "delivered") {
    notifyUser(order.userId, {
      title: status === "shipping" ? "Your order is on the way — Cofi Bunny" : "Order delivered — Cofi Bunny",
      body: status === "shipping" ? "Your rider is heading your way." : "Enjoy! Let us know how it was.",
      url: "/",
    }).catch((err) => console.warn("notifyUser failed:", err.message));
  }
});

export default router;
