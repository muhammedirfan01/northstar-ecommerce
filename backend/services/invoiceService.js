import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import { findOrder } from "./customerOrderService.js";

const money = (value) => `INR ${(value / 100).toFixed(2)}`;
export function renderInvoice(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      bufferPages: true,
      info: {
        Title: `NORTHSTAR invoice ${order.orderId}`,
        Author: "NORTHSTAR",
      },
    });
    const store = order.storeSnapshot || {};
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const font = [
      process.env.INVOICE_FONT_PATH,
      "C:/Windows/Fonts/Nirmala.ttc",
      "C:/Windows/Fonts/arial.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ].find((path) => path && existsSync(path));
    if (font)
      doc.font(font, font.endsWith("Nirmala.ttc") ? "NirmalaUI" : undefined);
    doc.rect(0, 0, 596, 88).fill("#142d39");
    doc
      .fillColor("#ffffff")
      .fontSize(23)
      .text(store.storeName || "NORTHSTAR", 48, 27, {
        width: 340,
        height: 40,
        ellipsis: true,
      });
    doc
      .fontSize(11)
      .text("ORDER INVOICE", 405, 36, { width: 140, align: "right" });
    doc.fillColor("#17252c").fontSize(11);
    doc.text(`Order: ${order.orderId}`, 48, 114, { width: 500 });
    doc.text(
      `Placed: ${new Date(order.createdAt).toISOString().slice(0, 10)}`,
      48,
      137,
    );
    doc.text(
      `Order status: ${order.orderStatus} | Payment: ${order.paymentStatus} (${order.paymentMethod})`,
      48,
      157,
      { width: 500 },
    );
    const a = order.shippingAddress;
    const address = [
      a.name,
      a.addressLine1,
      a.addressLine2,
      `${a.city}, ${a.state} ${a.pincode}`,
      a.phone,
    ]
      .filter(Boolean)
      .join("\n");
    doc.fontSize(12).text("DELIVERY ADDRESS", 48, 195);
    doc.fontSize(10).text(address, 48, 218, { width: 350 });
    let y = Math.max(320, doc.y + 25);
    const contact = [
      store.invoiceAddress,
      store.supportEmail,
      store.supportPhone,
    ]
      .filter(Boolean)
      .join(" | ");
    if (contact) {
      doc.fontSize(9).text(contact, 48, y, { width: 500 });
      y = doc.y + 20;
    }
    const heading = () => {
      doc.rect(48, y, 500, 26).fill("#eef2f3");
      doc.fillColor("#17252c").fontSize(10);
      doc.text("PRODUCT", 58, y + 7, { width: 245 });
      doc.text("QTY", 304, y + 7, { width: 30 });
      doc.text("UNIT PRICE", 346, y + 7, { width: 92, align: "right" });
      doc.text("ITEM TOTAL", 446, y + 7, { width: 92, align: "right" });
      y += 36;
    };
    heading();
    for (const item of order.items) {
      const name = `${item.productName}${item.variantName ? ` / ${item.variantName}` : ""}`;
      const height = Math.max(
        34,
        doc.fontSize(10).heightOfString(name, { width: 235 }) + 16,
      );
      if (y + height > 740) {
        doc.addPage();
        y = 48;
        heading();
      }
      doc.fillColor("#17252c").text(name, 58, y, { width: 235 });
      doc.text(String(item.quantity), 304, y, { width: 30 });
      doc.text(money(item.unitPricePaise), 340, y, {
        width: 98,
        align: "right",
      });
      doc.text(money(item.lineTotalPaise), 440, y, {
        width: 98,
        align: "right",
      });
      y += height;
      doc
        .moveTo(48, y - 8)
        .lineTo(548, y - 8)
        .strokeColor("#e4e7e8")
        .stroke();
    }
    if (y + 205 > 755) {
      doc.addPage();
      y = 48;
    }
    for (const [label, amount] of [
      ["Subtotal", order.subtotal],
      ["Shipping", order.shippingCharge],
      ["Tax", order.tax],
      ["Discount", -order.discount],
      ["Order total", order.totalAmount],
    ]) {
      doc
        .fontSize(label === "Order total" ? 13 : 10)
        .text(label, 315, y, { width: 120 });
      doc.text(money(amount), 440, y, { width: 98, align: "right" });
      y += 26;
    }
    if (order.refund?.status && order.refund.status !== "none") {
      doc
        .fontSize(10)
        .text(
          `Refund: ${order.refund.status} | ${money(order.refund.amount)}`,
          48,
          y + 10,
          { width: 500 },
        );
      y += 25;
    }
    doc
      .fontSize(9)
      .fillColor("#5d6970")
      .text(
        "Amounts are in Indian rupees. This invoice reflects the order and payment status shown above.",
        48,
        y + 20,
        { width: 500 },
      );
    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page++) {
      doc.switchToPage(page);
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .fontSize(8)
        .fillColor("#5d6970")
        .text(
          `NORTHSTAR | ${order.orderId} | Page ${page + 1} of ${range.count}`,
          48,
          805,
          { width: 500, align: "center", lineBreak: false },
        );
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  });
}
export async function getInvoice(input, admin = false) {
  const order = await findOrder(input, admin);
  return {
    filename: `invoice-${order.orderId.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
    bytes: await renderInvoice(order),
  };
}
