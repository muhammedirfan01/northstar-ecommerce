import express from "express";
import mongoose from "mongoose"
import Order from "../models/order.js";
import ShoppingList from "../models/ShoppingList.js"
import Product from "../models/Product.js"
import User from "../models/User.js"
import Coupon from "../models/Coupon.js"
import { randomUUID } from "node:crypto";
import {requireAuth,requireCustomer} from "../middlewares/auth.js"
const router = express.Router();

router.post("/",requireAuth,requireCustomer, async (req, res) => {
  try {
          const shoppingList=await ShoppingList.findOne({userId:req.user._id})
          if(!shoppingList || shoppingList.cart.length===0){
            return res.status(400).json({
                success:false,
                message:"cart is empty"
            })
          }
const productId=shoppingList.cart.map((items)=>items.productId)
const products=await Product.find({_id:{$in:productId}})
 let subtotal=0;
 const orderItems = [];
 const { addressId,couponCode } = req.body;
 
for (const item of shoppingList.cart) {
  const product = products.find(
    p => p._id.toString() === item.productId.toString()
  );

  if (!product || !product.isListed || product.deletedAt || !product.isPublished) {
    return res.status(400).json({
      success: false,
      message: "Product is unavailable"
    });
  }

  if (!Number.isInteger(item.quantity) || item.quantity < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid quantity"
    });
  }

  let availableStock = product.stock;
  let unitprice=product.pricePaise;
  let variant=null;
  if (product.variants.length > 0) {
     variant = product.variants.id(item.variantId);
    if (!variant || !variant.isListed) {
      return res.status(400).json({
        success: false,
        message: "Variant is unavailable"
      });
    }
      unitprice=variant.pricePaise
    availableStock = variant.stock;
    
    
  }
  if (availableStock < item.quantity) {
    return res.status(409).json({
      success: false,
      message: "Insufficient stock"
    });
  }
   let linetotal=unitprice*item.quantity
    orderItems.push({

        productId:product._id,
        variantId:variant?._id??null,
        productName:product.name,
        variantName:variant?.name??"",
        productImage:variant?.images[0]?.url ?? product.images[0]?.url ?? "",
        quantity:item.quantity,
        unitPricePaise:unitprice,
        lineTotalPaise:linetotal
    })
    subtotal=subtotal+linetotal
}
let discount = 0;

if (couponCode) {
  const coupon = await Coupon.findOne({
    code: couponCode.trim().toUpperCase()
  });

  if (!coupon || !coupon.isActive) {
    return res.status(400).json({
      success: false,
      message: "Invalid coupon"
    });
  }

  const now = new Date();

  if (now < coupon.startDate || now >= coupon.expiryDate) {
    return res.status(400).json({
      success: false,
      message: "Coupon expired or not started"
    });
  }

  if (subtotal < coupon.minPurchasePaise) {
    return res.status(400).json({
      success: false,
      message: "Minimum purchase amount not reached"
    });
  }

  if (coupon.usageLimit !== null &&
      coupon.usedCount >= coupon.usageLimit) {
    return res.status(409).json({
      success: false,
      message: "Coupon usage limit reached"
    });
  }

  if (coupon.discountType === "percentage") {
    discount = Math.floor(subtotal * coupon.discountValue / 100);
  } else {
    discount = coupon.discountValue;
  }

  if (coupon.maxDiscountPaise !== null) {
    discount = Math.min(discount, coupon.maxDiscountPaise);
  }

  discount = Math.min(discount, subtotal);
}

if (!mongoose.isValidObjectId(addressId)) {
  return res.status(400).json({
    success: false,
    message: "Invalid address ID"
  });
}
const address=req.user.addresses?.id(addressId)
if(!address){
    return res.status(400).json({
        success:false,
        message:"select a valid delivery address"
    })
    
}
const shippingAddress = {
  name: address.fullName,
  phone: address.phoneNumber,
  addressLine1: address.addressLine1,
  addressLine2: address.addressLine2 || "",
  city: address.city,
  state: address.state,
  pincode: address.postalCode
};
const shippingCharge=subtotal<=50000?5000:0
const tax=0;
const totalAmount=subtotal+shippingCharge+tax-discount
const orderId = `NS-${randomUUID()}`;
 return res.status(200).json({
        success:true,
        message:"checkout validated sucessfully"
    })

  } catch (error) {
  console.error(error);

  return res.status(500).json({
    success: false,
    message: "Something went wrong"
  });
}
});
export default router;