import mongoose from "mongoose";

const cafeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    tagline: { type: String, default: "" },
    neighborhood: { type: String, default: "" },
    tags: { type: [String], default: [] },
    accent: { type: String, default: "#8B6449" },
    soft: { type: String, default: "#F1E6DA" },
    rating: { type: Number, default: 5 },
    ratingCount: { type: Number, default: 0 },
    coverPhotoUrl: { type: String, default: null },
    // Fixed x/y on the prototype's demo map, used for delivery-route math.
    // Swap this for real lat/lng once you're using a geocoding API.
    mapPosition: {
      x: { type: Number, default: 200 },
      y: { type: Number, default: 150 },
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Cafe", cafeSchema);
