import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  description: { type: String },
  category: { type: String },
  createdAt: { type: Date, default: Date.now },
});


const product=mongoose.model("Product",productSchema)
export default product;