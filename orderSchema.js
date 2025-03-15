import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    email: { type: String, required: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true }
      }
    ],
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ["Pending", "Processing", "Completed"], default: "Pending" },
    invoiceUrl: { type: String, },
    createdAt: { type: Date, default: Date.now }
  });
const order = mongoose.model("Order",orderSchema)
export default order