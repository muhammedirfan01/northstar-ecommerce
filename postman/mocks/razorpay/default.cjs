const http = require("http");
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://local.test");
    const body = req.body || {};
    const state = (await pm.state.get("razorpay.records")) || {
      orders: {},
      payments: {},
      sequence: 0,
    };
    state.refunds ||= {};
    state.controls ||= {};
    const send = (status, value) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(value));
    };
    if (url.pathname === "/__control" && req.method === "POST") {
      state.controls = body;
      await pm.state.set("razorpay.records", state);
      return send(200, { success: true });
    }
    if (url.pathname === "/__state" && req.method === "GET")
      return send(200, {
        orderCount: Object.keys(state.orders).length,
        orders: Object.values(state.orders).map((o) => ({
          id: o.id,
          receipt: o.receipt,
          status: o.status,
        })),
        payments: Object.values(state.payments),
        captureRequests: state.captureRequests || 0,
        refundCount: Object.keys(state.refunds).length,
      });
    if (url.pathname === "/__capture" && req.method === "POST") {
      const order = state.orders[body.orderId];
      if (!order) return send(404, {});
      const paymentId = body.paymentId || "pay_fixture";
      state.payments[paymentId] = {
        id: body.paymentId || "pay_fixture",
        order_id: order.id,
        amount: body.amount ?? order.amount,
        currency: body.currency || "INR",
        status: body.status || "captured",
        captured: (body.status || "captured") === "captured",
      };
      order.status = body.status === "authorized" ? "attempted" : "paid";
      await pm.state.set("razorpay.records", state);
      return send(200, { success: true });
    }
    if (url.pathname === "/orders" && req.method === "POST") {
      if (state.controls.nextOrdersStatus) {
        const status = state.controls.nextOrdersStatus;
        delete state.controls.nextOrdersStatus;
        await pm.state.set("razorpay.records", state);
        return send(status, {
          error: { description: "Injected provider rejection" },
        });
      }
      if (
        !Number.isSafeInteger(body.amount) ||
        body.amount < 100 ||
        body.currency !== "INR" ||
        !body.receipt
      )
        return send(400, { error: { description: "Invalid order" } });
      if (Object.values(state.orders).some((o) => o.receipt === body.receipt))
        return send(400, { error: { description: "Duplicate receipt" } });
      const order = {
        id: `order_fixture${++state.sequence}`,
        entity: "order",
        amount: body.amount,
        currency: "INR",
        receipt: body.receipt,
        status: "created",
      };
      state.orders[order.id] = order;
      const delay = state.controls.delayOrderMs || 0;
      delete state.controls.delayOrderMs;
      const drop = state.controls.dropOrderResponse;
      delete state.controls.dropOrderResponse;
      await pm.state.set("razorpay.records", state);
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (drop) return res.destroy();
      return send(200, order);
    }
    if (url.pathname === "/orders" && req.method === "GET")
      return send(200, {
        items: Object.values(state.orders).filter(
          (o) =>
            !url.searchParams.has("receipt") ||
            o.receipt === url.searchParams.get("receipt"),
        ),
      });
    const match = url.pathname.match(/^\/orders\/([^/]+)\/payments$/);
    if (match && req.method === "GET")
      return send(200, {
        items: Object.values(state.payments).filter(
          (p) => p.order_id === match[1],
        ),
      });
    const captureMatch = url.pathname.match(/^\/payments\/([^/]+)\/capture$/);
    if (captureMatch && req.method === "POST") {
      const payment = state.payments[captureMatch[1]];
      if (
        !payment ||
        payment.status !== "authorized" ||
        body.amount !== payment.amount ||
        body.currency !== payment.currency
      )
        return send(400, {
          error: { description: "Payment is not capturable" },
        });
      state.captureRequests = (state.captureRequests || 0) + 1;
      if (state.controls.rejectCapture) {
        await pm.state.set("razorpay.records", state);
        return send(400, {
          error: { description: "Injected capture rejection" },
        });
      }
      payment.status = "captured";
      payment.captured = true;
      state.orders[payment.order_id].status = "paid";
      const drop = state.controls.dropCaptureResponse;
      delete state.controls.dropCaptureResponse;
      await pm.state.set("razorpay.records", state);
      if (drop) return res.destroy();
      return send(200, payment);
    }
    const orderMatch = url.pathname.match(/^\/orders\/([^/]+)$/);
    if (orderMatch && req.method === "GET")
      return send(
        state.orders[orderMatch[1]] ? 200 : 404,
        state.orders[orderMatch[1]] || {},
      );
    const refundMatch = url.pathname.match(/^\/payments\/([^/]+)\/refund$/);
    if (refundMatch && req.method === "POST") {
      const key = req.headers["x-refund-idempotency"],
        payment = state.payments[refundMatch[1]];
      if (!key || !payment || body.amount !== payment.amount)
        return send(400, { error: { description: "Invalid refund" } });
      if (state.refunds[key]) return send(200, state.refunds[key]);
      const refund = {
        id: `rfnd_fixture${++state.sequence}`,
        payment_id: payment.id,
        amount: body.amount,
        currency: "INR",
        status: "processed",
        receipt: body.receipt,
      };
      state.refunds[key] = refund;
      const drop = state.controls.dropRefundResponse;
      delete state.controls.dropRefundResponse;
      await pm.state.set("razorpay.records", state);
      if (drop) return res.destroy();
      return send(200, refund);
    }
    if (url.pathname.startsWith("/refunds/") && req.method === "GET") {
      const refund = Object.values(state.refunds).find(
        (r) => r.id === url.pathname.split("/").pop(),
      );
      return send(refund ? 200 : 404, refund || {});
    }
    if (url.pathname.startsWith("/payments/") && req.method === "GET") {
      const payment = state.payments[url.pathname.split("/").pop()];
      return send(
        payment ? 200 : 404,
        payment || { error: { description: "Not found" } },
      );
    }
    return send(501, {
      error: { description: "Endpoint not modeled by this contract simulator" },
    });
  })
  .listen(process.env.PORT || 4519);
