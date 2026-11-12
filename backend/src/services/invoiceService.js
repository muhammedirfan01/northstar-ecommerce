// Build the PDF invoice for an order.

import { STORE } from "../constants/store.js";
import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import { findOrder } from "./customerOrderService.js";

const formatMoney = (value) => `INR ${(value / 100).toFixed(2)}`;
// Write the order details into a PDF and return the finished file.
export function createInvoicePdf(order) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "A4",
      margin: 48,
      bufferPages: true,
      info: {
        Title: `${STORE.storeName} invoice ${order.orderId}`,
        Author: STORE.storeName,
      },
    });
    const pdfParts = [];
    pdf.on("data", (chunk) => pdfParts.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(pdfParts)));
    pdf.on("error", reject);
    const font = [
      process.env.INVOICE_FONT_PATH,
      "C:/Windows/Fonts/Nirmala.ttc",
      "C:/Windows/Fonts/arial.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ].find((path) => path && existsSync(path));
    if (font)
      pdf.font(font, font.endsWith("Nirmala.ttc") ? "NirmalaUI" : undefined);
    pdf.rect(0, 0, 596, 88).fill("#142d39");
    pdf
      .fillColor("#ffffff")
      .fontSize(23)
      .text(STORE.storeName, 48, 27, {
        width: 340,
        height: 40,
        ellipsis: true,
      });
    pdf
      .fontSize(11)
      .text("ORDER INVOICE", 405, 36, { width: 140, align: "right" });
    pdf.fillColor("#17252c").fontSize(11);
    pdf.text(`Order: ${order.orderId}`, 48, 114, { width: 500 });
    pdf.text(
      `Placed: ${new Date(order.createdAt).toISOString().slice(0, 10)}`,
      48,
      137,
    );
    pdf.text(
      `Order status: ${order.orderStatus} | Payment: ${order.paymentStatus} (${order.paymentMethod})`,
      48,
      157,
      { width: 500 },
    );
    const deliveryAddress = order.shippingAddress;
    const address = [
      deliveryAddress.name,
      deliveryAddress.addressLine1,
      deliveryAddress.addressLine2,
      `${deliveryAddress.city}, ${deliveryAddress.state} ${deliveryAddress.pincode}`,
      deliveryAddress.phone,
    ]
      .filter(Boolean)
      .join("\n");
    pdf.fontSize(12).text("DELIVERY ADDRESS", 48, 195);
    pdf.fontSize(10).text(address, 48, 218, { width: 350 });
    let verticalPosition = Math.max(320, pdf.y + 25);
    const contact = [STORE.invoiceAddress, STORE.supportEmail, STORE.supportPhone]
      .filter(Boolean)
      .join(" | ");
    if (contact) {
      pdf.fontSize(9).text(contact, 48, verticalPosition, { width: 500 });
      verticalPosition = pdf.y + 20;
    }
    const drawTableHeading = () => {
      pdf.rect(48, verticalPosition, 500, 26).fill("#eef2f3");
      pdf.fillColor("#17252c").fontSize(10);
      pdf.text("PRODUCT", 58, verticalPosition + 7, { width: 245 });
      pdf.text("QTY", 304, verticalPosition + 7, { width: 30 });
      pdf.text("UNIT PRICE", 346, verticalPosition + 7, { width: 92, align: "right" });
      pdf.text("ITEM TOTAL", 446, verticalPosition + 7, { width: 92, align: "right" });
      verticalPosition += 36;
    };
    drawTableHeading();
    for (const item of order.items) {
      const name = `${item.productName}${item.variantName ? ` / ${item.variantName}` : ""}`;
      const height = Math.max(
        34,
        pdf.fontSize(10).heightOfString(name, { width: 235 }) + 16,
      );
      if (verticalPosition + height > 740) {
        pdf.addPage();
        verticalPosition = 48;
        drawTableHeading();
      }
      pdf.fillColor("#17252c").text(name, 58, verticalPosition, { width: 235 });
      pdf.text(String(item.quantity), 304, verticalPosition, { width: 30 });
      pdf.text(formatMoney(item.unitPricePaise), 340, verticalPosition, {
        width: 98,
        align: "right",
      });
      pdf.text(formatMoney(item.lineTotalPaise), 440, verticalPosition, {
        width: 98,
        align: "right",
      });
      verticalPosition += height;
      pdf
        .moveTo(48, verticalPosition - 8)
        .lineTo(548, verticalPosition - 8)
        .strokeColor("#e4e7e8")
        .stroke();
    }
    if (verticalPosition + 205 > 755) {
      pdf.addPage();
      verticalPosition = 48;
    }
    for (const [label, amount] of [
      ["Subtotal", order.subtotal],
      ["Shipping", order.shippingCharge],
      ["Tax", order.tax],
      ["Discount", -order.discount],
      ["Order total", order.totalAmount],
    ]) {
      pdf
        .fontSize(label === "Order total" ? 13 : 10)
        .text(label, 315, verticalPosition, { width: 120 });
      pdf.text(formatMoney(amount), 440, verticalPosition, { width: 98, align: "right" });
      verticalPosition += 26;
    }
    if (order.refund?.status && order.refund.status !== "none") {
      pdf
        .fontSize(10)
        .text(
          `Refund: ${order.refund.status} | ${formatMoney(order.refund.amount)}`,
          48,
          verticalPosition + 10,
          { width: 500 },
        );
      verticalPosition += 25;
    }
    pdf
      .fontSize(9)
      .fillColor("#5d6970")
      .text(
        "Amounts are in Indian rupees. This invoice reflects the order and payment status shown above.",
        48,
        verticalPosition + 20,
        { width: 500 },
      );
    const range = pdf.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page++) {
      pdf.switchToPage(page);
      const bottom = pdf.page.margins.bottom;
      pdf.page.margins.bottom = 0;
      pdf
        .fontSize(8)
        .fillColor("#5d6970")
        .text(
          `${STORE.storeName} | ${order.orderId} | Page ${page + 1} of ${range.count}`,
          48,
          805,
          { width: 500, align: "center", lineBreak: false },
        );
      pdf.page.margins.bottom = bottom;
    }
    pdf.end();
  });
}
export async function getInvoice(requestData, admin = false) {
  const order = await findOrder(requestData, admin);
  return {
    filename: `invoice-${order.orderId.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
    bytes: await createInvoicePdf(order),
  };
}
