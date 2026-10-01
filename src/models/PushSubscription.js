import mongoose from "mongoose";

// One document per subscribed device/browser. A user can have several
// (phone + laptop, etc.) — we send to all of them.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ userId: 1 });

export default mongoose.model("PushSubscription", pushSubscriptionSchema);
