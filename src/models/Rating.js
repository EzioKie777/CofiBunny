import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ["cafe", "menuItem"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    value: { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: true }
);

ratingSchema.index({ targetType: 1, targetId: 1, userId: 1 }, { unique: true });
ratingSchema.index({ targetType: 1, targetId: 1 });

export default mongoose.model("Rating", ratingSchema);