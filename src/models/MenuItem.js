import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema(
  {
    cafeId: { type: mongoose.Schema.Types.ObjectId, ref: "Cafe", required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    desc: { type: String, default: "" },
    photoUrl: { type: String, default: null },
    available: { type: Boolean, default: true },
    approvalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
    approvalSource: { type: String, enum: ["legacy", "automated", "admin", "customer-report"], default: "legacy" },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    riskFlags: { type: [String], default: [] },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true }
);

menuItemSchema.index({ cafeId: 1 });
menuItemSchema.index({ cafeId: 1, approvalStatus: 1 });

export default mongoose.model("MenuItem", menuItemSchema);
