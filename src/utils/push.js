import webpush from "web-push";
import PushSubscription from "../models/PushSubscription.js";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set — push notifications are disabled.");
  }
  webpush.setVapidDetails(VAPID_SUBJECT || "mailto:hello@cofibunny.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

// Sends a notification to every device a user has subscribed on. Silently
// removes subscriptions the push service reports as gone (410/404) — this
// is normal and happens whenever someone uninstalls the app or it expires.
export async function notifyUser(userId, { title, body, url }) {
  try {
    ensureConfigured();
  } catch (err) {
    console.warn(err.message);
    return;
  }

  const subs = await PushSubscription.find({ userId });
  if (!subs.length) return;

  const payload = JSON.stringify({ title, body, url: url || "/" });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          payload
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
        } else {
          console.warn("Push failed:", err.statusCode, err.message);
        }
      }
    })
  );
}

// Convenience: notify every partner who owns one of the given cafés.
export async function notifyCafePartners(cafeIds, payload) {
  const User = (await import("../models/User.js")).default;
  const partners = await User.find({ role: "partner", cafeId: { $in: cafeIds } });
  await Promise.all(partners.map((p) => notifyUser(p._id, payload)));
}
