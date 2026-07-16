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
}

export function generateReceipt(input: ReceiptInput) {
  // A5 portrait
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const w = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(input.shopName, w / 2, 15, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Sales Receipt / Risiti", w / 2, 21, { align: "center" });

  doc.setDrawColor(180);
  doc.line(10, 25, w - 10, 25);

  doc.setFontSize(9);
  doc.text(`Receipt #: ${input.saleId.slice(0, 8).toUpperCase()}`, 10, 32);
  doc.text(`Date: ${formatDateTime(input.date)}`, 10, 37);
  if (input.cashier) doc.text(`Cashier: ${input.cashier}`, 10, 42);
  if (input.customerName) doc.text(`Customer: ${input.customerName}`, w - 10, 32, { align: "right" });
  if (input.customerPhone) doc.text(`Phone: ${input.customerPhone}`, w - 10, 37, { align: "right" });
  doc.text(`Payment: ${input.paymentType}`, w - 10, 42, { align: "right" });

  autoTable(doc, {
    startY: 48,
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
    headStyles: { fillColor: [30, 100, 100] },
    margin: { left: 10, right: 10 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let y = (doc as any).lastAutoTable.finalY + 6;
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

  doc.save(`receipt-${input.saleId.slice(0, 8)}.pdf`);
}
