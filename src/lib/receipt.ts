import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatTZS, formatDateTime } from "./format";

export interface ReceiptInput {
  shopName: string;
  saleId: string;
  date: string;
  cashier?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  itemLabel: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  paymentType: string;
  warrantyMonths?: number | null;
  imei?: string | null;
}

export function generateReceipt(input: ReceiptInput): string {
  const doc = new jsPDF({ unit: "mm", format: "a5", compress: true });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // ─── Background ──────────────────────────────────────────────
  doc.setFillColor(245, 245, 250);
  doc.rect(0, 0, w, h, "F");

  // ─── Header with pink gradient ──────────────────────────────
  doc.setFillColor(236, 72, 153);
  doc.rect(0, 0, w, 30, "F");
  doc.setFillColor(244, 63, 94);
  doc.rect(0, 0, w, 15, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(input.shopName, w / 2, 12, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Sales Receipt", w / 2, 22, { align: "center" });

  // ─── White card ──────────────────────────────────────────────
  const cardX = 8;
  const cardY = 32;
  const cardW = w - 16;
  doc.setFillColor(255, 255, 255, 0.85);
  doc.roundedRect(cardX, cardY, cardW, h - cardY - 8, 4, 4, "F");
  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.5);
  doc.roundedRect(cardX, cardY, cardW, h - cardY - 8, 4, 4, "S");

  // ─── Content ─────────────────────────────────────────────────
  let y = cardY + 8;
  const x = cardX + 8;
  const rightX = cardX + cardW - 8;

  doc.setTextColor(50, 50, 70);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.text(`Receipt #: ${input.saleId.slice(0, 8).toUpperCase()}`, x, y);
  doc.text(`Date: ${formatDateTime(input.date)}`, x, y + 5);

  if (input.cashier) {
    doc.text(`Cashier: ${input.cashier}`, x, y + 10);
    y += 10;
  } else {
    y += 5;
  }

  if (input.customerName) {
    doc.text(`Customer: ${input.customerName}`, rightX, y, { align: "right" });
    if (input.customerPhone) {
      doc.text(`Phone: ${input.customerPhone}`, rightX, y + 5, { align: "right" });
      y += 5;
    }
    y += 5;
  }
  if (input.customerPhone && !input.customerName) {
    doc.text(`Phone: ${input.customerPhone}`, rightX, y, { align: "right" });
    y += 5;
  }
  y += 2;

  // ─── Item table ──────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    head: [["Item", "Qty", "Unit", "Total"]],
    body: [
      [
        input.itemLabel,
        String(input.quantity),
        formatTZS(input.unitPrice),
        formatTZS(input.unitPrice * input.quantity),
      ],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: {
      fillColor: [236, 72, 153],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 240, 245] },
    margin: { left: cardX + 4, right: cardX + 4 },
  });

  const lastY = (doc as any).lastAutoTable.finalY;
  y = lastY + 6;

  // ─── IMEI ─────────────────────────────────────────────────────
  if (input.imei) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(236, 72, 153);
    doc.text(`IMEI: ${input.imei}`, x, y);
    y += 6;
  }

  // ─── Totals ──────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 70);
  const startTotalY = y;
  doc.text(`Subtotal: ${formatTZS(input.unitPrice * input.quantity)}`, rightX, startTotalY, { align: "right" });
  doc.text(`Discount: ${formatTZS(input.discount)}`, rightX, startTotalY + 5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(236, 72, 153);
  doc.text(`TOTAL: ${formatTZS(input.total)}`, rightX, startTotalY + 12, { align: "right" });

  y = startTotalY + 18;

  // ─── Payment & warranty ──────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 100);
  doc.text(`Payment: ${input.paymentType}`, x, y);

  if (input.warrantyMonths && input.warrantyMonths > 0) {
    y += 6;
    doc.text(`Warranty: ${input.warrantyMonths} month(s)`, x, y);
  }

  // ─── Footer ──────────────────────────────────────────────────
  y = cardY + cardW - 10;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 170);
  doc.text("Thank you for your business!", w / 2, y, { align: "center" });

  // ─── Return data URI ────────────────────────────────────────
  return doc.output("datauristring");
}
