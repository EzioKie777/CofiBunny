import mongoose from "mongoose";

const feedbackReportSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ["cafe", "menuItem", "service"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    targetName: { type: String, required: true, trim: true, maxlength: 120 },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, enum: ["safety", "quality", "misleading", "order", "delivery", "staff", "other"], required: true },
    details: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ["open", "in_review", "resolved", "dismissed"], default: "open" },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolutionNote: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

feedbackReportSchema.index({ status: 1, priority: -1, createdAt: -1 });
feedbackReportSchema.index({ targetType: 1, targetId: 1, reportedBy: 1, status: 1 });

export default mongoose.model("FeedbackReport", feedbackReportSchema);