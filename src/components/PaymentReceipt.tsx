import { format } from "date-fns";
import { Printer, X, Download, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState, useRef } from "react";
import { toast } from "sonner";

interface Student {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  total_training_fee: number | null;
  downpayment: number | null;
  remaining_balance: number | null;
  created_at: string | null;
}

interface Payment {
  id: string;
  payment_amount: number;
  payment_date: string;
  notes: string | null;
  isDownpayment?: boolean;
}

interface PaymentReceiptProps {
  student: Student;
  payment: Payment | null;
  allPayments?: Payment[];
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentReceipt({ student, payment, allPayments: providedPayments, isOpen, onClose }: PaymentReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleSaveAsPDF = async () => {
    if (!receiptRef.current) return;
    
    setIsExporting(true);
    try {
      // Use browser's print dialog to save as PDF
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error("Please allow popups to save as PDF");
        setIsExporting(false);
        return;
      }

      const receiptContent = receiptRef.current.innerHTML;
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Payment Receipt - ${student.name}</title>
            <style>
              @page {
                size: A4;
                margin: 1cm;
              }
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            </style>
          </head>
          <body>
            ${receiptContent}
            <script>
              window.onload = function() {
                window.print();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (error) {
      console.error("Error saving PDF:", error);
      toast.error("Failed to save as PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveAsImage = async () => {
    if (!receiptRef.current) return;
    
    setIsExporting(true);
    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `receipt-${student.name}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error("Error saving image:", error);
      // Fallback: try to install html2canvas
      toast.error("Please install html2canvas: npm install html2canvas");
    } finally {
      setIsExporting(false);
    }
  };

  // If payment is null, show full payment history; otherwise show individual payment
  const isFullHistory = payment === null;
  
  // Combine all payments for receipt
  const allPayments: Payment[] = [];
  
  if (isFullHistory) {
    // Show all payments including downpayment
    if (student.downpayment && student.downpayment > 0) {
      allPayments.push({
        id: 'downpayment',
        payment_amount: student.downpayment,
        payment_date: student.created_at || new Date().toISOString(),
        notes: 'Initial Downpayment',
        isDownpayment: true,
      });
    }
    // Add all regular payments
    if (providedPayments) {
      providedPayments.forEach(p => {
        allPayments.push({
          ...p,
          isDownpayment: false,
        });
      });
    }
    // Sort by date (oldest first for receipt)
    allPayments.sort((a, b) => {
      const dateA = new Date(a.payment_date).getTime();
      const dateB = new Date(b.payment_date).getTime();
      return dateA - dateB;
    });
  } else {
    // Show only the selected payment
    allPayments.push(payment);
  }

  // Calculate totals
  const totalPaid = isFullHistory 
    ? allPayments.reduce((sum, p) => sum + p.payment_amount, 0)
    : allPayments.reduce((sum, p) => sum + p.payment_amount, 0);
  const totalFee = student.total_training_fee || 0;
  const remainingBalance = student.remaining_balance || 0;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:hidden">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Payment Receipt</h2>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={handlePrint}
                className="bg-accent hover:bg-[#5bc46d] text-white transition-all duration-300"
                style={{ backgroundColor: '#79e58f' }}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button
                onClick={handleSaveAsPDF}
                disabled={isExporting}
                className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300"
              >
                <FileText className="w-4 h-4 mr-2" />
                {isExporting ? "Saving..." : "Save PDF"}
              </Button>
              <Button
                onClick={handleSaveAsImage}
                disabled={isExporting}
                className="bg-green-600 hover:bg-green-700 text-white transition-all duration-300"
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                {isExporting ? "Saving..." : "Save Image"}
              </Button>
              <Button variant="outline" onClick={onClose}>
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
            </div>
          </div>
          <div id="receipt-content" ref={receiptRef}>
            <ReceiptContent
              student={student}
              payments={allPayments}
              totalPaid={totalPaid}
              totalFee={totalFee}
              remainingBalance={remainingBalance}
              isFullHistory={isFullHistory}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Print-only version */}
      <div className="hidden print:block">
        <ReceiptContent
          student={student}
          payments={allPayments}
          totalPaid={totalPaid}
          totalFee={totalFee}
          remainingBalance={remainingBalance}
          isFullHistory={isFullHistory}
        />
      </div>
    </>
  );
}

function ReceiptContent({
  student,
  payments,
  totalPaid,
  totalFee,
  remainingBalance,
  isFullHistory,
}: {
  student: Student;
  payments: Payment[];
  totalPaid: number;
  totalFee: number;
  remainingBalance: number;
  isFullHistory: boolean;
}) {
  const currentDate = format(new Date(), "MMMM dd, yyyy 'at' hh:mm a");
  const receiptNumber = `REC-${student.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;

  return (
    <div className="bg-white p-6 sm:p-8 md:p-10 print:p-8" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 1cm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .print-break {
            page-break-after: always;
          }
        }
      `}</style>

      {/* Header with Logo and Branding */}
      <div className="border-b-4 mb-6 pb-4" style={{ borderColor: '#79e58f' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <img
              src="/lovable-uploads/dcb5b3e4-1037-41ed-bf85-c78cee85066e.png"
              alt="Takeover Basketball Logo"
              className="w-20 h-20 object-contain"
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: '#242833' }}>
                Takeover Basketball
              </h1>
              <p className="text-sm text-gray-600">Official Payment Receipt</p>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Details */}
      <div className="mb-6 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-gray-600">Receipt Number:</p>
            <p className="font-semibold text-lg">{receiptNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Date Issued:</p>
            <p className="font-semibold">{currentDate}</p>
          </div>
        </div>
      </div>

      {/* Student Information */}
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#f5f5f5' }}>
        <h2 className="text-lg font-bold mb-3" style={{ color: '#242833' }}>
          Student Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-600">Name:</p>
            <p className="font-semibold">{student.name}</p>
          </div>
          {student.email && (
            <div>
              <p className="text-gray-600">Email:</p>
              <p className="font-semibold">{student.email}</p>
            </div>
          )}
          {student.phone && (
            <div>
              <p className="text-gray-600">Phone:</p>
              <p className="font-semibold">{student.phone}</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Summary */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-3" style={{ color: '#242833' }}>
          {isFullHistory ? 'Payment History' : 'Payment Details'}
        </h2>
        <div className="border-2 rounded-lg overflow-hidden" style={{ borderColor: '#79e58f' }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#242833', color: 'white' }}>
                <th className="py-3 px-4 text-left font-semibold text-sm">Date</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">Description</th>
                <th className="py-3 px-4 text-right font-semibold text-sm">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment, index) => (
                <tr
                  key={payment.id}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="py-3 px-4 text-sm">
                    {format(new Date(payment.payment_date), "MMM dd, yyyy")}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {payment.isDownpayment ? (
                      <span className="font-medium" style={{ color: '#79e58f' }}>
                        Initial Downpayment
                      </span>
                    ) : (
                      payment.notes || "Payment"
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-right font-semibold">
                    ₱{payment.payment_amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Breakdown */}
      {isFullHistory && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3" style={{ color: '#242833' }}>
            Payment Breakdown
          </h2>
          <div className="border-2 rounded-lg p-4 space-y-3" style={{ borderColor: '#79e58f', backgroundColor: '#fafafa' }}>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="font-semibold text-base">Total Training Fee:</span>
              <span className="font-bold text-base">₱{totalFee.toFixed(2)}</span>
            </div>
            
            <div className="space-y-2 pl-4 border-l-2" style={{ borderColor: '#79e58f' }}>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Less: Initial Downpayment</span>
                <span className="text-sm font-medium" style={{ color: '#79e58f' }}>
                  - ₱{(student.downpayment || 0).toFixed(2)}
                </span>
              </div>
              {payments.filter(p => !p.isDownpayment).map((payment, index) => (
                <div key={payment.id} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Less: Payment {index + 1} ({format(new Date(payment.payment_date), "MMM dd, yyyy")})
                  </span>
                  <span className="text-sm font-medium" style={{ color: '#79e58f' }}>
                    - ₱{payment.payment_amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="flex justify-between items-center py-3 border-t-2 pt-3" style={{ borderColor: '#79e58f' }}>
              <span className="font-bold text-lg">Total Paid:</span>
              <span className="font-bold text-lg" style={{ color: '#79e58f' }}>
                ₱{totalPaid.toFixed(2)}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-3 border-t-2 mt-2" style={{ borderColor: '#242833' }}>
              <span className="font-bold text-xl">Remaining Balance:</span>
              <span className="font-bold text-xl" style={{ color: '#242833' }}>
                ₱{remainingBalance.toFixed(2)}
              </span>
            </div>
            
            <div className="mt-3 pt-3 border-t text-xs text-gray-500 italic">
              Calculation: ₱{totalFee.toFixed(2)} (Total Fee) - ₱{totalPaid.toFixed(2)} (Total Paid) = ₱{remainingBalance.toFixed(2)} (Remaining)
            </div>
          </div>
        </div>
      )}
      {!isFullHistory && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3" style={{ color: '#242833' }}>
            Payment Summary
          </h2>
          <div className="border-2 rounded-lg p-4 space-y-3" style={{ borderColor: '#79e58f', backgroundColor: '#fafafa' }}>
            <div className="flex justify-between items-center py-2">
              <span className="font-semibold text-base">Total Training Fee:</span>
              <span className="font-bold text-base">₱{totalFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-t" style={{ borderColor: '#79e58f' }}>
              <span className="font-semibold text-base">This Payment:</span>
              <span className="font-bold text-base" style={{ color: '#79e58f' }}>
                ₱{totalPaid.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-t-2 mt-2" style={{ borderColor: '#242833' }}>
              <span className="font-bold text-lg">Remaining Balance:</span>
              <span className="font-bold text-lg" style={{ color: '#242833' }}>
                ₱{remainingBalance.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-6 border-t-2 text-center text-sm text-gray-600" style={{ borderColor: '#79e58f' }}>
        <p className="font-semibold mb-2" style={{ color: '#242833' }}>
          Thank you for your payment!
        </p>
        <p>This is an official receipt from Takeover Basketball.</p>
        <p className="mt-2">For inquiries, please contact us through your registered email.</p>
      </div>
    </div>
  );
}

