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
  imei?: string | null; // New optional field
}

export function generateReceipt(input: ReceiptInput) {
  // A5 portrait
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const w = doc.internal.pageSize.getWidth();
  const pink = [236, 72, 153]; // pink-500
  const rose = [225, 29, 72]; // rose-500
  const lightPink = [252, 231, 243]; // pink-100

  // Header with pink gradient-like effect
  doc.setFillColor(pink[0], pink[1], pink[2]);
  doc.rect(0, 0, w, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(input.shopName, w / 2, 14, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Sales Receipt / Risiti", w / 2, 21, { align: "center" });

  // Reset text color for the rest
  doc.setTextColor(0, 0, 0);

  // Receipt details
  doc.setFontSize(9);
  let y = 32;
  doc.text(`Receipt #: ${input.saleId.slice(0, 8).toUpperCase()}`, 10, y);
  y += 5;
  doc.text(`Date: ${formatDateTime(input.date)}`, 10, y);
  y += 5;
  if (input.cashier) {
    doc.text(`Cashier: ${input.cashier}`, 10, y);
    y += 5;
  }
  if (input.customerName) {
    doc.text(`Customer: ${input.customerName}`, w - 10, 32, { align: "right" });
    if (input.customerPhone) {
      doc.text(`Phone: ${input.customerPhone}`, w - 10, 37, { align: "right" });
    }
  }
  doc.text(`Payment: ${input.paymentType}`, w - 10, 42, { align: "right" });

  // IM
  if (input.imei) {
    doc.setFont("helvetica", "bold");
    doc.text(`IMEI: ${input.imei}`, 10, y + 4);
    doc.setFont("helvetica", "normal");
    y += 8;
  }

  // Table
  autoTable(doc, {
    startY: Math.max(y + 2, 48),
    head: [["Item", "Qty", "Unit", "Total"]],
    body: [
      [
        input.itemLabel,
        String(input.quantity),
        formatTZS(input.unitPrice),
        formatTZS(input.unitPrice * input.quantity),
      ],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: pink, textColor: [255, 255, 255] },
    margin: { left: 10, right: 10 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;
  const right = w - 10;
  doc.setFontSize(10);
  doc.text(`Subtotal: ${formatTZS(input.unitPrice * input.quantity)}`, right, y, { align: "right" });
  y += 5;
  doc.text(`Discount: ${formatTZS(input.discount)}`, right, y, { align: "right" });
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`TOTAL: ${formatTZS(input.total)}`, right, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  if (input.warrantyMonths && input.warrantyMonths > 0) {
    y += 8;
    doc.text(`Warranty: ${input.warrantyMonths} month(s)`, 10, y);
  }

  y += 12;
  doc.setFontSize(9);
  doc.text("Thank you / Asante sana!", w / 2, y, { align: "center" });

  // Instead of auto-download, return the PDF blob URL for user action
  const pdfBlob = doc.output("blob");
  const url = URL.createObjectURL(pdfBlob);
  return url;
}
