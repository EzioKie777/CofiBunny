import mongoose from "mongoose";

const menuReportSchema = new mongoose.Schema(
  {
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem", required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: ["unsafe", "misleading", "quality", "other"], required: true },
    details: { type: String, default: "", trim: true, maxlength: 500 },
    status: { type: String, enum: ["open", "resolved", "dismissed"], default: "open" },
  },
  { timestamps: true }
);

menuReportSchema.index({ menuItemId: 1, status: 1 });
menuReportSchema.index({ menuItemId: 1, reportedBy: 1 }, { unique: true });

export default mongoose.model("MenuReport", menuReportSchema);