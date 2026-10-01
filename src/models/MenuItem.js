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
    approvalStatus: {
      type: String,
      enum: ["approved", "pending", "rejected"],
      default: "approved",
    },
  },
  { timestamps: true }
);

menuItemSchema.index({ cafeId: 1, approvalStatus: 1 });

export default mongoose.model("MenuItem", menuItemSchema);
