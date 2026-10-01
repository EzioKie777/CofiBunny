import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["customer", "partner", "admin"], default: "customer" },
    // Only set when role === "partner" — which café this person manages.
    cafeId: { type: mongoose.Schema.Types.ObjectId, ref: "Cafe", default: null },
  },
  { timestamps: true }
);

// Never send the password hash back in API responses.
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    return ret;
  },
});

export default mongoose.model("User", userSchema);
