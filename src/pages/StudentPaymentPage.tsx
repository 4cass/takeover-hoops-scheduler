import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ArrowLeft, DollarSign, CreditCard, CalendarIcon, Edit, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PaymentReceipt } from "@/components/PaymentReceipt";

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

interface StudentPayment {
  id: string;
  student_id: string;
  payment_amount: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function StudentPaymentPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [paymentFormData, setPaymentFormData] = useState({
    payment_amount: 0,
    payment_date: new Date(),
    notes: "",
  });

  const [paymentInfoFormData, setPaymentInfoFormData] = useState({
    total_training_fee: 0,
    downpayment: 0,
    remaining_balance: 0,
  });
  const [isEditingPaymentInfo, setIsEditingPaymentInfo] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<StudentPayment | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .single();
      if (error) throw error;
      return data as Student;
    },
    enabled: !!studentId,
  });

  useEffect(() => {
    if (student) {
      // Get existing payments to calculate remaining balance
      const calculateRemainingBalance = async () => {
        const { data: existingPayments } = await supabase
          .from("student_payments")
          .select("payment_amount")
          .eq("student_id", student.id);
        
        const totalPayments = existingPayments?.reduce((sum, p) => sum + (p.payment_amount || 0), 0) || 0;
        const totalFee = student.total_training_fee || 0;
        const downpayment = student.downpayment || 0;
        const remainingBalance = Math.max(0, totalFee - downpayment - totalPayments);
        
        setPaymentInfoFormData({
          total_training_fee: totalFee,
          downpayment: downpayment,
          remaining_balance: remainingBalance,
        });
      };
      
      calculateRemainingBalance();
    }
  }, [student]);

  const { data: studentPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["student-payments", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("student_payments")
        .select("*")
        .eq("student_id", studentId)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data as StudentPayment[];
    },
    enabled: !!studentId,
  });

  const addPaymentMutation = useMutation({
    mutationFn: async (payment: typeof paymentFormData & { student_id: string }) => {
      const { data, error } = await supabase
        .from("student_payments")
        .insert([{
          student_id: payment.student_id,
          payment_amount: payment.payment_amount,
          payment_date: format(payment.payment_date, 'yyyy-MM-dd\'T\'HH:mm:ss'),
          notes: payment.notes || null,
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student-payments", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      toast.success("Payment recorded successfully");
      
      // Set the newly created payment for receipt and open receipt dialog
      setSelectedPaymentForReceipt({
        id: data.id,
        student_id: data.student_id,
        payment_amount: data.payment_amount,
        payment_date: data.payment_date,
        notes: data.notes,
        created_at: data.created_at,
        updated_at: data.updated_at,
      });
      setIsReceiptOpen(true);
      
      setPaymentFormData({
        payment_amount: 0,
        payment_date: new Date(),
        notes: "",
      });
    },
    onError: (error: any) => {
      toast.error("Failed to record payment: " + error.message);
    },
  });

  const updatePaymentInfoMutation = useMutation({
    mutationFn: async (paymentInfo: typeof paymentInfoFormData & { student_id: string }) => {
      const totalFee = paymentInfo.total_training_fee || 0;
      const downpayment = paymentInfo.downpayment || 0;
      
      // Get existing payments to calculate remaining balance
      const { data: existingPayments } = await supabase
        .from("student_payments")
        .select("payment_amount")
        .eq("student_id", paymentInfo.student_id);
      
      const totalPayments = existingPayments?.reduce((sum, p) => sum + (p.payment_amount || 0), 0) || 0;
      const remainingBalance = Math.max(0, totalFee - downpayment - totalPayments);
      
      const { data, error } = await supabase
        .from("students")
        .update({
          total_training_fee: totalFee,
          downpayment: downpayment,
          remaining_balance: remainingBalance,
        })
        .eq("id", paymentInfo.student_id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      setIsEditingPaymentInfo(false);
      toast.success("Payment information updated successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to update payment information: " + error.message);
    },
  });

  if (studentLoading) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4" style={{ borderColor: '#79e58f' }}></div>
          <p className="text-gray-600 text-xs sm:text-sm">Loading student information...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3">Student not found</h3>
          <Button onClick={() => navigate("/dashboard/students")} className="bg-accent hover:bg-[#5bc46d] text-white" style={{ backgroundColor: '#79e58f' }}>
            Back to Players
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-4 p-3 sm:p-4 md:p-6 pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard/students")}
            className="mb-4 border-2 border-accent text-accent hover:bg-accent hover:text-white"
            style={{ borderColor: '#79e58f', color: '#79e58f' }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Players
          </Button>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#242833] mb-2 tracking-tight">
            Payment Management - {student.name}
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-700">Manage payments and view payment history</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payment Information Card */}
          <Card className="border-2 border-[#242833] bg-white shadow-xl lg:col-span-1">
            <CardHeader className="border-b border-[#242833] bg-[#242833] p-3 sm:p-4 md:p-5">
              <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                <DollarSign className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" style={{ color: '#79e58f' }} />
                Payment Information
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs sm:text-sm">
                View and edit payment details
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-5">
              <form onSubmit={(e) => {
                e.preventDefault();
                if (student) {
                  updatePaymentInfoMutation.mutate({
                    ...paymentInfoFormData,
                    student_id: student.id,
                  });
                }
              }} className="space-y-4">
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label htmlFor="total_training_fee" className="text-gray-700 font-medium text-xs sm:text-sm truncate">
                    Total Training Fee
                  </Label>
                  <Input
                    id="total_training_fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentInfoFormData.total_training_fee}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      const downpayment = paymentInfoFormData.downpayment || 0;
                      setPaymentInfoFormData((prev) => ({
                        ...prev,
                        total_training_fee: value,
                        remaining_balance: Math.max(0, value - downpayment),
                      }));
                    }}
                    disabled={!isEditingPaymentInfo}
                    className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
                    style={{ borderColor: '#79e58f' }}
                  />
                </div>
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label htmlFor="downpayment" className="text-gray-700 font-medium text-xs sm:text-sm truncate">
                    Downpayment
                  </Label>
                  <Input
                    id="downpayment"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentInfoFormData.downpayment}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      const totalFee = paymentInfoFormData.total_training_fee || 0;
                      setPaymentInfoFormData((prev) => ({
                        ...prev,
                        downpayment: value,
                        remaining_balance: Math.max(0, totalFee - value),
                      }));
                    }}
                    disabled={!isEditingPaymentInfo}
                    className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
                    style={{ borderColor: '#79e58f' }}
                  />
                </div>
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label htmlFor="remaining_balance" className="text-gray-700 font-medium text-xs sm:text-sm truncate">
                    Remaining Balance
                  </Label>
                  <Input
                    id="remaining_balance"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentInfoFormData.remaining_balance}
                    readOnly
                    className="border-2 border-gray-200 rounded-lg bg-gray-50 w-full text-xs sm:text-sm"
                    style={{ borderColor: '#79e58f' }}
                  />
                </div>
                {!isEditingPaymentInfo ? (
                  <Button
                    type="button"
                    onClick={() => setIsEditingPaymentInfo(true)}
                    className="bg-accent hover:bg-[#5bc46d] text-white transition-all duration-300 w-full text-xs sm:text-sm flex items-center justify-center"
                    style={{ backgroundColor: '#79e58f' }}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex space-x-2 pt-2">
                    <Button
                      type="button"
                      onClick={() => {
                        setIsEditingPaymentInfo(false);
                        // Reset form data to original student values
                        if (student) {
                          const calculateRemainingBalance = async () => {
                            const { data: existingPayments } = await supabase
                              .from("student_payments")
                              .select("payment_amount")
                              .eq("student_id", student.id);
                            
                            const totalPayments = existingPayments?.reduce((sum, p) => sum + (p.payment_amount || 0), 0) || 0;
                            const totalFee = student.total_training_fee || 0;
                            const downpayment = student.downpayment || 0;
                            const remainingBalance = Math.max(0, totalFee - downpayment - totalPayments);
                            
                            setPaymentInfoFormData({
                              total_training_fee: totalFee,
                              downpayment: downpayment,
                              remaining_balance: remainingBalance,
                            });
                          };
                          calculateRemainingBalance();
                        }
                      }}
                      className="border-2 border-gray-300 text-white hover:bg-gray-100 hover:text-gray-700 transition-all duration-300 flex-1 text-xs sm:text-sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updatePaymentInfoMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white transition-all duration-300 flex-1 text-xs sm:text-sm"
                    >
                      {updatePaymentInfoMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Add Payment Form */}
          <Card className="border-2 border-[#242833] bg-white shadow-xl lg:col-span-2">
            <CardHeader className="border-b border-[#242833] bg-[#242833] p-3 sm:p-4 md:p-5">
              <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                <CreditCard className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" style={{ color: '#79e58f' }} />
                Add Payment
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs sm:text-sm">
                Record a new payment entry
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-5">
              <form onSubmit={(e) => {
                e.preventDefault();
                addPaymentMutation.mutate({
                  ...paymentFormData,
                  student_id: student.id,
                });
              }} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col space-y-2 min-w-0">
                    <Label htmlFor="payment_amount" className="text-gray-700 font-medium text-xs sm:text-sm truncate">
                      Payment Amount
                    </Label>
                    <Input
                      id="payment_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentFormData.payment_amount}
                      onChange={(e) => setPaymentFormData((prev) => ({ ...prev, payment_amount: parseFloat(e.target.value) || 0 }))}
                      required
                      className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                      style={{ borderColor: '#79e58f' }}
                    />
                  </div>
                  <div className="flex flex-col space-y-2 min-w-0">
                    <Label className="text-gray-700 font-medium text-xs sm:text-sm truncate">Payment Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal border-2 rounded-lg text-xs sm:text-sm",
                            !paymentFormData.payment_date && "text-muted-foreground"
                          )}
                          style={{ borderColor: '#79e58f' }}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {paymentFormData.payment_date ? format(paymentFormData.payment_date, "MM/dd/yyyy") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={paymentFormData.payment_date || undefined}
                          onSelect={(date) => setPaymentFormData((prev) => ({ ...prev, payment_date: date || new Date() }))}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label htmlFor="payment_notes" className="text-gray-700 font-medium text-xs sm:text-sm truncate">
                    Notes (Optional)
                  </Label>
                  <Input
                    id="payment_notes"
                    value={paymentFormData.notes}
                    onChange={(e) => setPaymentFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                    style={{ borderColor: '#79e58f' }}
                  />
                </div>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p className="text-xs sm:text-sm text-gray-600">
                    <span className="font-medium">Current Remaining Balance:</span> ₱{(student.remaining_balance || 0).toFixed(2)}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600">
                    <span className="font-medium">After Payment:</span> ₱{Math.max(0, (student.remaining_balance || 0) - paymentFormData.payment_amount).toFixed(2)}
                  </p>
                </div>
                <div className="flex justify-end space-x-3 pt-4 flex-wrap gap-2">
                  <Button
                    type="submit"
                    disabled={addPaymentMutation.isPending || paymentFormData.payment_amount <= 0}
                    className="bg-green-600 hover:bg-green-700 text-white transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                  >
                    {addPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Payment History */}
        <Card className="border-2 border-[#242833] bg-white shadow-xl">
          <CardHeader className="border-b border-[#242833] bg-[#242833] p-3 sm:p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                  <CreditCard className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" style={{ color: '#79e58f' }} />
                  Payment History
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs sm:text-sm">
                  All payment entries for this student
                </CardDescription>
              </div>
              {studentPayments && studentPayments.length > 0 && (
                <Button
                  onClick={() => {
                    setSelectedPaymentForReceipt(null);
                    setIsReceiptOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-5">
            {paymentsLoading ? (
              <div className="text-center py-8 sm:py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto" style={{ borderColor: '#79e58f' }}></div>
                <p className="text-gray-600 mt-2 text-xs sm:text-sm">Loading payment history...</p>
              </div>
            ) : (() => {
              // Combine downpayment with regular payments
              const allPayments: Array<{
                id: string;
                payment_amount: number;
                payment_date: string;
                notes: string | null;
                isDownpayment: boolean;
              }> = [];

              // Add downpayment if it exists
              if (student.downpayment && student.downpayment > 0) {
                allPayments.push({
                  id: 'downpayment',
                  payment_amount: student.downpayment,
                  payment_date: student.created_at || new Date().toISOString(),
                  notes: 'Initial Downpayment',
                  isDownpayment: true,
                });
              }

              // Add regular payments
              if (studentPayments && studentPayments.length > 0) {
                studentPayments.forEach(payment => {
                  allPayments.push({
                    ...payment,
                    isDownpayment: false,
                  });
                });
              }

              // Sort by date (most recent first)
              allPayments.sort((a, b) => {
                const dateA = new Date(a.payment_date).getTime();
                const dateB = new Date(b.payment_date).getTime();
                return dateB - dateA;
              });

              if (allPayments.length === 0) {
                return <p className="text-gray-600 text-xs sm:text-sm text-center py-8">No payment records found for this student.</p>;
              }

              return (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] rounded-lg border-2 border-[#242833]">
                  <thead className="bg-[#242833] text-[#efeff1]">
                    <tr>
                      <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">
                        <CalendarIcon className="w-4 h-4 inline mr-2" />Date
                      </th>
                      <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">
                        Receipt Number
                      </th>
                      <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">
                        <DollarSign className="w-4 h-4 inline mr-2" />Amount
                      </th>
                      <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Notes</th>
                      <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPayments.map((payment, index) => (
                      <tr
                        key={payment.id}
                        className={`transition-all duration-300 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"} ${payment.isDownpayment ? "bg-blue-50" : ""}`}
                      >
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm">
                          {format(new Date(payment.payment_date), "MMM dd, yyyy")}
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm font-mono">
                          {payment.isDownpayment 
                            ? `REC-${student.id.slice(0, 8).toUpperCase()}-DP`
                            : `REC-${student.id.slice(0, 8).toUpperCase()}-${payment.id.slice(0, 8).toUpperCase()}`
                          }
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm font-medium">
                          ₱{payment.payment_amount.toFixed(2)}
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm">
                          <span className="truncate block max-w-[200px]" title={payment.notes || 'N/A'}>
                            {payment.notes || 'N/A'}
                          </span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                          <Button
                            size="sm"
                            onClick={() => {
                              if (payment.isDownpayment) {
                                // For downpayment, create a payment object to show in receipt
                                setSelectedPaymentForReceipt({
                                  id: 'downpayment',
                                  student_id: student.id,
                                  payment_amount: payment.payment_amount,
                                  payment_date: payment.payment_date,
                                  notes: 'Initial Downpayment',
                                  created_at: payment.payment_date,
                                  updated_at: payment.payment_date,
                                });
                              } else {
                                const regularPayment = studentPayments?.find(p => p.id === payment.id);
                                if (regularPayment) {
                                  setSelectedPaymentForReceipt(regularPayment);
                                }
                              }
                              setIsReceiptOpen(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm transition-all duration-300"
                          >
                            <Printer className="w-3 h-3 sm:w-4 sm:h-4 mr-1 inline" />
                            <span className="hidden sm:inline">Print</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Payment Receipt Dialog */}
        {student && studentPayments && (
          <PaymentReceipt
            student={student}
            payment={selectedPaymentForReceipt ? {
              id: selectedPaymentForReceipt.id,
              payment_amount: selectedPaymentForReceipt.payment_amount,
              payment_date: selectedPaymentForReceipt.payment_date,
              notes: selectedPaymentForReceipt.notes,
              isDownpayment: selectedPaymentForReceipt.id === 'downpayment',
            } : null}
            allPayments={selectedPaymentForReceipt === null && isReceiptOpen ? studentPayments.map(p => ({
              id: p.id,
              payment_amount: p.payment_amount,
              payment_date: p.payment_date,
              notes: p.notes,
            })) : undefined}
            isOpen={isReceiptOpen}
            onClose={() => {
              setIsReceiptOpen(false);
              setSelectedPaymentForReceipt(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

