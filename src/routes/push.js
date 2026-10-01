import { Router } from "express";
import PushSubscription from "../models/PushSubscription.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Public — the frontend needs this to call pushManager.subscribe(). A VAPID
// public key is safe to expose; it's the private key that must stay secret.
router.get("/vapid-public-key", (_req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: "Push notifications aren't configured on this server yet." });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Save (or refresh) this device's subscription for the logged-in user.
router.post("/subscribe", requireAuth, async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Invalid subscription object" });
  }
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { userId: req.user.id, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
    { upsert: true }
  );
  res.status(201).json({ ok: true });
});

router.post("/unsubscribe", requireAuth, async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) await PushSubscription.deleteOne({ endpoint, userId: req.user.id });
  res.json({ ok: true });
});

export default router;
