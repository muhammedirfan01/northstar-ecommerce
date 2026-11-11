import { sendMessage } from "../services/supportService.js";
import { backfillRequestReferences } from "../services/requestNumberService.js";
import OrderCounter from "../models/OrderCounter.js";
import { backfillOrderNumbers } from "../services/orderNumberService.js";
import WalletTransaction from "../models/WalletTransaction.js";
import SupportRequest from "../models/SupportRequest.js";
import { postalDirectory } from "../services/postalService.js";
import sharp from "sharp";
import PaymentWebhookReceipt from "../models/PaymentWebhookReceipt.js";
import ReturnPhoto from "../models/ReturnPhoto.js";
import StockAdjustment from "../models/StockAdjustment.js";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID, createHmac } from "node:crypto";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import ShoppingList from "../models/ShoppingList.js";
import Order from "../models/order.js";
import Coupon from "../models/Coupon.js";
import Campaign from "../models/Campaign.js";
import StoreSettings from "../models/StoreSettings.js";
import createApp from "../app.js";
import { createToken } from "../utils/jwt.js";
import { AUTH_COOKIE_NAME } from "../config/jwt.js";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

// Opt-in integration tests only ever touch a fresh, dedicated database.
test(
  "weekly checkout/order/inventory transactions on a real replica set",
  { skip: !process.env.NORTHSTAR_INTEGRATION },
  async (t) => {
    const database = `northstar_codex_test_${randomUUID().replaceAll("-", "")}`;
    assert.match(database, /^northstar_codex_test_[a-f0-9]{32}$/);
    process.env.JWT_SECRET =
      "isolated-integration-fixture-secret-at-least-32-characters";
    process.env.NODE_ENV = "test";
    await mongoose.connect("mongodb://127.0.0.1:27017/?replicaSet=rs0", {
      dbName: database,
      serverSelectionTimeoutMS: 5000,
    });
    let server;
    try {
      await Promise.all([
        OrderCounter.init(),
        WalletTransaction.init(),
        SupportRequest.init(),
        User.init(),
        Product.init(),
        Category.init(),
        ShoppingList.init(),
        Order.init(),
        Coupon.init(),
        Campaign.init(),
        StoreSettings.init(),
      ]);
      server = createApp().listen(0, "127.0.0.1");
      await new Promise((resolve) => server.once("listening", resolve));
      const origin = `http://127.0.0.1:${server.address().port}/api`;
      const oid = () => new mongoose.Types.ObjectId();
      async function seed(stock = 10) {
        for (const model of [
          OrderCounter,
          WalletTransaction,
          SupportRequest,
          User,
          Product,
          Category,
          ShoppingList,
          Order,
          Coupon,
          Campaign,
          StoreSettings,
        ])
          await model.deleteMany({});
        const userId = oid(),
          addressId = oid(),
          productId = oid(),
          categoryId = oid(),
          adminId = oid();
        const address = {
          _id: addressId,
          fullName: "Test Customer",
          phoneNumber: "+919876543210",
          addressLine1: "123 Main Street",
          city: "Kochi",
          state: "Kerala",
          postalCode: "682001",
          country: "IN",
        };
        const user = {
          _id: userId,
          name: "Test Customer",
          email: "customer@example.test",
          role: "customer",
          isEmailVerified: true,
          isBlocked: false,
          authVersion: 0,
          addresses: [address],
          __v: 0,
        };
        await User.collection.insertMany([
          user,
          { ...user, _id: adminId, email: "admin@example.test", role: "admin" },
        ]);
        await Category.collection.insertOne({
          _id: categoryId,
          name: "Test category",
          isListed: true,
          parent: null,
          deletedAt: null,
        });
        await Product.collection.insertOne({
          _id: productId,
          name: "Test product",
          description: "Test",
          pricePaise: 10000,
          stock,
          isListed: true,
          isPublished: true,
          deletedAt: null,
          category: categoryId,
          variants: [],
          images: [],
          __v: 0,
        });
        await ShoppingList.collection.insertOne({
          userId,
          cart: [{ _id: oid(), productId, quantity: 1, variantId: null }],
          wishlist: [],
          __v: 0,
        });
        const customer = await User.findById(userId),
          admin = await User.findById(adminId);
        return {
          userId,
          addressId,
          productId,
          categoryId,
          customer,
          admin,
          body: {
            addressId: String(addressId),
            paymentMethod: "cod",
            requestId: randomUUID(),
            expectedTotalPaise: 15000,
          },
        };
      }
      async function call(user, path, method = "GET", body) {
        const response = await fetch(origin + path, {
          method,
          headers: {
            "Content-Type": "application/json",
            Cookie: `${AUTH_COOKIE_NAME}=${createToken(user)}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        return { status: response.status, body: await response.json() };
      }
      await t.test("delivered replacements allow new numbered requests and preserve earlier request history",async()=>{
        const s=await seed(20),placed=await call(s.customer,"/orders","POST",s.body),id=placed.body.data.order.id;
        await Order.updateOne({_id:id},{$set:{orderStatus:"delivered",paymentStatus:"paid"}});
        const body={resolution:"replacement",reason:"Damaged item"};
        await call(s.customer,`/orders/${id}/return`,"POST",body);
        await call(s.admin,`/admin/orders/${id}/return/review`,"POST",{decision:"accepted"});
        await call(s.admin,`/admin/orders/${id}/return/complete`,"POST",{});
        for(const status of ["shipped","out_for_delivery","delivered"])await call(s.admin,`/admin/orders/${id}/return/replacement`,"POST",{status});
        const repeat={...body,requestCycle:2};
        const responses=await Promise.all([call(s.customer,`/orders/${id}/return`,"POST",repeat),call(s.customer,`/orders/${id}/return`,"POST",repeat)]);
        for(const response of responses)assert.equal(response.status,200,JSON.stringify(response.body));
        let saved=await Order.findById(id);assert.equal(saved.returnRequest.cycle,2);assert.equal(saved.returnRequest.reference,"REP-NS-0001-2");assert.equal(saved.returnHistory.length,1);assert.equal(saved.returnHistory[0].replacementStatus,"delivered");
        for(const [path,body]of [["return/cancel",{}],["return/review",{decision:"accepted"}],["return/complete",{}],["return/replacement",{status:"shipped"}]]){
          const response=await call(path==="return/cancel"?s.customer:s.admin,`/${path==="return/cancel"?"":"admin/"}orders/${id}/${path}`,"POST",body);assert.equal(response.status,409);
        }
        await call(s.admin,`/admin/orders/${id}/return/review`,"POST",{decision:"accepted",requestCycle:2});
        assert.equal((await call(s.admin,`/admin/orders/${id}/return/complete`,"POST",{requestCycle:2})).status,200);
        assert.equal((await Product.findById(s.productId)).stock,17);
        for(const status of ["shipped","out_for_delivery","delivered"])await call(s.admin,`/admin/orders/${id}/return/replacement`,"POST",{status,requestCycle:2});
        const returned=await call(s.customer,`/orders/${id}/return`,"POST",{resolution:"refund",reason:"Still damaged",requestCycle:3});assert.equal(returned.status,200);
        await call(s.admin,`/admin/orders/${id}/return/review`,"POST",{decision:"accepted",requestCycle:3});
        await call(s.admin,`/admin/orders/${id}/return/complete`,"POST",{requestCycle:3});
        assert.equal((await Product.findById(s.productId)).stock,18);
        const refunded=await call(s.admin,`/admin/orders/${id}/refund`,"POST",{destination:"wallet"});assert.equal(refunded.status,200);
        assert.equal(await WalletTransaction.countDocuments({operation:"refund"}),1);assert.equal((await User.findById(s.userId).select("+walletBalancePaise")).walletBalancePaise,15000);
        const publicResult=await call(s.customer,`/orders/${id}`);assert.equal(publicResult.body.data.order.returnHistory.length,2);assert.equal(publicResult.body.data.order.returnHistory[0].requestFingerprint,undefined);
      });
      await t.test("ready-to-ship replacement cancellation releases stock and refunds exactly once",async()=>{
        const s=await seed(20),placed=await call(s.customer,"/orders","POST",s.body),id=placed.body.data.order.id;
        await Order.updateOne({_id:id},{$set:{orderStatus:"delivered",paymentStatus:"paid","returnRequest.resolution":"replacement","returnRequest.status":"accepted"}});
        await call(s.admin,`/admin/orders/${id}/return/complete`,"POST",{});assert.equal((await Product.findById(s.productId)).stock,18);
        const results=await Promise.all([call(s.customer,`/orders/${id}/return/cancel`,"POST",{}),call(s.customer,`/orders/${id}/return/cancel`,"POST",{})]);for(const result of results)assert.equal(result.status,200,JSON.stringify(result.body));
        const saved=await Order.findById(id);assert.equal(saved.returnRequest.status,"cancelled");assert.equal(saved.returnRequest.replacementStatus,"cancelled");assert.ok(saved.returnRequest.replacementReleasedAt);assert.equal(saved.refund.method,"wallet");assert.equal(saved.paymentStatus,"refunded");assert.equal((await Product.findById(s.productId)).stock,19);assert.equal(await WalletTransaction.countDocuments({operation:"refund"}),1);assert.equal((await User.findById(s.userId).select("+walletBalancePaise")).walletBalancePaise,15000);
        assert.equal((await call(s.admin,`/admin/orders/${id}/return/replacement`,"POST",{status:"shipped"})).status,409);
      });
      await t.test("replacement dispatch racing with customer cancellation has one stock and money outcome",async()=>{
        const s=await seed(20),placed=await call(s.customer,"/orders","POST",s.body),id=placed.body.data.order.id;
        await Order.updateOne({_id:id},{$set:{orderStatus:"delivered",paymentStatus:"paid","returnRequest.resolution":"replacement","returnRequest.status":"accepted"}});await call(s.admin,`/admin/orders/${id}/return/complete`,"POST",{});
        const results=await Promise.all([call(s.customer,`/orders/${id}/return/cancel`,"POST",{}),call(s.admin,`/admin/orders/${id}/return/replacement`,"POST",{status:"shipped"})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const saved=await Order.findById(id),cancelled=saved.returnRequest.status==="cancelled";assert.equal((await Product.findById(s.productId)).stock,cancelled?19:18);assert.equal(await WalletTransaction.countDocuments({operation:"refund"}),cancelled?1:0);
      });
      await t.test("a failed cancellation wallet credit rolls reserved replacement stock release back",async()=>{
        const s=await seed(20),placed=await call(s.customer,"/orders","POST",s.body),id=placed.body.data.order.id;
        await Order.updateOne({_id:id},{$set:{orderStatus:"delivered",paymentStatus:"paid","returnRequest.resolution":"replacement","returnRequest.status":"accepted"}});await call(s.admin,`/admin/orders/${id}/return/complete`,"POST",{});await User.updateOne({_id:s.userId},{$set:{walletBalancePaise:Number.MAX_SAFE_INTEGER}});
        assert.equal((await call(s.customer,`/orders/${id}/return/cancel`,"POST",{})).status,409);assert.equal((await Product.findById(s.productId)).stock,18);assert.equal((await Order.findById(id)).returnRequest.replacementStatus,"ready_to_ship");assert.equal(await WalletTransaction.countDocuments(),0);
      });
      await t.test("replacement requests are distinct, reserve stock once and deliver without refund or payment", async () => {
        const s = await seed(20), placed = await call(s.customer, "/orders", "POST", s.body), id = placed.body.data.order.id;
        await Order.updateOne({ _id: id }, { $set: { orderStatus: "delivered", paymentStatus: "paid" } });
        const body = { resolution: "replacement", reason: "Damaged item" };
        for (let i = 0; i < 2; i++) assert.equal((await call(s.customer, `/orders/${id}/return`, "POST", body)).status, 200);
        assert.equal((await Order.findById(id)).returnRequest.reference, "REP-NS-0001");
        assert.equal((await call(s.customer, `/orders/${id}/return`, "POST", { reason: "Damaged item" })).status, 409);
        assert.equal((await call(s.admin, `/admin/orders/${id}/return/complete`, "POST", {})).status, 409);
        await call(s.admin, `/admin/orders/${id}/return/review`, "POST", { decision: "accepted" });
        const received = await Promise.all([call(s.admin, `/admin/orders/${id}/return/complete`, "POST", {}),call(s.admin, `/admin/orders/${id}/return/complete`, "POST", {})]);
        for (const result of received) assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal((await Product.findById(s.productId)).stock, 18);
        assert.equal((await call(s.admin, `/admin/orders/${id}/return/replacement`, "POST", { status: "delivered" })).status, 409);
        assert.equal((await call(s.customer, `/admin/orders/${id}/return/replacement`, "POST", { status: "shipped" })).status, 403);
        for (const status of ["shipped", "out_for_delivery", "delivered"]) for (let i=0;i<2;i++) assert.equal((await call(s.admin, `/admin/orders/${id}/return/replacement`, "POST", { status })).status, 200);
        const saved = await Order.findById(id);
        assert.equal(saved.returnRequest.replacementStatus, "delivered");
        assert.equal(saved.paymentStatus, "paid");assert.equal(saved.totalAmount, 15000);assert.equal(saved.refund.status, "none");
        assert.equal(saved.inventoryRestoredAt, null);assert.equal(await WalletTransaction.countDocuments(), 0);assert.equal(await Order.countDocuments(), 1);
        assert.equal(saved.statusHistory.filter(e=>e.status === "replacement_shipped").length, 1);
        assert.equal((await call(s.customer, `/orders/${id}/return/cancel`, "POST", {})).status, 409);
        assert.equal((await call(s.admin, `/admin/orders/${id}/refund`, "POST", { destination: "wallet" })).status, 409);
      });
      await t.test("replacement receipt rolls back all product reservations when another item lacks stock", async () => {
        const s = await seed(20), placed = await call(s.customer, "/orders", "POST", s.body), id = placed.body.data.order.id;
        const second = oid(), product = await Product.findById(s.productId).lean();await Product.collection.insertOne({ ...product, _id: second, stock: 0 });
        const record = await Order.findById(id);const items = [...record.items.map(i=>i.toObject()),{ ...record.items[0].toObject(), productId: second }];
        await Order.updateOne({ _id: id }, { $set: { items, orderStatus: "delivered", paymentStatus: "paid", "returnRequest.resolution": "replacement", "returnRequest.status": "accepted" } });
        const response = await call(s.admin, `/admin/orders/${id}/return/complete`, "POST", {});assert.equal(response.status, 409);
        assert.equal((await Product.findById(s.productId)).stock, 19);assert.equal((await Order.findById(id)).returnRequest.status, "accepted");
        assert.equal((await Order.findById(id)).returnRequest.replacementReservedAt, undefined);
        await Product.updateOne({ _id: second }, { $set: { stock: 2 } });
        assert.equal((await call(s.admin, `/admin/orders/${id}/return/complete`, "POST", {})).status, 200);
        assert.equal((await Product.findById(s.productId)).stock, 18);assert.equal((await Product.findById(second)).stock, 1);
      });
      await t.test("replacement cancellation and rejection do not touch stock or money", async () => {
        for (const action of ["cancel", "reject"]) {
          const s = await seed(20), placed = await call(s.customer, "/orders", "POST", s.body), id = placed.body.data.order.id;
          await Order.updateOne({ _id: id }, { $set: { orderStatus: "delivered", paymentStatus: "paid" } });
          await call(s.customer, `/orders/${id}/return`, "POST", { resolution: "replacement", reason: "Damaged item" });
          if(action === "cancel") { await call(s.admin, `/admin/orders/${id}/return/review`, "POST", { decision: "accepted" }); assert.equal((await call(s.customer, `/orders/${id}/return/cancel`, "POST", {})).status, 200); }
          else assert.equal((await call(s.admin, `/admin/orders/${id}/return/review`, "POST", { decision: "rejected" })).status, 200);
          assert.equal((await call(s.admin, `/admin/orders/${id}/return/complete`, "POST", {})).status, 409);
          assert.equal((await Product.findById(s.productId)).stock, 19);assert.equal(await WalletTransaction.countDocuments(), 0);
        }
      });
      await t.test("replacement option stock is reserved atomically for the original variant", async () => {
        const s = await seed(20), placed = await call(s.customer, "/orders", "POST", s.body), id = placed.body.data.order.id, variantId=oid();
        await Product.collection.updateOne({ _id:s.productId }, { $set:{ stock:3, variants:[{_id:variantId,name:"Original option",pricePaise:10000,stock:3,isListed:true,images:[]}] } });
        await Order.updateOne({_id:id},{$set:{orderStatus:"delivered",paymentStatus:"paid","items.0.variantId":variantId,"returnRequest.resolution":"replacement","returnRequest.status":"accepted"}});
        assert.equal((await call(s.admin, `/admin/orders/${id}/return/complete`, "POST", {})).status,200);
        const product=await Product.findById(s.productId);assert.equal(product.stock,2);assert.equal(product.variants.id(variantId).stock,2);
      });
      await t.test("replacement validation rejects unavailable requests and invalid delivery states",async()=>{
        const s=await seed(20),placed=await call(s.customer,"/orders","POST",s.body),id=placed.body.data.order.id;
        assert.equal((await call(s.customer,`/orders/${id}/return`,"POST",{resolution:"replacement",reason:"Damaged item"})).status,409);
        await Order.updateOne({_id:id},{$set:{orderStatus:"delivered"}});
        assert.equal((await call(s.customer,`/orders/${id}/return`,"POST",{resolution:"replacement",reason:"Damaged item"})).status,409);
        assert.equal((await call(s.customer,`/orders/${id}/return`,"POST",{resolution:"anything",reason:"Damaged item"})).status,400);
        assert.equal((await call(s.admin,`/admin/orders/${id}/return/replacement`,"POST",{status:"anything"})).status,400);
        assert.equal((await call(s.admin,`/admin/orders/${id}/return/replacement`,"POST",{status:"shipped"})).status,409);
      });
      await t.test("manual return refunds credit COD and online customers once in a wallet transaction", async () => {
        for (const paymentMethod of ["cod", "razorpay"]) {
          const s = await seed(20), placed = await call(s.customer, "/orders", "POST", s.body), id = placed.body.data.order.id;
          await Order.updateOne({ _id: id }, { $set: { paymentMethod, paymentStatus: "paid", orderStatus: "delivered", "returnRequest.status": "accepted" } });
          assert.equal((await call(s.admin, `/admin/orders/${id}/return/complete`, "POST", {})).status, 200);
          assert.equal((await Order.findById(id)).refund.method, "wallet");
          assert.equal(await WalletTransaction.countDocuments(), 0);
          const responses = await Promise.all([call(s.admin, `/admin/orders/${id}/refund`, "POST", { destination: "wallet" }),call(s.admin, `/admin/orders/${id}/refund`, "POST", { destination: "wallet" })]);
          for (const response of responses) assert.equal(response.status, 200, JSON.stringify(response.body));
          const saved = await Order.findById(id);
          assert.equal(saved.paymentStatus, "refunded");assert.equal(saved.refund.status, "completed");assert.equal(saved.refund.method, "wallet");
          assert.equal(saved.paymentHistory.filter(e => e.status === "refunded").length, 1);
          assert.equal((await User.findById(s.userId).select("+walletBalancePaise")).walletBalancePaise, 15000);
          assert.equal(await WalletTransaction.countDocuments({ operation: "refund" }), 1);
          assert.equal((await call(s.customer, "/wallet")).body.data.balancePaise, 15000);
          assert.equal((await Product.findById(s.productId)).stock, 20);
        }
      });
      await t.test("manual wallet refunds reject customer access and protect externally refunded money", async () => {
        const s = await seed(20), placed = await call(s.customer, "/orders", "POST", s.body), id = placed.body.data.order.id;
        const url = `/admin/orders/${id}/refund`;
        assert.equal((await call(s.customer, url, "POST", { destination: "wallet" })).status, 403);
        for (const refund of [{ method: "cash", status: "completed", reference: "cash-paid" },{ method: "razorpay", status: "processing", reference: "rfnd_existing" },{ method: "razorpay", status: "completed", reference: "rfnd_done" }]) {
          await Order.updateOne({ _id: id }, { $set: { paymentStatus: "paid", orderStatus: "delivered", "returnRequest.status": "completed", refund: { ...refund, amount: 15000 } } });
          assert.equal((await call(s.admin, url, "POST", { destination: "wallet" })).status, 409);
        }
        assert.equal(await WalletTransaction.countDocuments(), 0);
        await Order.updateOne({ _id: id }, { $set: { refund: { method: "cash", status: "pending", amount: 15000 } } });
        assert.equal((await call(s.admin, url, "POST", { destination: "wallet" })).status, 200);
        assert.equal((await User.findById(s.userId).select("+walletBalancePaise")).walletBalancePaise, 15000);
      });
      await t.test("manual wallet refund failure cannot mark an uncredited refund completed", async () => {
        const s = await seed(20), placed = await call(s.customer, "/orders", "POST", s.body), id = placed.body.data.order.id;
        await User.updateOne({ _id: s.userId }, { $set: { walletBalancePaise: Number.MAX_SAFE_INTEGER } });
        await Order.updateOne({ _id: id }, { $set: { paymentStatus: "paid", orderStatus: "delivered", "returnRequest.status": "completed", refund: { method: "wallet", status: "pending", amount: 15000 } } });
        assert.equal((await call(s.admin, `/admin/orders/${id}/refund`, "POST", { destination: "wallet" })).status, 409);
        assert.equal((await Order.findById(id)).refund.status, "pending");
        assert.equal((await Order.findById(id)).paymentStatus, "paid");
        assert.equal(await WalletTransaction.countDocuments(), 0);
      });
      await t.test("paid online cancellation credits the wallet once and completes refund atomically", async () => {
        for (const balance of [undefined, 20000]) {
          const s = await seed(20);
          if (balance !== undefined) await User.updateOne({ _id: s.userId }, { $set: { walletBalancePaise: balance } });
          const placed = await call(s.customer, "/orders", "POST", s.body), id = placed.body.data.order.id;
          await Order.updateOne({ _id: id }, { $set: { paymentMethod: "razorpay", paymentStatus: "paid", razorpayOrderId: "order_walletcancel", razorpayPaymentId: "pay_walletcancel" } });
          const responses = await Promise.all([call(s.customer, `/orders/${id}/cancel`, "POST", {}), call(s.customer, `/orders/${id}/cancel`, "POST", {})]);
          for (const response of responses) {
            assert.equal(response.status, 200, JSON.stringify(response.body));
            const order = response.body.data.order;
            assert.equal(order.orderStatus, "cancelled");
            assert.equal(order.paymentMethod, "razorpay");
            assert.equal(order.paymentStatus, "refunded");
            assert.equal(order.refund.method, "wallet");
            assert.equal(order.refund.status, "completed");
            assert.equal(order.refund.amount, 15000);
          }
          assert.equal((await User.findById(s.userId).select("+walletBalancePaise")).walletBalancePaise, (balance || 0) + 15000);
          assert.equal((await Product.findById(s.productId)).stock, 20);
          assert.equal(await WalletTransaction.countDocuments({ orderId: id, operation: "refund" }), 1);
          const ledger = await WalletTransaction.findOne({ orderId: id });
          assert.equal(ledger.type, "credit");assert.equal(ledger.amountPaise, 15000);
          const wallet = await call(s.customer, "/wallet");
          assert.equal(wallet.body.data.balancePaise, (balance || 0) + 15000);
          assert.equal(wallet.body.data.transactions[0].orderId, id);
          // Completed wallet refunds must never invoke the gateway refund path.
          assert.equal((await call(s.admin, `/admin/orders/${id}/refund`, "POST", {})).status, 200);
          const saved = await Order.findById(id);
          assert.equal(saved.paymentHistory.filter(e => e.status === "refunded").length, 1);
          assert.equal(saved.statusHistory.filter(e => e.status === "cancelled").length, 1);
        }
      });
      await t.test("unpaid online cancellations never create wallet credit", async () => {
        for (const paymentStatus of ["pending", "failed"]) {
          const s = await seed(20), placed = await call(s.customer, "/orders", "POST", s.body), id = placed.body.data.order.id;
          await Order.updateOne({ _id: id }, { $set: { paymentMethod: "razorpay", paymentStatus, orderStatus: "pending" } });
          assert.equal((await call(s.customer, `/orders/${id}/cancel`, "POST", {})).status, 200);
          assert.equal(await WalletTransaction.countDocuments(), 0);
          assert.equal((await User.findById(s.userId).select("+walletBalancePaise")).walletBalancePaise, 0);
          assert.equal((await Order.findById(id)).refund.status, "none");
        }
      });
      await t.test("wallet credit failure rolls cancellation and stock restoration back", async () => {
        const s = await seed(20), placed = await call(s.customer, "/orders", "POST", s.body), id = placed.body.data.order.id;
        const balance = Number.MAX_SAFE_INTEGER - 14999;
        await User.updateOne({ _id: s.userId }, { $set: { walletBalancePaise: balance } });
        await Order.updateOne({ _id: id }, { $set: { paymentMethod: "razorpay", paymentStatus: "paid" } });
        assert.equal((await call(s.customer, `/orders/${id}/cancel`, "POST", {})).status, 409);
        assert.equal((await Product.findById(s.productId)).stock, 19);
        assert.equal((await Order.findById(id)).orderStatus, "confirmed");
        assert.equal((await Order.findById(id)).paymentStatus, "paid");
        assert.equal((await User.findById(s.userId).select("+walletBalancePaise")).walletBalancePaise, balance);
        assert.equal(await WalletTransaction.countDocuments(), 0);
      });
      await t.test("in-flight gateway refunds and shipped orders cannot receive cancellation wallet credit", async () => {
        const s = await seed(20), placed = await call(s.customer, "/orders", "POST", s.body), id = placed.body.data.order.id;
        await Order.updateOne({ _id: id }, { $set: { paymentMethod: "razorpay", paymentStatus: "paid", refund: { method: "razorpay", status: "processing", amount: 15000 } } });
        assert.equal((await call(s.customer, `/orders/${id}/cancel`, "POST", {})).status, 409);
        await Order.updateOne({ _id: id }, { $set: { orderStatus: "shipped", "refund.status": "none" } });
        assert.equal((await call(s.customer, `/orders/${id}/cancel`, "POST", {})).status, 409);
        assert.equal(await WalletTransaction.countDocuments(), 0);
        assert.equal((await Product.findById(s.productId)).stock, 19);
      });
      await t.test("customer can cancel pending or accepted returns exactly once without changing stock or money", async () => {
        for (const state of ["requested", "accepted"]) {
          const s = await seed(20);
          const placed = await call(s.customer, "/orders", "POST", s.body);
          const id = placed.body.data.order.id;
          await Order.updateOne({ _id: id }, { $set: { orderStatus: "delivered", paymentStatus: "paid", "returnRequest.status": state, "returnRequest.reason": "Changed mind" } });
          const before = await Order.findById(id).lean();
          const [first, second] = await Promise.all([call(s.customer, `/orders/${id}/return/cancel`, "POST", {}), call(s.customer, `/orders/${id}/return/cancel`, "POST", {})]);
          assert.equal(first.status, 200, JSON.stringify(first.body));
          assert.equal(second.status, 200, JSON.stringify(second.body));
          assert.equal(first.body.data.order.returnRequest.status, "cancelled");
          assert.ok(first.body.data.order.returnRequest.cancelledAt);
          const after = await Order.findById(id).lean();
          assert.equal(after.orderStatus, "delivered");
          assert.equal(after.paymentStatus, before.paymentStatus);
          assert.deepEqual(after.refund, before.refund);
          assert.deepEqual(after.paymentHistory, before.paymentHistory);
          assert.equal(after.statusHistory.filter(e => e.status === "return_cancelled").length, 1);
          assert.equal((await Product.findById(s.productId)).stock, 19);
          assert.equal(await WalletTransaction.countDocuments(), 0);
          assert.equal((await call(s.admin, `/admin/orders/${id}/return/review`, "POST", { decision: "accepted" })).status, 409);
          assert.equal((await call(s.admin, `/admin/orders/${id}/return/complete`, "POST", {})).status, 409);
          const filtered = await call(s.admin, "/admin/orders?returnStatus=cancelled");
          assert.equal(filtered.status, 200);
          assert.equal(filtered.body.data.orders.length, 1);
          assert.equal(filtered.body.data.returnSummary.cancelled, 1);
        }
      });
      await t.test("return cancellation enforces customer ownership, role and terminal states", async () => {
        const s = await seed(20), placed = await call(s.customer, "/orders", "POST", s.body), id = placed.body.data.order.id;
        const url = `/orders/${id}/return/cancel`;
        await Order.updateOne({ _id: id }, { $set: { orderStatus: "delivered", "returnRequest.status": "requested" } });
        assert.equal((await fetch(origin + url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
        assert.equal((await call(s.admin, url, "POST", {})).status, 403);
        const other = { ...s.customer.toObject(), _id: oid(), email: "other@example.test" };
        await User.collection.insertOne(other);
        assert.equal((await call(await User.findById(other._id), url, "POST", {})).status, 404);
        assert.equal((await call(s.customer, url, "POST", { status: "cancelled" })).status, 400);
        for (const state of ["none", "rejected", "completed"]) {
          await Order.updateOne({ _id: id }, { $set: { "returnRequest.status": state } });
          assert.equal((await call(s.customer, url, "POST", {})).status, 409);
        }
      });
      await t.test("return receipt racing with cancellation has one stock/refund outcome", async () => {
        const s = await seed(20), placed = await call(s.customer, "/orders", "POST", s.body), id = placed.body.data.order.id;
        await Order.updateOne({ _id: id }, { $set: { orderStatus: "delivered", paymentStatus: "paid", "returnRequest.status": "accepted" } });
        const outcomes = await Promise.all([call(s.customer, `/orders/${id}/return/cancel`, "POST", {}), call(s.admin, `/admin/orders/${id}/return/complete`, "POST", {})]);
        assert.deepEqual(outcomes.map(r => r.status).sort(), [200, 409]);
        const order = await Order.findById(id);
        const completed = order.returnRequest.status === "completed";
        assert.ok(completed || order.returnRequest.status === "cancelled");
        assert.equal((await Product.findById(s.productId)).stock, completed ? 20 : 19);
        assert.equal(order.refund.status, completed ? "pending" : "none");
        assert.equal(order.statusHistory.filter(e => ["return_completed", "return_cancelled"].includes(e.status)).length, 1);
      });
      await t.test("cart additions count existing units and distinguish stock from the nine-unit cap", async () => {
        const s = await seed(20);
        const add = quantity => call(s.customer, "/cart", "POST", { productId: String(s.productId), quantity });
        assert.equal((await add(8)).status, 200);
        assert.equal((await ShoppingList.findOne({ userId: s.userId })).cart[0].quantity, 9);
        const capped = await add(1);
        assert.equal(capped.status, 409);
        assert.match(capped.body.message, /Maximum 9 units/);
        await ShoppingList.updateOne({ userId: s.userId }, { $set: { cart: [] } });
        await Product.updateOne({ _id: s.productId }, { $set: { stock: 5 } });
        assert.equal((await add(5)).status, 200);
        const low = await add(1);
        assert.equal(low.status, 409);
        assert.equal(low.body.message, "Only 5 units are available for this option.");
      });
      await t.test("Buy now uses the selected variant price and stock, not the cart option", async () => {
        const s = await seed(20), variantId = new mongoose.Types.ObjectId();
        await Product.collection.updateOne({ _id: s.productId }, { $set: { variants: [{ _id: variantId, name: "Selected option", pricePaise: 20000, stock: 12, isListed: true, images: [] }] } });
        const before = await ShoppingList.findOne({ userId: s.userId }).lean();
        const buyNow = { productId: String(s.productId), variantId: String(variantId), quantity: 3 };
        const preview = await call(s.customer, "/orders/preview", "POST", { addressId: String(s.addressId), buyNow });
        assert.equal(preview.status, 200, JSON.stringify(preview.body));
        assert.equal(preview.body.data.items[0].unitPricePaise, 20000);
        const placed = await call(s.customer, "/orders", "POST", { ...s.body, buyNow, expectedTotalPaise: preview.body.data.totalAmount });
        assert.equal(placed.status, 201, JSON.stringify(placed.body));
        assert.equal(placed.body.data.order.items[0].variantId, String(variantId));
        assert.equal((await Product.findById(s.productId)).variants.id(variantId).stock, 9);
        assert.deepEqual(await ShoppingList.findOne({ userId: s.userId }).lean(), before);
      });
      await t.test("Buy now previews and places only its selection, preserves the cart and replays safely", async () => {
        const s = await seed(20);
        const selected = new mongoose.Types.ObjectId();
        const template = await Product.findById(s.productId).lean();
        await Product.collection.insertOne({ ...template, _id: selected, name: "Direct selection" });
        const before = await ShoppingList.findOne({ userId: s.userId }).lean();
        const buyNow = { productId: String(selected), variantId: null, quantity: 9 };
        const preview = await call(s.customer, "/orders/preview", "POST", { addressId: String(s.addressId), buyNow });
        assert.equal(preview.status, 200, JSON.stringify(preview.body));
        assert.equal(preview.body.data.items.length, 1);
        assert.equal(preview.body.data.items[0].productId, String(selected));
        assert.equal(preview.body.data.items[0].quantity, 9);
        const body = { ...s.body, buyNow, expectedTotalPaise: preview.body.data.totalAmount };
        const placed = await call(s.customer, "/orders", "POST", body);
        assert.equal(placed.status, 201, JSON.stringify(placed.body));
        assert.equal((await Product.findById(selected)).stock, 11);
        assert.equal((await Product.findById(s.productId)).stock, 20);
        assert.deepEqual(await ShoppingList.findOne({ userId: s.userId }).lean(), before);
        const replay = await call(s.customer, "/orders", "POST", body);
        assert.equal(replay.status, 200);
        assert.equal(replay.body.data.order.id, placed.body.data.order.id);
        assert.equal((await Product.findById(selected)).stock, 11);
        const changed = await call(s.customer, "/orders", "POST", { ...body, buyNow: { ...buyNow, quantity: 8 } });
        assert.equal(changed.status, 409);
        await ShoppingList.deleteMany({ userId: s.userId });
        const noCart = await call(s.customer, "/orders", "POST", { ...body, requestId: randomUUID() });
        assert.equal(noCart.status, 201, JSON.stringify(noCart.body));
        assert.equal(await ShoppingList.countDocuments({ userId: s.userId }), 0);
      });
      await t.test("Buy now rejects excess quantity and stock without changing the cart", async () => {
        const s = await seed(5);
        const before = await ShoppingList.findOne({ userId: s.userId }).lean();
        for (const quantity of [0, 10, "2"]) {
          const response = await call(s.customer, "/orders/preview", "POST", { addressId: String(s.addressId), buyNow: { productId: String(s.productId), quantity } });
          assert.equal(response.status, 400);
        }
        const response = await call(s.customer, "/orders", "POST", { ...s.body, buyNow: { productId: String(s.productId), quantity: 6 } });
        assert.equal(response.status, 409);
        assert.equal(await Order.countDocuments({ userId: s.userId }), 0);
        assert.deepEqual(await ShoppingList.findOne({ userId: s.userId }).lean(), before);
      });
      await t.test(
        "obsolete unique orderNumber index is repaired without losing order or payment protections",
        async () => {
          const s = await seed();
          const first = await call(s.customer, "/orders", "POST", s.body);
          assert.equal(first.status, 201, JSON.stringify(first.body));
          const template = (
            await Order.findById(first.body.data.order.id)
          ).toObject();
          await Order.collection.createIndex(
            { orderNumber: 1 },
            { unique: true },
          );
          await Order.collection.createIndex({ createdAt: -1, status: 1 });
          await assert.rejects(
            Order.collection.insertOne({
              ...template,
              _id: oid(),
              orderId: "NS-legacy-index-reproduction",
              requestId: randomUUID(),
            }),
            (error) =>
              error.code === 11000 && Boolean(error.keyPattern?.orderNumber),
          );
          await ShoppingList.updateOne(
            { userId: s.userId },
            {
              $set: {
                cart: [
                  {
                    _id: oid(),
                    productId: s.productId,
                    quantity: 1,
                    variantId: null,
                  },
                ],
              },
              $inc: { __v: 1 },
            },
          );
          const body = { ...s.body, requestId: randomUUID() };
          const second = await call(s.customer, "/orders", "POST", body);
          assert.equal(second.status, 201, JSON.stringify(second.body));
          assert.equal(second.body.data.order.orderId, "NS-0002");
          const replay = await call(s.customer, "/orders", "POST", body);
          assert.equal(replay.status, 200);
          assert.equal(replay.body.data.order.id, second.body.data.order.id);
          assert.equal(await Order.countDocuments(), 2);
          assert.equal((await Product.findById(s.productId)).stock, 8);
          const indexes = await Order.collection.indexes();
          assert.equal(
            indexes.some((index) => index.name === "orderNumber_1"),
            false,
          );
          for (const name of [
            "orderId_1",
            "userId_1_requestId_1",
            "razorpayOrderId_1",
            "razorpayPaymentId_1",
            "createdAt_-1_status_1",
          ])
            assert.ok(
              indexes.some((index) => index.name === name),
              name,
            );
        },
      );
      await t.test(
        "short order references allocate once, roll back failures and survive concurrent checkout",
        async () => {
          const s = await seed();
          const failed = await call(s.customer, "/orders", "POST", {
            ...s.body,
            expectedTotalPaise: 1,
          });
          assert.equal(failed.status, 409);
          const placed = await call(s.customer, "/orders", "POST", s.body);
          assert.equal(placed.body.data.order.orderId, "NS-0001");
          assert.equal(
            (await call(s.customer, "/orders", "POST", s.body)).body.data.order
              .orderId,
            "NS-0001",
          );
          assert.equal((await OrderCounter.findById("orders")).value, 1);
          // Two different customers can place orders at the same time without duplicate references.
          const secondId = oid(),
            thirdId = oid();
          for (const [userId, email] of [
            [secondId, "second@example.test"],
            [thirdId, "third@example.test"],
          ]) {
            await User.collection.insertOne({
              ...s.customer.toObject(),
              _id: userId,
              email,
              addresses: [
                {
                  _id: s.addressId,
                  fullName: "Test Customer",
                  phoneNumber: "+919876543210",
                  addressLine1: "123 Main Street",
                  city: "Kochi",
                  state: "Kerala",
                  postalCode: "682001",
                  country: "IN",
                },
              ],
            });
            await ShoppingList.collection.insertOne({
              userId,
              cart: [
                {
                  _id: oid(),
                  productId: s.productId,
                  quantity: 1,
                  variantId: null,
                },
              ],
              wishlist: [],
              __v: 0,
            });
          }
          const results = await Promise.all(
            [secondId, thirdId].map(async (id) =>
              call(await User.findById(id), "/orders", "POST", {
                ...s.body,
                requestId: randomUUID(),
              }),
            ),
          );
          for (const result of results)
            assert.equal(result.status, 201, JSON.stringify(result.body));
          assert.deepEqual(
            results.map((result) => result.body.data.order.orderId).sort(),
            ["NS-0002", "NS-0003"],
          );
          assert.equal(
            (await call(s.admin, "/admin/dashboard")).body.data.orders,
            3,
          );
        },
      );
      await t.test(
        "legacy references migrate once in date order and remain searchable without changing payment links",
        async () => {
          const s = await seed();
          const placed = await call(s.customer, "/orders", "POST", s.body);
          const template = (
            await Order.findById(placed.body.data.order.id)
          ).toObject();
          await Order.deleteMany({});
          await OrderCounter.deleteMany({});
          const firstId = oid(),
            secondId = oid();
          const legacyFirst = "NS-legacy-first-reference",
            legacySecond = "NS-legacy-second-reference";
          await Order.collection.insertMany([
            {
              ...template,
              _id: firstId,
              orderId: legacyFirst,
              requestId: randomUUID(),
              createdAt: new Date("2026-01-01"),
              razorpayOrderId: "order_unchanged",
              razorpayPaymentId: "pay_unchanged",
            },
            {
              ...template,
              _id: secondId,
              orderId: legacySecond,
              requestId: randomUUID(),
              createdAt: new Date("2026-02-01"),
            },
          ]);
          assert.equal(await backfillOrderNumbers(), 2);
          const first = await Order.findById(firstId),
            second = await Order.findById(secondId);
          assert.equal(first.orderId, "NS-0001");
          assert.equal(second.orderId, "NS-0002");
          assert.equal(first.legacyOrderId, legacyFirst);
          assert.equal(first.razorpayOrderId, "order_unchanged");
          assert.equal(first.razorpayPaymentId, "pay_unchanged");
          assert.equal(first.totalAmount, template.totalAmount);
          assert.deepEqual(first.items.toObject(), template.items);
          assert.equal(await backfillOrderNumbers(), 0);
          assert.equal((await OrderCounter.findById("orders")).value, 2);
          const search = await call(
            s.customer,
            "/orders?search=" + legacyFirst,
          );
          assert.equal(search.body.data.orders.length, 1);
          assert.equal(search.body.data.orders[0].orderId, "NS-0001");
          assert.equal(
            (await call(s.customer, `/orders/${firstId}`)).status,
            200,
          );
        },
      );
      await t.test(
        "cash receipt action is admin-only, idempotent and never bypasses online verification",
        async () => {
          const s = await seed();
          const placed = await call(s.customer, "/orders", "POST", s.body),
            id = placed.body.data.order.id;
          assert.equal(
            (
              await call(
                s.customer,
                `/admin/orders/${id}/mark-paid`,
                "POST",
                {},
              )
            ).status,
            403,
          );
          const attempts = await Promise.all([
            call(s.admin, `/admin/orders/${id}/mark-paid`, "POST", {}),
            call(s.admin, `/admin/orders/${id}/mark-paid`, "POST", {}),
          ]);
          for (const result of attempts)
            assert.equal(result.status, 200, JSON.stringify(result.body));
          let order = await Order.findById(id);
          assert.equal(order.paymentStatus, "paid");
          assert.equal(
            order.paymentHistory.filter((event) => event.status === "paid")
              .length,
            1,
          );
          assert.equal((await Product.findById(s.productId)).stock, 9);
          for (const status of ["shipped", "out_for_delivery", "delivered"])
            assert.equal(
              (
                await call(s.admin, `/admin/orders/${id}/status`, "PATCH", {
                  status,
                })
              ).status,
              200,
            );
          order = await Order.findById(id);
          assert.equal(
            order.paymentHistory.filter((event) => event.status === "paid")
              .length,
            1,
            "Delivery must not log a second cash collection",
          );
          await Order.updateOne(
            { _id: id },
            { $set: { paymentMethod: "razorpay", paymentStatus: "pending" } },
          );
          assert.equal(
            (await call(s.admin, `/admin/orders/${id}/mark-paid`, "POST", {}))
              .status,
            409,
          );
          assert.equal((await Order.findById(id)).paymentStatus, "pending");
          await Order.updateOne(
            { _id: id },
            {
              $set: {
                paymentMethod: "cod",
                paymentStatus: "pending",
                orderStatus: "cancelled",
              },
            },
          );
          assert.equal(
            (await call(s.admin, `/admin/orders/${id}/mark-paid`, "POST", {}))
              .status,
            409,
          );
        },
      );
      await t.test(
        "customer requests are admin-only, sorted before pagination, and reject stale updates",
        async () => {
          const s = await seed();
          const records = [];
          for (let index = 0; index < 12; index++)
            records.push({
              reference: "SUP-FIXTURE-" + index,
              requestId: randomUUID(),
              fingerprint: "fixture",
              name: "Customer " + index,
              email: "customer" + index + "@example.test",
              subject: "Question " + index,
              message: "A customer question about an order.",
              status: index === 0 ? "closed" : "open",
              createdAt: new Date(2026, 0, index + 1),
              __v: 0,
            });
          await SupportRequest.collection.insertMany(records);
          assert.equal(
            (await call(s.customer, "/admin/customer-requests")).status,
            403,
          );
          const first = await call(
            s.admin,
            "/admin/customer-requests?page=1&limit=5",
          );
          assert.equal(first.body.data.requests[0].reference, "SUP-FIXTURE-11");
          const second = await call(
            s.admin,
            "/admin/customer-requests?page=2&limit=5",
          );
          assert.equal(second.body.data.requests[0].reference, "SUP-FIXTURE-6");
          assert.equal(first.body.data.summary.total, 12);
          assert.equal(first.body.data.summary.open, 11);
          const selected = first.body.data.requests[0];
          const updated = await call(
            s.admin,
            `/admin/customer-requests/${selected.id}`,
            "PATCH",
            {
              status: "closed",
              note: "Reviewed with customer",
              version: selected.version,
            },
          );
          assert.equal(updated.status, 200);
          assert.equal(updated.body.data.request.version, 1);
          assert.equal(
            (
              await call(
                s.admin,
                `/admin/customer-requests/${selected.id}`,
                "PATCH",
                { status: "open", version: 0 },
              )
            ).status,
            409,
          );
          assert.equal(
            (
              await call(
                s.customer,
                `/admin/customer-requests/${selected.id}`,
                "PATCH",
                { status: "open", version: 1 },
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await call(
                s.admin,
                `/admin/customer-requests/${selected.id}`,
                "PATCH",
                { status: "open", note: "Reopened", version: 1 },
              )
            ).status,
            200,
          );
          const filtered = await call(
            s.admin,
            "/admin/customer-requests?status=closed&search=Customer%200",
          );
          assert.equal(filtered.body.data.pagination.total, 1);
        },
      );
      await t.test(
        "wallet checkout, concurrent replay and cancellation refund adjust the balance exactly once",
        async () => {
          const s = await seed();
          await User.updateOne(
            { _id: s.userId },
            { $set: { walletBalancePaise: 50000 } },
          );
          const preview = await call(s.customer, "/orders/preview", "POST", {
            addressId: String(s.addressId),
          });
          assert.equal(preview.body.data.walletBalancePaise, 50000);
          assert.equal(preview.body.data.paymentMethods.wallet, true);
          const body = { ...s.body, paymentMethod: "wallet" };
          const attempts = await Promise.all([
            call(s.customer, "/orders", "POST", body),
            call(s.customer, "/orders", "POST", body),
          ]);
          for (const result of attempts)
            assert.ok(
              [200, 201].includes(result.status),
              JSON.stringify(result.body),
            );
          const order = attempts[0].body.data.order;
          assert.equal(order.paymentStatus, "paid");
          assert.equal(order.orderStatus, "confirmed");
          assert.equal(await Order.countDocuments(), 1);
          assert.equal(
            (await User.findById(s.userId).select("+walletBalancePaise"))
              .walletBalancePaise,
            35000,
          );
          assert.equal(
            await WalletTransaction.countDocuments({ type: "debit" }),
            1,
          );
          assert.equal((await Product.findById(s.productId)).stock, 9);
          const results = await Promise.all([
            call(s.customer, `/orders/${order.id}/cancel`, "POST", {}),
            call(s.customer, `/orders/${order.id}/cancel`, "POST", {}),
          ]);
          for (const result of results)
            assert.equal(result.status, 200, JSON.stringify(result.body));
          assert.equal(
            (await User.findById(s.userId).select("+walletBalancePaise"))
              .walletBalancePaise,
            50000,
          );
          assert.equal(
            await WalletTransaction.countDocuments({ type: "credit" }),
            1,
          );
          assert.equal((await Product.findById(s.productId)).stock, 10);
          const wallet = await call(s.customer, "/wallet?limit=1");
          assert.equal(wallet.body.data.total, 2);
          assert.equal(wallet.body.data.transactions[0].type, "credit");
          const second = await call(s.customer, "/wallet?limit=1&page=2");
          assert.equal(second.body.data.transactions[0].type, "debit");
          assert.equal((await call(s.admin, "/wallet")).status, 403);
          const other = {
            ...s.customer.toObject(),
            _id: new mongoose.Types.ObjectId(),
            email: "other@example.test",
          };
          await User.collection.insertOne(other);
          assert.equal(
            (await call(await User.findById(other._id), "/wallet")).body.data
              .total,
            0,
          );
        },
      );
      await t.test(
        "wallet insufficient funds rolls back order, stock, cart and ledger",
        async () => {
          const s = await seed();
          await User.updateOne(
            { _id: s.userId },
            { $set: { walletBalancePaise: 14999 } },
          );
          assert.equal(
            (
              await call(s.customer, "/orders", "POST", {
                ...s.body,
                paymentMethod: "wallet",
              })
            ).status,
            409,
          );
          assert.equal(await Order.countDocuments(), 0);
          assert.equal(await WalletTransaction.countDocuments(), 0);
          assert.equal((await Product.findById(s.productId)).stock, 10);
          assert.equal(
            (await ShoppingList.findOne({ userId: s.userId })).cart.length,
            1,
          );
        },
      );
      await t.test(
        "completed wallet return credits exactly once after receipt",
        async () => {
          const s = await seed();
          await User.updateOne(
            { _id: s.userId },
            { $set: { walletBalancePaise: 15000 } },
          );
          const placed = await call(s.customer, "/orders", "POST", {
            ...s.body,
            paymentMethod: "wallet",
          });
          const id = placed.body.data.order.id;
          await Order.updateOne(
            { _id: id },
            {
              $set: {
                orderStatus: "delivered",
                returnRequest: { status: "accepted" },
              },
            },
          );
          for (let attempt = 0; attempt < 2; attempt++)
            assert.equal(
              (
                await call(
                  s.admin,
                  `/admin/orders/${id}/return/complete`,
                  "POST",
                  {},
                )
              ).status,
              200,
            );
          assert.equal(
            (await User.findById(s.userId).select("+walletBalancePaise"))
              .walletBalancePaise,
            15000,
          );
          assert.equal(
            await WalletTransaction.countDocuments({ operation: "refund" }),
            1,
          );
          assert.equal((await Order.findById(id)).refund.status, "completed");
          assert.equal((await Product.findById(s.productId)).stock, 10);
        },
      );
      await t.test("request references are sequential under concurrent submission and legacy references remain searchable", async () => {
        const s=await seed();
        const send=async(requestId,subject="Delivery question")=>{
          const result=await sendMessage({body:{requestId,name:"Asha Devi",email:"asha@example.test",subject,message:"Please help with my order delivery."}});
          return {status:result.status,json:async()=>result.body};
        };
        const firstId=randomUUID();
        const first=await send(firstId);
        assert.equal(first.status,201);
        assert.equal((await first.json()).data.reference,"REQ-10001");
        const results=await Promise.all(Array.from({length:8},()=>send(randomUUID())));
        const references=[];
        for(const result of results){assert.equal(result.status,201);references.push((await result.json()).data.reference);}
        assert.equal(new Set(references).size,8);
        assert.ok(references.every(reference=>/^REQ-1000[2-9]$/.test(reference)));
        assert.equal((await send(firstId)).status,200);
        assert.equal(await SupportRequest.countDocuments(),9);
        await SupportRequest.collection.insertOne({reference:"SUP-ORIGINAL-REFERENCE",requestId:randomUUID(),fingerprint:"fixture",name:"Legacy Customer",email:"old@example.test",subject:"Previous enquiry",message:"A previously submitted support message.",status:"closed",createdAt:new Date(2025,0,1),__v:0});
        await backfillRequestReferences();
        const legacy=await SupportRequest.findOne({legacyReference:"SUP-ORIGINAL-REFERENCE"});
        assert.equal(legacy.reference,"REQ-10010");
        assert.equal(legacy.status,"closed");
        const version=legacy.__v;
        await backfillRequestReferences();
        assert.equal((await SupportRequest.findById(legacy._id)).__v,version);
        const found=await call(s.admin,"/admin/customer-requests?search=SUP-ORIGINAL-REFERENCE");
        assert.equal(found.status,200);
        assert.equal(found.body.data.requests[0].reference,"REQ-10010");
        const saved=await call(s.admin,"/admin/customer-requests/"+legacy._id,"PATCH",{version,status:"open",note:"Following up"});
        assert.equal(saved.status,200);
        const progress=await call(s.admin,"/admin/customer-requests/"+legacy._id,"PATCH",{version:saved.body.data.request.version,status:"in_progress",note:"Checking the enquiry"});
        assert.equal(progress.status,200);
        const filtered=await call(s.admin,"/admin/customer-requests?status=in_progress");
        assert.equal(filtered.body.data.requests.length,1);
        assert.equal(filtered.body.data.summary.in_progress,1);
        const fulfilled=await call(s.admin,"/admin/customer-requests/"+legacy._id,"PATCH",{version:progress.body.data.request.version,status:"closed",note:"Completed"});
        assert.equal(fulfilled.status,200);
        assert.equal(fulfilled.body.data.request.status,"closed");
      });
      await t.test("dashboard return totals and campaign summaries include records outside the current page", async () => {
        const s=await seed();
        const placed=await call(s.customer,"/orders","POST",s.body);
        await Order.updateOne({_id:placed.body.data.order.id},{$set:{"returnRequest.status":"requested"}});
        const dashboard=await call(s.admin,"/admin/dashboard");
        assert.equal(dashboard.body.data.orders,1);
        assert.equal(dashboard.body.data.returns,1);
        const now=Date.now();
        await Campaign.collection.insertMany([
          {name:"Active campaign",isActive:true,startDate:new Date(now-86400000),expiryDate:new Date(now+86400000)},
          {name:"Inactive campaign",isActive:false,startDate:new Date(now-86400000),expiryDate:new Date(now+86400000)},
          {name:"Expired campaign",isActive:true,startDate:new Date(now-86400000),expiryDate:new Date(now-1000)},
          {name:"Scheduled campaign",isActive:true,startDate:new Date(now+86400000),expiryDate:new Date(now+172800000)},
        ].map(c=>({...c,scope:"all",discountType:"percentage",discountValue:10,createdAt:new Date()})));
        const campaigns=await call(s.admin,"/admin/offers?limit=1");
        assert.equal(campaigns.status,200,JSON.stringify(campaigns.body));
        assert.equal(campaigns.body.data.offers.length,1);
        assert.deepEqual(campaigns.body.data.summary,{total:4,active:1,inactive:1});
      });
      await t.test(
        "support persistence is idempotent and public output excludes messages",
        async () => {
          await seed();
          const body = {
            name: "Asha Devi",
            email: "asha@example.test",
            subject: "Delivery update",
            message: "Please help me with a delivery update.",
            requestId: randomUUID(),
          };
          const post = () =>
            fetch(origin + "/support", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
          const first = await post();
          assert.equal(first.status, 201);
          const firstData = await first.json();
          assert.equal(firstData.data.reference, "REQ-10001");
          assert.equal((await post()).status, 200);
          assert.equal(await SupportRequest.countDocuments(), 1);
          body.message = "Different message with the same reference.";
          assert.equal((await post()).status, 409);
          const contact = await (await fetch(origin + "/support")).json();
          assert.deepEqual(Object.keys(contact.data).sort(), [
            "address",
            "email",
            "phone",
            "storeName",
          ]);
        },
      );
      await t.test(
        "address city validation blocks bypasses and profile uploads reject documents",
        async () => {
          const s = await seed();
          const previous = postalDirectory.lookup;
          postalDirectory.lookup = async () => ({
            state: "Kerala",
            districts: ["Ernakulam"],
            cities: ["Kochi", "Ernakulam"],
          });
          try {
            const body = {
              version: 0,
              fullName: "Asha Devi",
              phoneNumber: "9876543210",
              addressLine1: "123 Main Street",
              city: "Chennai",
              state: "Tamil Nadu",
              postalCode: "682001",
            };
            const mismatch = await call(s.customer, "/addresses", "POST", body);
            assert.equal(mismatch.status, 400);
            assert.ok(mismatch.body.data.fieldErrors.city);
            assert.equal(
              (await User.findById(s.userId).select("+addresses")).addresses
                .length,
              1,
            );
            body.city = "Fort Kochi";
            const valid = await call(s.customer, "/addresses", "POST", body);
            assert.equal(valid.status, 201, JSON.stringify(valid.body));
            assert.equal(
              (await call(s.customer, "/addresses/postal/682001")).body.data
                .state,
              "Kerala",
            );
          } finally {
            postalDirectory.lookup = previous;
          }
          for (const [name, type, contents] of [
            ["document.pdf", "application/pdf", "%PDF-1.7"],
            ["renamed.jpg", "image/jpeg", "%PDF-1.7"],
            ["slides.pptx", "image/png", "PK slides"],
          ]) {
            const form = new FormData();
            form.set("name", "Test Customer");
            form.set("phone", "9876543210");
            form.set("photo", new Blob([contents], { type }), name);
            const response = await fetch(origin + "/profile", {
              method: "PATCH",
              headers: {
                Cookie: `${AUTH_COOKIE_NAME}=${createToken(s.customer)}`,
              },
              body: form,
            });
            assert.equal(response.status, 400, name);
          }
        },
      );
      await t.test(
        "COD placement, replay, customer isolation, cancellation and exact stock restoration",
        async () => {
          const s = await seed();
          const first = await call(s.customer, "/orders", "POST", s.body);
          assert.equal(first.status, 201, JSON.stringify(first.body));
          const id = first.body.data.order.id;
          assert.equal((await Product.findById(s.productId)).stock, 9);
          assert.equal(
            (await ShoppingList.findOne({ userId: s.userId })).cart.length,
            0,
          );
          const retry = await call(s.customer, "/orders", "POST", s.body);
          assert.equal(retry.status, 200);
          assert.equal(retry.body.data.order.id, id);
          assert.equal(await Order.countDocuments(), 1);
          assert.equal(
            (
              await call(s.customer, "/orders", "POST", {
                ...s.body,
                expectedTotalPaise: 123,
              })
            ).status,
            409,
          );
          const stranger = await User.create({
            name: "Other",
            email: "other@example.test",
            passwordHash: "fixture",
            role: "customer",
            isEmailVerified: true,
          });
          assert.equal((await call(stranger, `/orders/${id}`)).status, 404);
          assert.equal((await call(s.customer, "/admin/orders")).status, 403);
          assert.equal(
            (await call(s.admin, "/admin/orders")).body.data.orders.length,
            1,
          );
          assert.equal(
            (
              await call(s.customer, `/orders/${id}/cancel`, "POST", {
                reason: "Changed my mind",
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await call(s.customer, `/orders/${id}/cancel`, "POST", {
                reason: "Changed my mind",
              })
            ).status,
            200,
          );
          assert.equal((await Product.findById(s.productId)).stock, 10);
        },
      );
      await t.test("stale total rolls back all writes", async () => {
        const s = await seed();
        assert.equal(
          (
            await call(s.customer, "/orders", "POST", {
              ...s.body,
              expectedTotalPaise: 1,
            })
          ).status,
          409,
        );
        assert.equal(await Order.countDocuments(), 0);
        assert.equal((await Product.findById(s.productId)).stock, 10);
        assert.equal(
          (await ShoppingList.findOne({ userId: s.userId })).cart.length,
          1,
        );
      });
      await t.test(
        "a failure after inventory/coupon/cart writes rolls everything back",
        async () => {
          const s = await seed();
          await Product.collection.updateOne(
            { _id: s.productId },
            { $set: { name: "" } },
          );
          await Coupon.create({
            code: "ROLLBACK",
            discountType: "fixed",
            discountValue: 1000,
            startDate: new Date(0),
            expiryDate: new Date("2099-01-01"),
          });
          const result = await call(s.customer, "/orders", "POST", {
            ...s.body,
            couponCode: "ROLLBACK",
            expectedTotalPaise: 14000,
          });
          assert.equal(result.status, 400, JSON.stringify(result.body));
          assert.equal(await Order.countDocuments(), 0);
          assert.equal((await Product.findById(s.productId)).stock, 10);
          assert.equal((await Coupon.findOne()).usedCount, 0);
          assert.equal(
            (await ShoppingList.findOne({ userId: s.userId })).cart.length,
            1,
          );
        },
      );
      await t.test(
        "checkout rejects hidden categories, foreign addresses and missing request IDs",
        async () => {
          const s = await seed();
          const { requestId, ...missing } = s.body;
          assert.equal(
            (await call(s.customer, "/orders", "POST", missing)).status,
            400,
          );
          assert.equal(
            (
              await call(s.customer, "/orders/preview", "POST", {
                addressId: String(oid()),
              })
            ).status,
            400,
          );
          await Category.updateOne(
            { _id: s.categoryId },
            { $set: { isListed: false } },
          );
          assert.equal(
            (await call(s.customer, "/orders", "POST", s.body)).status,
            400,
          );
          assert.equal(await Order.countDocuments(), 0);
          assert.equal((await Product.findById(s.productId)).stock, 10);
        },
      );
      await t.test(
        "concurrent checkouts cannot oversell the last unit",
        async () => {
          const s = await seed(1);
          const otherId = oid(),
            addressId = oid();
          const record = await User.collection.findOne({ _id: s.userId });
          await User.collection.insertOne({
            ...record,
            _id: otherId,
            email: "other@example.test",
            addresses: [{ ...record.addresses[0], _id: addressId }],
          });
          await ShoppingList.collection.insertOne({
            userId: otherId,
            cart: [
              {
                _id: oid(),
                productId: s.productId,
                quantity: 1,
                variantId: null,
              },
            ],
            wishlist: [],
            __v: 0,
          });
          const other = await User.findById(otherId);
          const results = await Promise.all([
            call(s.customer, "/orders", "POST", s.body),
            call(other, "/orders", "POST", {
              ...s.body,
              addressId: String(addressId),
              requestId: randomUUID(),
            }),
          ]);
          assert.equal(
            results.filter((r) => r.status === 201).length,
            1,
            JSON.stringify(results),
          );
          assert.equal(await Order.countDocuments(), 1);
          assert.equal((await Product.findById(s.productId)).stock, 0);
        },
      );
      await t.test(
        "coupon usage and cart clearing commit together and cancellation releases coupon",
        async () => {
          const s = await seed();
          await Coupon.create({
            code: "SAVE",
            discountType: "percentage",
            discountValue: 10,
            startDate: new Date(0),
            expiryDate: new Date("2099-01-01"),
            usageLimit: 1,
          });
          const result = await call(s.customer, "/orders", "POST", {
            ...s.body,
            couponCode: "save",
            expectedTotalPaise: 14000,
          });
          assert.equal(result.status, 201, JSON.stringify(result.body));
          assert.equal((await Coupon.findOne()).usedCount, 1);
          await call(
            s.customer,
            `/orders/${result.body.data.order.id}/cancel`,
            "POST",
            { reason: "Cancel fixture" },
          );
          assert.equal((await Coupon.findOne()).usedCount, 0);
        },
      );
      await t.test(
        "variant stock and price are used even when base stock is zero",
        async () => {
          const s = await seed(0),
            variantId = oid();
          await Product.collection.updateOne(
            { _id: s.productId },
            {
              $set: {
                variants: [
                  {
                    _id: variantId,
                    name: "Blue",
                    isListed: true,
                    stock: 3,
                    pricePaise: 20000,
                    images: [],
                  },
                ],
              },
            },
          );
          await ShoppingList.collection.updateOne(
            { userId: s.userId },
            { $set: { "cart.0.variantId": variantId } },
          );
          const result = await call(s.customer, "/orders", "POST", {
            ...s.body,
            expectedTotalPaise: 25000,
          });
          assert.equal(result.status, 201, JSON.stringify(result.body));
          const product = await Product.findById(s.productId);
          assert.equal(product.stock, 2);
          assert.equal(product.variants[0].stock, 2);
          const changed = await call(
            s.admin,
            `/admin/inventory/${s.productId}`,
            "PATCH",
            { variantId: String(variantId), stock: 8, version: product.__v },
          );
          assert.equal(changed.status, 200, JSON.stringify(changed.body));
          assert.equal((await Product.findById(s.productId)).stock, 8);
        },
      );
      await t.test(
        "admin status progression and inventory version protection",
        async () => {
          const s = await seed();
          const result = await call(s.customer, "/orders", "POST", s.body),
            id = result.body.data.order.id;
          assert.equal(
            (
              await call(s.admin, `/admin/orders/${id}/status`, "PATCH", {
                status: "delivered",
              })
            ).status,
            409,
          );
          for (const status of ["shipped", "out_for_delivery", "delivered"])
            assert.equal(
              (
                await call(s.admin, `/admin/orders/${id}/status`, "PATCH", {
                  status,
                })
              ).status,
              200,
            );
          assert.equal((await Order.findById(id)).paymentStatus, "paid");
          assert.equal(
            (
              await call(s.admin, `/admin/inventory/${s.productId}`, "PATCH", {
                stock: 12,
                version: 0,
                variantId: null,
              })
            ).status,
            409,
          );
          const version = (await Product.findById(s.productId)).__v;
          assert.equal(
            (
              await call(s.admin, `/admin/inventory/${s.productId}`, "PATCH", {
                stock: 12,
                version,
                variantId: null,
              })
            ).status,
            200,
          );
          assert.equal((await Product.findById(s.productId)).stock, 12);
        },
      );
      await t.test(
        "returns require a reason; admin review, stock restoration and wallet refund are idempotent",
        async () => {
          const s = await seed();
          const placed = await call(s.customer, "/orders", "POST", s.body),
            id = placed.body.data.order.id;
          for (const status of ["shipped", "out_for_delivery", "delivered"])
            await call(s.admin, `/admin/orders/${id}/status`, "PATCH", {
              status,
            });
          assert.equal(
            (await call(s.customer, `/orders/${id}/return`, "POST", {})).status,
            400,
          );
          const requested = await call(
            s.customer,
            `/orders/${id}/return`,
            "POST",
            { reason: "Item does not fit" },
          );
          assert.equal(requested.status, 200);
          assert.equal(
            requested.body.data.order.returnRequest.status,
            "requested",
          );
          assert.equal(
            (
              await call(
                s.customer,
                `/admin/orders/${id}/return/review`,
                "POST",
                { decision: "accepted" },
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await call(s.admin, `/admin/orders/${id}/return/review`, "POST", {
                decision: "accepted",
              })
            ).status,
            200,
          );
          assert.equal(
            (await Product.findById(s.productId)).stock,
            9,
            "Approval must not restock goods not yet received",
          );
          for (let attempt = 0; attempt < 2; attempt++)
            assert.equal(
              (
                await call(
                  s.admin,
                  `/admin/orders/${id}/return/complete`,
                  "POST",
                  {},
                )
              ).status,
              200,
            );
          assert.equal((await Product.findById(s.productId)).stock, 10);
          assert.equal((await Order.findById(id)).refund.status, "pending");
          assert.equal(
            (await call(s.admin, `/admin/orders/${id}/refund`, "POST", {}))
              .status,
            200,
          );
          for (let attempt = 0; attempt < 2; attempt++)
            assert.equal(
              (
                await call(s.admin, `/admin/orders/${id}/refund`, "POST", {
                  reference: "TEST-CASH-VOUCHER",
                })
              ).status,
              200,
            );
          const order = await Order.findById(id);
          assert.equal(order.paymentStatus, "refunded");
          assert.equal(order.refund.status, "completed");
          assert.equal(
            order.paymentHistory.filter((e) => e.status === "refunded").length,
            1,
          );
          assert.equal((await Product.findById(s.productId)).stock, 10);
        },
      );
      await t.test(
        "customer product search, timeframe and authorized photo return workflow",
        async () => {
          const s = await seed();
          const placed = await call(s.customer, "/orders", "POST", s.body),
            id = placed.body.data.order.id;
          for (const status of ["shipped", "out_for_delivery", "delivered"])
            await call(s.admin, `/admin/orders/${id}/status`, "PATCH", {
              status,
            });
          const record = await Order.findById(id);
          assert.equal(
            (
              await call(
                s.customer,
                "/orders?search=" +
                  encodeURIComponent(record.items[0].productName),
              )
            ).body.data.pagination.total,
            1,
          );
          assert.equal(
            (await call(s.customer, "/orders?timeframe=bad")).status,
            400,
          );
          await Order.collection.updateOne(
            { _id: new mongoose.Types.ObjectId(id) },
            { $set: { createdAt: new Date("2020-01-01") } },
          );
          assert.equal(
            (await call(s.customer, "/orders?timeframe=3months")).body.data
              .pagination.total,
            0,
          );
          assert.equal(
            (await call(s.customer, "/orders")).body.data.pagination.total,
            1,
          );
          const pixel = await sharp({
            create: {
              width: 20,
              height: 10,
              channels: 3,
              background: "#777777",
            },
          })
            .png()
            .toBuffer();
          async function upload(bytes = pixel, extra = {}) {
            const form = new FormData();
            for (const [key, value] of Object.entries({
              reason: "Received defective item",
              description: "Sensor fails on startup",
              pickupAddressId: String(s.addressId),
              packagingConfirmed: "true",
              ...extra,
            }))
              form.append(key, value);
            form.append(
              "photos",
              new Blob([bytes], { type: "image/png" }),
              "evidence.png",
            );
            const response = await fetch(origin + `/orders/${id}/return`, {
              method: "POST",
              headers: {
                Cookie: `${AUTH_COOKIE_NAME}=${createToken(s.customer)}`,
              },
              body: form,
            });
            return { status: response.status, body: await response.json() };
          }
          assert.equal((await upload(Buffer.from("not an image"))).status, 400);
          assert.equal(
            (await upload(pixel, { packagingConfirmed: "false" })).status,
            400,
          );
          assert.equal(
            (await upload(pixel, { pickupAddressId: String(oid()) })).status,
            400,
          );
          const requested = await upload();
          assert.equal(requested.status, 200, JSON.stringify(requested.body));
          const request = requested.body.data.order.returnRequest;
          assert.equal(request.description, "Sensor fails on startup");
          assert.equal(request.pickupAddress.city, "Kochi");
          assert.equal(request.packagingConfirmed, true);
          assert.equal(request.photos.length, 1);
          assert.ok(request.reference.startsWith("RET-"));
          assert.equal(request.photos[0].bytes, undefined);
          assert.equal((await upload()).status, 200);
          assert.equal(
            await ReturnPhoto.countDocuments({ orderId: id }),
            1,
            "Replay must not duplicate photos",
          );
          assert.equal(
            (await upload(pixel, { description: "Changed return content" }))
              .status,
            409,
          );
          async function photo(user, route = "orders") {
            return fetch(
              origin + `/${route}/${id}/return/photos/${request.photos[0].id}`,
              {
                headers: { Cookie: `${AUTH_COOKIE_NAME}=${createToken(user)}` },
              },
            );
          }
          const owner = await photo(s.customer);
          assert.equal(owner.status, 200);
          assert.equal(owner.headers.get("content-type"), "image/jpeg");
          assert.equal(owner.headers.get("cache-control"), "private, no-store");
          assert.equal(
            (await sharp(Buffer.from(await owner.arrayBuffer())).metadata())
              .format,
            "jpeg",
          );
          assert.equal((await photo(s.admin, "admin/orders")).status, 200);
          const outsider = await User.create({
            name: "Other Customer",
            email: "other@example.test",
            role: "customer",
            passwordHash: "fixture",
            isEmailVerified: true,
          });
          assert.equal((await photo(outsider)).status, 404);
          assert.equal((await photo(s.customer, "admin/orders")).status, 403);
          const returns = await call(s.admin, "/admin/orders?returnStatus=all");
          assert.equal(returns.body.data.pagination.total, 1);
          assert.equal(returns.body.data.returnSummary.requested, 1);
          assert.equal(
            (await Order.findById(id)).statusHistory.filter(
              (e) => e.status === "return_requested",
            ).length,
            1,
          );
        },
      );
      await t.test(
        "return rejection preserves stock; cancellation reason is optional",
        async () => {
          const s = await seed();
          const placed = await call(s.customer, "/orders", "POST", s.body),
            id = placed.body.data.order.id;
          for (const status of ["shipped", "out_for_delivery", "delivered"])
            await call(s.admin, `/admin/orders/${id}/status`, "PATCH", {
              status,
            });
          await call(s.customer, `/orders/${id}/return`, "POST", {
            reason: "Fixture reason",
          });
          assert.equal(
            (
              await call(s.admin, `/admin/orders/${id}/return/review`, "POST", {
                decision: "rejected",
                note: "Outside policy",
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await call(
                s.admin,
                `/admin/orders/${id}/return/complete`,
                "POST",
                {},
              )
            ).status,
            409,
          );
          assert.equal((await Product.findById(s.productId)).stock, 9);
          const fresh = await seed();
          const next = await call(
            fresh.customer,
            "/orders",
            "POST",
            fresh.body,
          );
          assert.equal(
            (
              await call(
                fresh.customer,
                `/orders/${next.body.data.order.id}/cancel`,
                "POST",
                {},
              )
            ).status,
            200,
          );
        },
      );
      await t.test(
        "order search/sort/pagination and authorized PDF invoice",
        async () => {
          const s = await seed();
          const placed = await call(s.customer, "/orders", "POST", s.body),
            id = placed.body.data.order.id;
          const original = await Order.findById(id);
          await Order.collection.insertOne({
            ...original.toObject(),
            _id: oid(),
            orderId: "NS-OLDER",
            requestId: randomUUID(),
            totalAmount: 9999,
            createdAt: new Date("2020-01-01"),
          });
          const sorted = await call(
            s.admin,
            "/admin/orders?sort=total-asc&limit=1&page=1",
          );
          assert.equal(sorted.body.data.orders[0].orderId, "NS-OLDER");
          assert.equal(sorted.body.data.pagination.totalPages, 2);
          assert.equal(
            (await call(s.admin, "/admin/orders?search=Test%20Customer")).body
              .data.orders.length,
            2,
          );
          assert.equal(
            (await call(s.customer, "/orders?search=NS-OLDER")).body.data.orders
              .length,
            1,
          );
          assert.equal(
            (await call(s.customer, "/orders?sort=bad")).status,
            400,
          );
          const invoice = await fetch(origin + `/orders/${id}/invoice`, {
            headers: {
              Cookie: `${AUTH_COOKIE_NAME}=${createToken(s.customer)}`,
            },
          });
          assert.equal(invoice.status, 200);
          assert.match(invoice.headers.get("content-type"), /application\/pdf/);
          assert.match(
            invoice.headers.get("content-disposition"),
            /attachment; filename="invoice-NS-/,
          );
          const bytes = Buffer.from(await invoice.arrayBuffer());
          assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
          if (process.env.NORTHSTAR_SAMPLE_INVOICE)
            await writeFile(process.env.NORTHSTAR_SAMPLE_INVOICE, bytes);
          const stranger = await User.create({
            name: "Other",
            email: "other@example.test",
            passwordHash: "fixture",
            role: "customer",
            isEmailVerified: true,
          });
          assert.equal(
            (
              await fetch(origin + `/orders/${id}/invoice`, {
                headers: {
                  Cookie: `${AUTH_COOKIE_NAME}=${createToken(stranger)}`,
                },
              })
            ).status,
            404,
          );
        },
      );
      await t.test(
        "admin directories, inventory filters, CSV escaping and retry-safe adjustments",
        async () => {
          const s = await seed();
          await Product.collection.updateOne(
            { _id: s.productId },
            { $set: { name: "@SUM(1+1)" } },
          );
          await Product.collection.insertOne({
            ...(await Product.collection.findOne({ _id: s.productId })),
            _id: oid(),
            name: "Low stock item",
            stock: 2,
          });
          const inventory = await call(
            s.admin,
            "/admin/inventory?sort=stock-asc&limit=1",
          );
          assert.equal(inventory.status, 200);
          assert.equal(inventory.body.data.products[0].stock, 2);
          assert.equal(inventory.body.data.summary.total, 2);
          assert.equal(inventory.body.data.summary.lowStock, 1);
          const body = {
            variantId: null,
            type: "received",
            quantity: 3,
            reason: "Purchase order TEST-123",
            version: 0,
            requestId: randomUUID(),
          };
          const path = `/admin/inventory/${s.productId}/adjustments`;
          assert.equal(
            (await call(s.customer, path, "POST", body)).status,
            403,
          );
          assert.equal((await call(s.admin, path, "POST", body)).status, 201);
          assert.equal((await call(s.admin, path, "POST", body)).status, 200);
          assert.equal((await Product.findById(s.productId)).stock, 13);
          assert.equal(
            await StockAdjustment.countDocuments({ productId: s.productId }),
            1,
          );
          assert.equal(
            (await call(s.admin, path, "POST", { ...body, quantity: 4 }))
              .status,
            409,
          );
          assert.equal(
            (
              await call(s.admin, path, "POST", {
                ...body,
                requestId: randomUUID(),
              })
            ).status,
            409,
          );
          assert.equal(
            (
              await call(s.admin, path, "POST", {
                ...body,
                type: "loss",
                quantity: 100,
                version: 1,
                requestId: randomUUID(),
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await call(s.admin, path, "POST", {
                ...body,
                type: "correction",
                quantity: -2,
                version: 1,
                requestId: randomUUID(),
              })
            ).status,
            201,
          );
          assert.equal((await Product.findById(s.productId)).stock, 11);
          const log = await StockAdjustment.findOne({
            requestId: body.requestId,
          });
          assert.equal(String(log.adminId), s.admin.id);
          assert.equal(log.before, 10);
          assert.equal(log.after, 13);
          assert.ok(log.createdAt);
          const order = await call(s.customer, "/orders", "POST", s.body);
          assert.equal(order.status, 201, JSON.stringify(order.body));
          const orders = await call(s.admin, "/admin/orders?search=SUM");
          assert.equal(orders.body.data.orders.length, 1);
          assert.equal(orders.body.data.summary.total, 1);
          const payments = await call(
            s.admin,
            "/admin/payments?paymentStatus=pending&method=cod",
          );
          assert.equal(payments.status, 200);
          assert.equal(payments.body.data.payments.length, 1);
          assert.equal(payments.body.data.summary.pending, 15000);
          await Order.updateOne(
            { _id: order.body.data.order.id },
            { $set: { razorpayPaymentId: "pay_admin_directory_fixture" } },
          );
          const searched = await call(
            s.admin,
            "/admin/payments?search=pay_admin_directory_fixture",
          );
          assert.equal(searched.body.data.payments.length, 1);
          assert.equal(
            searched.body.data.payments[0].paymentReference,
            "pay_admin_directory_fixture",
          );
          const concurrentBody = {
            ...body,
            quantity: 1,
            version: 3,
            requestId: randomUUID(),
          };
          const concurrent = await Promise.all([
            call(s.admin, path, "POST", concurrentBody),
            call(s.admin, path, "POST", concurrentBody),
          ]);
          assert.ok(
            concurrent.every((r) => [200, 201].includes(r.status)),
            JSON.stringify(concurrent),
          );
          assert.equal((await Product.findById(s.productId)).stock, 11);
          assert.equal((await call(s.customer, "/admin/payments")).status, 403);
          assert.equal(
            (await call(s.admin, "/admin/payments?method=bad")).status,
            400,
          );
          const csv = await fetch(origin + "/admin/inventory/export", {
            headers: { Cookie: AUTH_COOKIE_NAME + "=" + createToken(s.admin) },
          });
          assert.equal(csv.status, 200);
          assert.match(csv.headers.get("content-type"), /text\/csv/);
          assert.ok((await csv.text()).includes("'@SUM(1+1)"));
          for (const url of [
            "/admin/orders/export",
            "/admin/payments/export",
          ]) {
            const response = await fetch(origin + url, {
              headers: {
                Cookie: AUTH_COOKIE_NAME + "=" + createToken(s.admin),
              },
            });
            assert.equal(response.status, 200);
            assert.ok(
              (await response.text()).includes(order.body.data.order.orderId),
            );
          }
        },
      );
      await t.test(
        "existing coupon model supports admin CRUD, safe history, quota checks and real checkout discounts",
        async () => {
          const s = await seed();
          const form = (code) => ({
            code,
            discountType: "percentage",
            discountValue: 10,
            minPurchasePaise: 0,
            maxDiscountPaise: null,
            usageLimit: 2,
            startDate: new Date(Date.now() - 3600000).toISOString(),
            expiryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            isActive: true,
          });
          assert.equal((await fetch(origin + "/admin/coupons")).status, 401);
          assert.equal((await call(s.customer, "/admin/coupons")).status, 403);
          assert.equal(
            (
              await call(
                s.customer,
                "/admin/coupons",
                "POST",
                form("FORBIDDEN"),
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await call(s.admin, "/admin/coupons", "POST", {
                ...form("BAD"),
                usedCount: 8,
              })
            ).status,
            400,
          );
          const coupons = [];
          for (const code of ["ZETA10", "ALPHA10", "BETA10"]) {
            const response = await call(
              s.admin,
              "/admin/coupons",
              "POST",
              form(code),
            );
            assert.equal(response.status, 201, JSON.stringify(response.body));
            coupons.push(response.body.data.coupon);
          }
          const [zeta, alpha, beta] = coupons;
          const sorted = await call(
            s.admin,
            "/admin/coupons?sort=code&limit=1&page=2",
          );
          assert.equal(sorted.body.data.coupons[0].code, "BETA10");
          assert.equal(sorted.body.data.pagination.total, 3);
          assert.equal(sorted.body.data.summary.active, 3);
          assert.equal(
            (await call(s.admin, "/admin/coupons?search=ZETA.*")).body.data
              .coupons.length,
            0,
            "Search must escape regex operators",
          );
          assert.equal(
            (await call(s.admin, "/admin/coupons?status=wrong")).status,
            400,
          );
          assert.equal(
            (await call(s.admin, "/admin/coupons", "POST", form("zeta10")))
              .status,
            409,
          );
          const preview = await call(s.customer, "/orders/preview", "POST", {
            addressId: String(s.addressId),
            couponCode: "ALPHA10",
          });
          assert.equal(preview.body.data.discount, 1000);
          assert.equal(preview.body.data.totalAmount, 14000);
          const statusPath = `/admin/coupons/${zeta.id}/status`;
          assert.equal(
            (
              await call(s.admin, statusPath, "PATCH", {
                version: 0,
                isActive: false,
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await call(s.admin, statusPath, "PATCH", {
                version: 0,
                isActive: true,
              })
            ).status,
            409,
          );
          const removePath = `/admin/coupons/${zeta.id}`;
          assert.equal(
            (await call(s.admin, removePath, "DELETE", { version: 1 })).status,
            400,
          );
          assert.equal(
            (
              await call(s.admin, removePath, "DELETE", {
                version: 1,
                confirmDelete: true,
              })
            ).status,
            200,
          );
          assert.equal(
            (await call(s.admin, "/admin/coupons?status=deleted&search=ZETA10"))
              .body.data.coupons.length,
            1,
          );
          assert.equal(
            (
              await call(s.customer, "/orders/preview", "POST", {
                addressId: String(s.addressId),
                couponCode: "ZETA10",
              })
            ).status,
            400,
          );
          assert.equal((await Product.findById(s.productId)).stock, 10);
          const restored = await call(
            s.admin,
            removePath + "/restore",
            "POST",
            { version: 2 },
          );
          assert.equal(restored.body.data.coupon.isActive, false);
          assert.equal(
            (
              await call(s.admin, statusPath, "PATCH", {
                version: 3,
                isActive: true,
              })
            ).status,
            200,
          );
          const order = await call(s.customer, "/orders", "POST", {
            ...s.body,
            couponCode: "ALPHA10",
            expectedTotalPaise: 14000,
          });
          assert.equal(order.status, 201, JSON.stringify(order.body));
          assert.equal(
            (
              await call(s.admin, `/admin/coupons/${alpha.id}`, "PATCH", {
                ...form("ALPHA_NEW"),
                version: 0,
              })
            ).status,
            409,
          );
          await ShoppingList.updateOne(
            { userId: s.userId },
            {
              $set: {
                cart: [
                  { productId: s.productId, quantity: 1, variantId: null },
                ],
              },
              $inc: { __v: 1 },
            },
          );
          const second = await call(s.customer, "/orders", "POST", {
            ...s.body,
            requestId: randomUUID(),
            couponCode: "ALPHA10",
            expectedTotalPaise: 14000,
          });
          assert.equal(second.status, 201);
          assert.equal((await Coupon.findById(alpha.id)).usedCount, 2);
          assert.equal(
            (
              await call(s.admin, `/admin/coupons/${alpha.id}`, "PATCH", {
                ...form("ALPHA10"),
                usageLimit: 1,
                version: 0,
              })
            ).status,
            409,
          );
          const exhausted = await call(
            s.admin,
            "/admin/coupons?status=exhausted",
          );
          assert.equal(exhausted.body.data.coupons.length, 1);
          assert.equal(exhausted.body.data.coupons[0].code, "ALPHA10");
          assert.equal(
            (
              await call(s.admin, `/admin/coupons/${alpha.id}`, "DELETE", {
                version: 0,
                confirmDelete: true,
              })
            ).status,
            200,
          );
          assert.equal(
            (await Coupon.findById(alpha.id)).usedCount,
            2,
            "Deleting must preserve order usage",
          );
          assert.equal(
            (
              await call(
                s.customer,
                `/orders/${order.body.data.order.id}/cancel`,
                "POST",
                {},
              )
            ).status,
            200,
          );
          assert.equal(
            (await Coupon.findById(alpha.id)).usedCount,
            1,
            "Cancellation must release quota even on a deleted coupon",
          );
          assert.equal(
            (
              await call(
                s.admin,
                `/admin/coupons/${alpha.id}/restore`,
                "POST",
                { version: 1 },
              )
            ).body.data.coupon.status,
            "active",
          );
          const simultaneous = await Promise.all([
            call(s.admin, `/admin/coupons/${beta.id}/status`, "PATCH", {
              version: 0,
              isActive: false,
            }),
            call(s.admin, `/admin/coupons/${beta.id}/status`, "PATCH", {
              version: 0,
              isActive: false,
            }),
          ]);
          assert.deepEqual(
            simultaneous.map((r) => r.status).sort(),
            [200, 409],
          );
          assert.equal(
            (
              await call(
                s.customer,
                `/admin/coupons/${beta.id}/restore`,
                "POST",
                { version: 1 },
              )
            ).status,
            403,
          );
          const legacyId = oid();
          await Coupon.collection.insertOne({
            _id: legacyId,
            ...form("LEGACY10"),
            startDate: new Date(Date.now() - 3600000),
            expiryDate: new Date(Date.now() + 86400000),
          });
          const legacy = await call(
            s.admin,
            `/admin/coupons/${legacyId}/status`,
            "PATCH",
            { version: 0, isActive: false },
          );
          assert.equal(
            legacy.status,
            200,
            "Existing coupons without explicit usage/version fields remain editable",
          );
          assert.equal((await Coupon.findById(legacyId)).__v, 1);
        },
      );
      await t.test(
        "store settings persist, reject stale writes and control checkout without altering saved orders",
        async () => {
          const s = await seed();
          assert.equal((await call(s.customer, "/admin/settings")).status, 403);
          const initial = await call(s.admin, "/admin/settings");
          assert.equal(initial.status, 200);
          assert.equal(await StoreSettings.countDocuments(), 0);
          const body = {
            ...initial.body.data.settings,
            storeName: "Invoice Fixture",
            shippingChargePaise: 1200,
            freeShippingAbovePaise: null,
            taxBasisPoints: 1800,
          };
          const saved = await call(s.admin, "/admin/settings", "PATCH", body);
          assert.equal(saved.status, 200, JSON.stringify(saved.body));
          assert.equal(saved.body.data.settings.freeShippingAbovePaise, null);
          assert.equal(
            (await call(s.admin, "/admin/settings", "PATCH", body)).status,
            409,
          );
          const quote = await call(s.customer, "/orders/preview", "POST", {
            addressId: String(s.addressId),
          });
          assert.equal(quote.body.data.totalAmount, 13000);
          const placed = await call(s.customer, "/orders", "POST", {
            ...s.body,
            expectedTotalPaise: 13000,
          });
          assert.equal(placed.status, 201, JSON.stringify(placed.body));
          const id = placed.body.data.order.id;
          assert.equal(
            (await Order.findById(id)).storeSnapshot.storeName,
            "Invoice Fixture",
          );
          assert.equal(
            (
              await call(s.admin, "/admin/settings", "PATCH", {
                ...body,
                version: 1,
                codEnabled: false,
              })
            ).status,
            200,
          );
          const replay = await call(s.customer, "/orders", "POST", {
            ...s.body,
            expectedTotalPaise: 13000,
          });
          assert.equal(replay.status, 200);
          assert.equal(replay.body.data.order.totalAmount, 13000);
          await ShoppingList.updateOne(
            { userId: s.userId },
            { $set: { cart: [{ productId: s.productId, quantity: 1 }] } },
          );
          assert.equal(
            (
              await call(s.customer, "/orders", "POST", {
                ...s.body,
                requestId: randomUUID(),
                expectedTotalPaise: 13000,
              })
            ).status,
            409,
          );
          assert.equal((await Product.findById(s.productId)).stock, 9);
        },
      );
      await t.test(
        "campaign management drives transactional offers, coupon calculation, stale total rollback and stock restoration",
        async () => {
          const s = await seed();
          const form = {
            name: "Audio fixture",
            description: "",
            scope: "category",
            targetId: String(s.categoryId),
            discountType: "percentage",
            discountValue: 20,
            isActive: true,
            startDate: new Date(Date.now() - 60000).toISOString(),
            expiryDate: new Date(Date.now() + 86400000).toISOString(),
          };
          assert.equal(
            (await call(s.customer, "/admin/offers", "POST", form)).status,
            403,
          );
          const result = await call(s.admin, "/admin/offers", "POST", form);
          assert.equal(result.status, 201, JSON.stringify(result.body));
          const offer = result.body.data.offer;
          assert.equal(
            (await call(s.admin, "/admin/offers?status=active")).body.data
              .offers[0].id,
            offer.id,
          );
          assert.equal(
            (
              await call(
                s.admin,
                "/admin/offers/targets?scope=product&search=Test",
              )
            ).body.data.targets[0].id,
            String(s.productId),
          );
          const coupon = await Coupon.create({
            code: "OFFER10",
            discountType: "percentage",
            discountValue: 10,
            startDate: new Date(Date.now() - 60000),
            expiryDate: new Date(Date.now() + 86400000),
            isActive: true,
          });
          const previewBody = {
            addressId: String(s.addressId),
            couponCode: coupon.code,
          };
          const quote = await call(
            s.customer,
            "/orders/preview",
            "POST",
            previewBody,
          );
          assert.equal(quote.body.data.offerDiscount, 2000);
          assert.equal(quote.body.data.couponDiscount, 800);
          assert.equal(quote.body.data.totalAmount, 12200);
          const stale = await call(s.customer, "/orders", "POST", {
            ...s.body,
            ...previewBody,
          });
          assert.equal(stale.status, 409);
          assert.equal((await Product.findById(s.productId)).stock, 10);
          assert.equal((await Coupon.findById(coupon._id)).usedCount, 0);
          const placed = await call(s.customer, "/orders", "POST", {
            ...s.body,
            ...previewBody,
            expectedTotalPaise: 12200,
          });
          assert.equal(placed.status, 201, JSON.stringify(placed.body));
          const order = placed.body.data.order;
          assert.equal(order.appliedOffers[0].name, form.name);
          assert.equal(order.items[0].unitPricePaise, 10000);
          const changed = await call(
            s.admin,
            `/admin/offers/${offer.id}`,
            "PATCH",
            { ...form, discountValue: 25, version: offer.version },
          );
          assert.equal(changed.status, 200);
          assert.equal(
            (
              await call(s.admin, `/admin/offers/${offer.id}/status`, "PATCH", {
                version: offer.version,
                isActive: false,
              })
            ).status,
            409,
          );
          assert.equal(
            (await call(s.customer, `/orders/${order.id}`)).body.data.order
              .totalAmount,
            12200,
          );
          assert.equal(
            (await call(s.customer, `/orders/${order.id}/cancel`, "POST", {}))
              .status,
            200,
          );
          assert.equal((await Product.findById(s.productId)).stock, 10);
          assert.equal((await Coupon.findById(coupon._id)).usedCount, 0);
        },
      );
      await t.test(
        "sales reports share filtered totals and formula-safe full export, sort before pagination and honor India dates",
        async () => {
          const s = await seed();
          const placed = await call(s.customer, "/orders", "POST", s.body);
          const base = (
            await Order.findById(placed.body.data.order.id)
          ).toObject();
          await Order.deleteMany({});
          const rows = [
            {
              paymentStatus: "paid",
              totalAmount: 20000,
              createdAt: new Date("2026-11-09T18:30:00Z"),
              customer: {
                name: "=formula fixture",
                email: "fixture@example.test",
              },
            },
            {
              paymentStatus: "refunded",
              totalAmount: 15000,
              refund: { status: "completed", amount: 15000 },
              createdAt: new Date("2026-11-10T18:29:59Z"),
            },
            {
              paymentStatus: "failed",
              totalAmount: 90000,
              createdAt: new Date("2026-11-10T10:00:00Z"),
            },
            {
              paymentStatus: "paid",
              totalAmount: 40000,
              createdAt: new Date("2026-11-10T18:30:00Z"),
            },
          ];
          await Order.collection.insertMany(
            rows.map((row, i) => ({
              ...base,
              ...row,
              _id: oid(),
              requestId: randomUUID(),
              orderId: `NS-SALES-${i}`,
            })),
          );
          assert.equal(
            (await call(s.customer, "/admin/reports/sales")).status,
            403,
          );
          const query =
            "?from=2026-11-10&to=2026-11-10&sort=total-desc&limit=1&page=2";
          const result = await call(s.admin, "/admin/reports/sales" + query);
          assert.equal(result.status, 200, JSON.stringify(result.body));
          assert.deepEqual(result.body.data.summary, {
            orders: 3,
            collected: 35000,
            refunded: 15000,
            completedOrders: 0,
            completedSales: 0,
          });
          assert.equal(result.body.data.orders[0].orderId, "NS-SALES-0");
          assert.equal(result.body.data.trend[0].period, "2026-11-10");
          const response = await fetch(
            origin + "/admin/reports/sales/export" + query,
            {
              headers: {
                Cookie: `${AUTH_COOKIE_NAME}=${createToken(s.admin)}`,
              },
            },
          );
          assert.equal(response.status, 200);
          const csv = await response.text();
          assert.equal(csv.trim().split("\r\n").length, 4);
          assert.ok(csv.includes("'=formula fixture"));
          const empty = await call(
            s.admin,
            "/admin/reports/sales?from=2025-01-01&to=2025-01-01",
          );
          assert.deepEqual(empty.body.data.summary, {
            orders: 0,
            collected: 0,
            refunded: 0,
            completedOrders: 0,
            completedSales: 0,
          });
        },
      );
      if (process.env.NORTHSTAR_POSTMAN)
        await t.test(
          "Postman collection exercises the live local app and isolated database",
          async () => {
            const s = await seed();
            const collection = fileURLToPath(
              new URL(
                "../../postman/northstar-orders.postman_collection.json",
                import.meta.url,
              ),
            );
            const args = [
              "collection",
              "run",
              collection,
              "--no-report-events",
              "--env-var",
              `baseUrl=${origin}`,
              "--env-var",
              `customerCookie=${AUTH_COOKIE_NAME}=${createToken(s.customer)}`,
              "--env-var",
              `adminCookie=${AUTH_COOKIE_NAME}=${createToken(s.admin)}`,
              "--env-var",
              `addressId=${s.addressId}`,
              "--env-var",
              `productId=${s.productId}`,
              "--env-var",
              `requestId=${randomUUID()}`,
            ];
            const result = await new Promise((resolve, reject) => {
              const child = spawn(
                process.platform === "win32" ? "postman.exe" : "postman",
                args,
                { windowsHide: true },
              );
              let output = "";
              child.stdout.on("data", (b) => {
                output += b;
              });
              child.stderr.on("data", (b) => {
                output += b;
              });
              child.on("error", reject);
              child.on("close", (code) => resolve({ code, output }));
            });
            assert.equal(result.code, 0, result.output);
            assert.equal(await Order.countDocuments(), 1);
          },
        );
      if (process.env.RAZORPAY_TEST_URL)
        await t.test(
          "Razorpay HTTP simulation: setup, retry, signature and captured-payment confirmation",
          async () => {
            const s = await seed();
            process.env.RAZORPAY_KEY_ID = "rzp_test_fixture";
            process.env.RAZORPAY_KEY_SECRET = "fixture-only-secret";
            const result = await call(s.customer, "/orders", "POST", {
                ...s.body,
                paymentMethod: "razorpay",
              }),
              id = result.body.data.order.id;
            assert.equal(result.status, 201, JSON.stringify(result.body));
            const setup = await call(
              s.customer,
              `/orders/${id}/payment`,
              "POST",
            );
            assert.equal(setup.status, 200, JSON.stringify(setup.body));
            const gatewayId = setup.body.data.checkout.order_id;
            const retry = await call(
              s.customer,
              `/orders/${id}/payment`,
              "POST",
            );
            assert.equal(retry.body.data.checkout.order_id, gatewayId);
            assert.equal(
              (
                await call(s.customer, `/orders/${id}/payment/verify`, "POST", {
                  razorpay_order_id: gatewayId,
                  razorpay_payment_id: "pay_fixture",
                  razorpay_signature: "0".repeat(64),
                })
              ).status,
              400,
            );
            await fetch(process.env.RAZORPAY_TEST_URL + "/__capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: gatewayId }),
            });
            const signature = createHmac(
              "sha256",
              process.env.RAZORPAY_KEY_SECRET,
            )
              .update(`${gatewayId}|pay_fixture`)
              .digest("hex");
            const verified = await call(
              s.customer,
              `/orders/${id}/payment/verify`,
              "POST",
              {
                razorpay_order_id: gatewayId,
                razorpay_payment_id: "pay_fixture",
                razorpay_signature: signature,
              },
            );
            assert.equal(verified.status, 200, JSON.stringify(verified.body));
            assert.equal(verified.body.data.order.paymentStatus, "paid");
            assert.equal(verified.body.data.order.orderStatus, "confirmed");
            assert.equal((await Product.findById(s.productId)).stock, 9);
            process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-fixture-only";
            const event = JSON.stringify({
              entity: "event",
              event: "payment.captured",
              payload: {
                payment: {
                  entity: {
                    id: "pay_fixture",
                    order_id: gatewayId,
                    amount: 15000,
                    currency: "INR",
                    status: "captured",
                  },
                },
              },
            });
            const webhookSignature = createHmac(
              "sha256",
              process.env.RAZORPAY_WEBHOOK_SECRET,
            )
              .update(event)
              .digest("hex");
            const webhook = (signature) =>
              fetch(origin + "/payments/razorpay/webhook", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-razorpay-signature": signature,
                },
                body: event,
              });
            assert.equal((await webhook("0".repeat(64))).status, 400);
            const version = (await Order.findById(id)).__v;
            assert.equal((await webhook(webhookSignature)).status, 200);
            assert.equal((await webhook(webhookSignature)).status, 200);
            assert.equal((await Order.findById(id)).__v, version);
            // A delayed failure event cannot overwrite a captured payment.
            const failureData = JSON.parse(event);
            failureData.event = "payment.failed";
            failureData.payload.payment.entity.status = "failed";
            failureData.payload.payment.entity.id = "pay_failedattempt";
            const failure = JSON.stringify(failureData);
            await fetch(origin + "/payments/razorpay/webhook", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-razorpay-signature": createHmac(
                  "sha256",
                  process.env.RAZORPAY_WEBHOOK_SECRET,
                )
                  .update(failure)
                  .digest("hex"),
              },
              body: failure,
            });
            assert.equal((await Order.findById(id)).paymentStatus, "paid");
            assert.equal(
              (await call(s.customer, `/orders/${id}/cancel`, "POST", {}))
                .status,
              200,
            );
            assert.equal((await Product.findById(s.productId)).stock, 10);
            await fetch(process.env.RAZORPAY_TEST_URL + "/__control", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dropRefundResponse: true }),
            });
            assert.equal(
              (await call(s.admin, `/admin/orders/${id}/refund`, "POST", {}))
                .status,
              503,
            );
            const refunded = await call(
              s.admin,
              `/admin/orders/${id}/refund`,
              "POST",
              {},
            );
            assert.equal(refunded.status, 200, JSON.stringify(refunded.body));
            assert.equal(refunded.body.data.order.refund.status, "completed");
            assert.equal(refunded.body.data.order.paymentStatus, "refunded");
            assert.equal(
              (await call(s.admin, `/admin/orders/${id}/refund`, "POST", {}))
                .status,
              200,
            );
            assert.equal((await Product.findById(s.productId)).stock, 10);
          },
        );
      if (process.env.RAZORPAY_TEST_URL)
        await t.test(
          "rejected/lost payment setup responses recover without duplicate orders; late capture stays cancelled",
          async () => {
            process.env.RAZORPAY_KEY_ID = "rzp_test_fixture";
            process.env.RAZORPAY_KEY_SECRET = "fixture-only-secret";
            const control = (value) =>
              fetch(process.env.RAZORPAY_TEST_URL + "/__control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(value),
              });
            let s = await seed();
            let placed = await call(s.customer, "/orders", "POST", {
              ...s.body,
              paymentMethod: "razorpay",
            });
            let id = placed.body.data.order.id;
            await control({ nextOrdersStatus: 400 });
            assert.equal(
              (await call(s.customer, `/orders/${id}/payment`, "POST")).status,
              503,
            );
            const recovered = await call(
              s.customer,
              `/orders/${id}/payment`,
              "POST",
            );
            assert.equal(recovered.status, 200, JSON.stringify(recovered.body));
            const gatewayId = recovered.body.data.checkout.order_id;
            await call(s.customer, `/orders/${id}/cancel`, "POST", {});
            await fetch(process.env.RAZORPAY_TEST_URL + "/__capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: gatewayId }),
            });
            const signature = createHmac(
              "sha256",
              process.env.RAZORPAY_KEY_SECRET,
            )
              .update(`${gatewayId}|pay_fixture`)
              .digest("hex");
            const late = await call(
              s.customer,
              `/orders/${id}/payment/verify`,
              "POST",
              {
                razorpay_order_id: gatewayId,
                razorpay_payment_id: "pay_fixture",
                razorpay_signature: signature,
              },
            );
            assert.equal(late.status, 200);
            assert.equal(late.body.data.order.orderStatus, "cancelled");
            assert.equal(late.body.data.order.refund.status, "pending");
            assert.equal((await Product.findById(s.productId)).stock, 10);
            s = await seed();
            placed = await call(s.customer, "/orders", "POST", {
              ...s.body,
              paymentMethod: "razorpay",
            });
            id = placed.body.data.order.id;
            await control({ dropOrderResponse: true });
            assert.equal(
              (await call(s.customer, `/orders/${id}/payment`, "POST")).status,
              503,
            );
            const retry = await call(
              s.customer,
              `/orders/${id}/payment`,
              "POST",
            );
            assert.equal(retry.status, 200, JSON.stringify(retry.body));
            assert.equal(await Order.countDocuments(), 1);
            assert.equal((await Product.findById(s.productId)).stock, 9);
          },
        );
      if (process.env.RAZORPAY_TEST_URL) {
        const provider = async (path, body) => {
          const r = await fetch(
            process.env.RAZORPAY_TEST_URL + path,
            body === undefined
              ? {}
              : {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                },
          );
          assert.equal(r.status, 200);
          return r.json();
        };
        async function online() {
          const s = await seed();
          process.env.RAZORPAY_KEY_ID = "rzp_test_fixture";
          process.env.RAZORPAY_KEY_SECRET = "fixture-only-secret";
          process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-fixture-only";
          await provider("/__control", {});
          const placed = await call(s.customer, "/orders", "POST", {
            ...s.body,
            paymentMethod: "razorpay",
          });
          assert.equal(placed.status, 201, JSON.stringify(placed.body));
          const id = placed.body.data.order.id;
          const setup = await call(
            s.customer,
            `/orders/${id}/payment`,
            "POST",
            {},
          );
          assert.equal(setup.status, 200, JSON.stringify(setup.body));
          return {
            ...s,
            id,
            gatewayId: setup.body.data.checkout.order_id,
            setup,
          };
        }
        async function verify(s) {
          const signature = createHmac(
            "sha256",
            process.env.RAZORPAY_KEY_SECRET,
          )
            .update(`${s.gatewayId}|pay_fixture`)
            .digest("hex");
          return call(s.customer, `/orders/${s.id}/payment/verify`, "POST", {
            razorpay_order_id: s.gatewayId,
            razorpay_payment_id: "pay_fixture",
            razorpay_signature: signature,
          });
        }
        async function signed(event, eventId = randomUUID()) {
          const body = JSON.stringify(event);
          return fetch(origin + "/payments/razorpay/webhook", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-razorpay-event-id": eventId,
              "x-razorpay-signature": createHmac(
                "sha256",
                process.env.RAZORPAY_WEBHOOK_SECRET,
              )
                .update(body)
                .digest("hex"),
            },
            body,
          });
        }
        await t.test("failed online payment switches to COD on the same order, replay does not adjust stock", async () => {
          const s = await online();
          await provider("/__capture", {orderId:s.gatewayId, status:"failed"});
          const path = "/orders/" + s.id + "/payment-method";
          assert.equal((await call(s.admin, path, "POST", {paymentMethod:"cod"})).status, 403);
          const foreign = {...s.customer.toObject(), _id:oid(), email:"other@example.test"};
          await User.collection.insertOne(foreign);
          assert.equal((await call(await User.findById(foreign._id), path, "POST", {paymentMethod:"cod"})).status, 404);
          assert.equal((await call(s.customer, path, "POST", {paymentMethod:"upi"})).status, 400);
          const changed = await call(s.customer, path, "POST", {paymentMethod:"cod"});
          assert.equal(changed.status, 200, JSON.stringify(changed.body));
          assert.equal(changed.body.data.order.id, s.id);
          assert.equal(changed.body.data.order.orderStatus, "confirmed");
          assert.equal(changed.body.data.order.paymentMethod, "cod");
          assert.equal(changed.body.data.order.paymentStatus, "pending");
          const stored = await Order.findById(s.id);
          assert.equal((await call(s.customer, path, "POST", {paymentMethod:"cod"})).status, 200);
          assert.equal((await Order.findById(s.id)).__v, stored.__v);
          assert.equal(await Order.countDocuments(), 1);
          assert.equal((await Product.findById(s.productId)).stock, 9);
          assert.equal((await call(s.customer, "/orders/" + s.id + "/payment", "POST", {})).status, 409);
          assert.equal((await call(s.customer, "/orders/" + s.id + "/cancel", "POST", {})).status, 200);
          assert.equal((await Product.findById(s.productId)).stock, 10);
        });
        await t.test("wallet switching rolls back on insufficient funds and concurrent retries debit once", async () => {
          const s = await online();
          const path = "/orders/" + s.id + "/payment-method";
          const insufficient = await call(s.customer, path, "POST", {paymentMethod:"wallet"});
          assert.equal(insufficient.status, 409, JSON.stringify(insufficient.body));
          assert.equal((await Order.findById(s.id)).paymentMethod, "razorpay");
          assert.equal(await WalletTransaction.countDocuments(), 0);
          await User.updateOne({_id:s.userId}, {$set:{walletBalancePaise:50000}});
          const results = await Promise.all([1,2,3].map(() => call(s.customer,path,"POST",{paymentMethod:"wallet"})));
          assert.ok(results.every(r=>r.status===200), JSON.stringify(results));
          assert.equal((await User.findById(s.userId).select('+walletBalancePaise')).walletBalancePaise,35000);
          assert.equal(await WalletTransaction.countDocuments({operation:"purchase"}),1);
          assert.equal((await Order.findById(s.id)).paymentStatus,"paid");
          assert.equal(await Order.countDocuments(),1);
          assert.equal((await Product.findById(s.productId)).stock,9);
          assert.equal((await call(s.customer,"/orders/"+s.id+"/cancel","POST",{})).status,200);
          assert.equal((await User.findById(s.userId).select('+walletBalancePaise')).walletBalancePaise,50000);
          assert.equal((await Product.findById(s.productId)).stock,10);
        });
        await t.test("processing online payments block switching; captured payments settle without wallet debit", async () => {
          const s = await online();
          const path = "/orders/"+s.id+"/payment-method";
          for(const status of ["created","authorized"]) {
            await provider("/__capture",{orderId:s.gatewayId,status});
            assert.equal((await call(s.customer,path,"POST",{paymentMethod:"wallet"})).status,409);
            assert.equal((await Order.findById(s.id)).paymentMethod,"razorpay");
          }
          await provider("/__capture",{orderId:s.gatewayId,status:"captured"});
          const result = await call(s.customer,path,"POST",{paymentMethod:"wallet"});
          assert.equal(result.status,200,JSON.stringify(result.body));
          assert.equal(result.body.data.order.paymentMethod,"razorpay");
          assert.equal(result.body.data.order.paymentStatus,"paid");
          assert.equal(await WalletTransaction.countDocuments(),0);
          assert.equal((await Product.findById(s.productId)).stock,9);
        });
        await t.test("COD disabled, gateway outage and cancelled orders cannot switch methods", async () => {
          const s=await online();
          const path="/orders/"+s.id+"/payment-method";
          await StoreSettings.updateOne({_id:"northstar"},{$set:{codEnabled:false}},{upsert:true});
          assert.equal((await call(s.customer,path,"POST",{paymentMethod:"cod"})).status,409);
          await StoreSettings.updateOne({_id:"northstar"},{$set:{codEnabled:true}});
          const originalProvider=process.env.RAZORPAY_TEST_URL;
          process.env.RAZORPAY_TEST_URL="http://127.0.0.1:1";
          let failure;
          try { failure=await call(s.customer,path,"POST",{paymentMethod:"cod"}); }
          finally { process.env.RAZORPAY_TEST_URL=originalProvider; }
          assert.equal(failure.status,503,JSON.stringify(failure.body));
          assert.equal((await Order.findById(s.id)).paymentMethod,"razorpay");
          await provider("/__control",{});
          assert.equal((await call(s.customer,"/orders/"+s.id+"/cancel","POST",{})).status,200);
          assert.equal((await call(s.customer,path,"POST",{paymentMethod:"cod"})).status,409);
          assert.equal((await Product.findById(s.productId)).stock,10);
        });
        await t.test("late online capture on COD preserves shipping progress and prevents cash collection", async () => {
          const s=await online();
          assert.equal((await call(s.customer,"/orders/"+s.id+"/payment-method","POST",{paymentMethod:"cod"})).status,200);
          await Order.updateOne({_id:s.id},{$set:{orderStatus:"shipped"},$inc:{__v:1}});
          await provider("/__capture",{orderId:s.gatewayId,status:"captured"});
          assert.equal((await verify(s)).status,200);
          const stored=await Order.findById(s.id);
          assert.equal(stored.paymentMethod,"razorpay");
          assert.equal(stored.paymentStatus,"paid");
          assert.equal(stored.orderStatus,"shipped");
          assert.equal((await call(s.admin,"/admin/orders/"+s.id+"/mark-paid","POST",{})).status,409);
          assert.equal((await Product.findById(s.productId)).stock,9);
        });
        await t.test("late online capture after wallet purchase queues a separate refund without undoing wallet payment", async () => {
          const s=await online();
          await User.updateOne({_id:s.userId},{$set:{walletBalancePaise:50000}});
          assert.equal((await call(s.customer,"/orders/"+s.id+"/payment-method","POST",{paymentMethod:"wallet"})).status,200);
          await provider("/__capture",{orderId:s.gatewayId,status:"captured"});
          const verified=await verify(s);
          assert.equal(verified.status,200,JSON.stringify(verified.body));
          let stored=await Order.findById(s.id);
          assert.equal(stored.paymentMethod,"wallet");
          assert.equal(stored.paymentStatus,"paid");
          assert.equal(stored.refund.reason,"duplicate_payment");
          assert.equal(stored.refund.status,"pending");
          assert.equal((await call(s.customer,"/orders/"+s.id+"/cancel","POST",{})).status,409);
          assert.equal((await verify(s)).status,200);
          const refunded=await call(s.admin,"/admin/orders/"+s.id+"/refund","POST",{});
          assert.equal(refunded.status,200,JSON.stringify(refunded.body));
          stored=await Order.findById(s.id);
          assert.equal(stored.refund.status,"completed");
          assert.equal(stored.paymentStatus,"paid");
          assert.equal((await User.findById(s.userId).select('+walletBalancePaise')).walletBalancePaise,35000);
          assert.equal((await call(s.customer,"/orders/"+s.id+"/cancel","POST",{})).status,200);
          assert.equal((await User.findById(s.userId).select('+walletBalancePaise')).walletBalancePaise,50000);
          assert.equal((await Product.findById(s.productId)).stock,10);
        });
        await t.test(
          "authorized callbacks capture exactly the stored amount, recover capture response loss and reconcile safely",
          async () => {
            const s = await online();
            assert.equal(
              s.setup.body.data.checkout.prefill.name,
              "Test Customer",
            );
            assert.equal(s.setup.body.data.checkout.key, "rzp_test_fixture");
            assert.equal(s.setup.body.data.checkout.key_secret, undefined);
            await provider("/__capture", {
              orderId: s.gatewayId,
              status: "authorized",
            });
            await provider("/__control", { dropCaptureResponse: true });
            const verified = await verify(s);
            assert.equal(verified.status, 200, JSON.stringify(verified.body));
            assert.equal(verified.body.data.order.paymentStatus, "paid");
            const version = (await Order.findById(s.id)).__v;
            assert.equal((await verify(s)).status, 200);
            assert.equal(
              (
                await call(
                  s.customer,
                  `/orders/${s.id}/payment/reconcile`,
                  "POST",
                  {},
                )
              ).body.data.order.paymentStatus,
              "paid",
            );
            assert.equal((await Order.findById(s.id)).__v, version);
            assert.equal(
              (await Order.findById(s.id)).paymentHistory.filter(
                (e) => e.status === "paid",
              ).length,
              1,
            );
            assert.equal((await Product.findById(s.productId)).stock, 9);
          },
        );
        await t.test(
          "captured payments recover a missing browser callback; ownership and admin authorization are enforced",
          async () => {
            const s = await online();
            const outsider = await User.create({
              name: "Other Customer",
              email: "another@example.test",
              role: "customer",
              passwordHash: "fixture",
              isEmailVerified: true,
            });
            assert.equal(
              (
                await call(
                  outsider,
                  `/orders/${s.id}/payment/reconcile`,
                  "POST",
                  {},
                )
              ).status,
              404,
            );
            assert.equal(
              (
                await call(
                  s.customer,
                  `/admin/orders/${s.id}/payment/reconcile`,
                  "POST",
                  {},
                )
              ).status,
              403,
            );
            await provider("/__capture", { orderId: s.gatewayId });
            const recovered = await call(
              s.admin,
              `/admin/orders/${s.id}/payment/reconcile`,
              "POST",
              {},
            );
            assert.equal(recovered.status, 200);
            assert.equal(recovered.body.data.order.orderStatus, "confirmed");
            assert.equal(await Order.countDocuments(), 1);
            assert.equal((await Product.findById(s.productId)).stock, 9);
            assert.equal(
              (await call(s.customer, `/orders/${s.id}/payment`, "POST", {}))
                .body.data.checkout,
              null,
            );
          },
        );
        await t.test(
          "mismatched amount/currency and rejected capture never confirm an order or consume stock twice",
          async () => {
            const s = await online();
            for (const value of [{ amount: 14999 }, { currency: "USD" }]) {
              await provider("/__capture", {
                orderId: s.gatewayId,
                status: "authorized",
                ...value,
              });
              assert.equal((await verify(s)).status, 409);
              assert.equal(
                (await Order.findById(s.id)).paymentStatus,
                "pending",
              );
            }
            await provider("/__capture", {
              orderId: s.gatewayId,
              status: "authorized",
            });
            await provider("/__control", { rejectCapture: true });
            assert.equal((await verify(s)).status, 503);
            assert.equal((await Order.findById(s.id)).orderStatus, "pending");
            await provider("/__control", {});
            assert.equal(
              (
                await call(
                  s.customer,
                  `/orders/${s.id}/payment/reconcile`,
                  "POST",
                  {},
                )
              ).body.data.order.paymentStatus,
              "paid",
            );
            assert.equal((await Product.findById(s.productId)).stock, 9);
          },
        );
        await t.test(
          "cancellation during provider setup retains its association; cancelled authorizations are never captured",
          async () => {
            const s = await seed();
            process.env.RAZORPAY_KEY_ID = "rzp_test_fixture";
            process.env.RAZORPAY_KEY_SECRET = "fixture-only-secret";
            const placed = await call(s.customer, "/orders", "POST", {
                ...s.body,
                paymentMethod: "razorpay",
              }),
              id = placed.body.data.order.id;
            await provider("/__control", { delayOrderMs: 300 });
            const setup = call(s.customer, `/orders/${id}/payment`, "POST", {});
            // Observe the actual in-flight claim before cancellation, without an arbitrary delay.
            let claim;
            for (let attempt = 0; attempt < 50; attempt++) {
              claim = await Order.findById(id);
              if (claim.paymentSetupUntil) break;
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
            assert.ok(claim.paymentSetupUntil);
            assert.equal(
              (await call(s.customer, `/orders/${id}/cancel`, "POST", {}))
                .status,
              200,
            );
            assert.equal((await setup).status, 409);
            const linked = await Order.findById(id);
            assert.ok(linked.razorpayOrderId);
            await provider("/__capture", {
              orderId: linked.razorpayOrderId,
              status: "authorized",
            });
            const before = (await provider("/__state")).captureRequests;
            const checked = await call(
              s.customer,
              `/orders/${id}/payment/reconcile`,
              "POST",
              {},
            );
            assert.equal(checked.body.data.order.orderStatus, "cancelled");
            assert.equal(checked.body.data.order.paymentStatus, "pending");
            assert.equal((await provider("/__state")).captureRequests, before);
            await provider("/__capture", { orderId: linked.razorpayOrderId });
            const late = await call(
              s.customer,
              `/orders/${id}/payment/reconcile`,
              "POST",
              {},
            );
            assert.equal(late.body.data.order.refund.status, "pending");
            assert.equal(late.body.data.order.orderStatus, "cancelled");
            assert.equal((await Product.findById(s.productId)).stock, 10);
          },
        );
        await t.test(
          "webhooks capture authorized payments, deduplicate event IDs, reject malformed payloads and reconcile paid orders",
          async () => {
            const s = await online();
            await provider("/__capture", {
              orderId: s.gatewayId,
              status: "authorized",
            });
            const payment = {
              id: "pay_fixture",
              order_id: s.gatewayId,
              amount: 15000,
              currency: "INR",
              status: "authorized",
            };
            const event = {
                entity: "event",
                event: "payment.authorized",
                payload: { payment: { entity: payment } },
              },
              eventId = randomUUID();
            assert.equal((await signed(event, eventId)).status, 200);
            const order = await Order.findById(s.id);
            assert.equal(order.paymentStatus, "paid");
            assert.equal((await signed(event, eventId)).status, 200);
            assert.equal((await Order.findById(s.id)).__v, order.__v);
            assert.equal(
              await PaymentWebhookReceipt.countDocuments({
                _id: `event:${eventId}`,
              }),
              1,
            );
            assert.equal(
              (await signed({ ...event, event: "ignored.event" }, eventId))
                .status,
              400,
            );
            assert.equal((await signed(null)).status, 400);
            const paidEvent = {
              entity: "event",
              event: "order.paid",
              payload: {
                order: { entity: { id: s.gatewayId, status: "paid" } },
              },
            };
            assert.equal((await signed(paidEvent)).status, 200);
            assert.equal(
              (await Order.findById(s.id)).paymentHistory.filter(
                (e) => e.status === "paid",
              ).length,
              1,
            );
            await call(s.customer, `/orders/${s.id}/cancel`, "POST", {});
            const refund = {
              id: "rfnd_webhookfixture",
              payment_id: "pay_fixture",
              amount: 15000,
              currency: "INR",
              status: "processed",
            };
            const refundEvent = {
              entity: "event",
              event: "refund.processed",
              payload: { refund: { entity: refund } },
            };
            assert.equal((await signed(refundEvent)).status, 200);
            assert.equal(
              (await Order.findById(s.id)).paymentStatus,
              "refunded",
            );
            refund.status = "failed";
            refundEvent.event = "refund.failed";
            assert.equal((await signed(refundEvent)).status, 200);
            assert.equal(
              (await Order.findById(s.id)).refund.status,
              "completed",
            );
            assert.equal(
              (await call(s.customer, `/orders/${s.id}/payment`, "POST", {}))
                .status,
              409,
            );
          },
        );
        await t.test(
          "lost setup responses can recover from a signed capture event without opening another payable order",
          async () => {
            const s = await seed();
            process.env.RAZORPAY_KEY_ID = "rzp_test_fixture";
            process.env.RAZORPAY_KEY_SECRET = "fixture-only-secret";
            const placed = await call(s.customer, "/orders", "POST", {
                ...s.body,
                paymentMethod: "razorpay",
              }),
              id = placed.body.data.order.id;
            await provider("/__control", { dropOrderResponse: true });
            assert.equal(
              (await call(s.customer, `/orders/${id}/payment`, "POST", {}))
                .status,
              503,
            );
            const state = await provider("/__state"),
              remote = state.orders.find((o) => o.receipt === id);
            assert.ok(remote);
            assert.equal((await Order.findById(id)).razorpayOrderId, undefined);
            await provider("/__capture", { orderId: remote.id });
            const event = {
              entity: "event",
              event: "payment.captured",
              payload: {
                payment: {
                  entity: {
                    id: "pay_fixture",
                    order_id: remote.id,
                    amount: 15000,
                    currency: "INR",
                    status: "captured",
                  },
                },
              },
            };
            assert.equal((await signed(event)).status, 200);
            const order = await Order.findById(id);
            assert.equal(order.razorpayOrderId, remote.id);
            assert.equal(order.paymentStatus, "paid");
            assert.equal((await Product.findById(s.productId)).stock, 9);
            assert.equal(await Order.countDocuments(), 1);
          },
        );
      }
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (
        mongoose.connection.name === database &&
        /^northstar_codex_test_/.test(database)
      )
        await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
