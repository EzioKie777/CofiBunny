import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem", required: true },
    name: { type: String, required: true },
    basePrice: { type: Number, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

// One "stop" per café in a multi-café order. The rider hops through each
// stop in array order, then to the customer's pin.
const stopSchema = new mongoose.Schema(
  {
    cafeId: { type: mongoose.Schema.Types.ObjectId, ref: "Cafe", required: true },
    cafeName: { type: String, required: true },
    items: { type: [orderItemSchema], required: true },
    ready: { type: Boolean, default: false },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    stops: { type: [stopSchema], required: true },
    status: { type: String, enum: ["preparing", "shipping", "delivered", "cancelled"], default: "preparing" },
    pin: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    address: { type: String, default: "" },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { timestamps: true }
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ "stops.cafeId": 1, status: 1 });

export default mongoose.model("Order", orderSchema);
