import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, DollarSign, CreditCard, CalendarIcon, Edit, Printer, Plus, Eye, Receipt, AlertCircle, Trash2, Wallet, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PaymentReceipt } from "@/components/PaymentReceipt";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  extra_charges: number | null;
  charge_description: string | null;
  payment_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  payment_for: string;
  charge_id: string | null;
}

interface StudentCharge {
  id: string;
  student_id: string;
  amount: number;
  charge_type: string;
  description: string | null;
  notes: string | null;
  charge_date: string;
  created_at: string;
  updated_at: string;
  is_paid: boolean;
  paid_at: string | null;
  paid_amount: number;
}

export default function StudentPaymentPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("payments");
  const [paymentFormData, setPaymentFormData] = useState({
    payment_amount: 0,
    payment_type: "balance" as "balance" | "extra_charge",
    selected_charge_id: "" as string,
    payment_date: new Date(),
    notes: "",
  });

  const [chargeFormData, setChargeFormData] = useState({
    amount: 0,
    description: "",
    charge_date: new Date(),
  });

  const [paymentInfoFormData, setPaymentInfoFormData] = useState({
    total_training_fee: 0,
    downpayment: 0,
    remaining_balance: 0,
  });
  const [isEditingPaymentInfo, setIsEditingPaymentInfo] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<StudentPayment | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  
  // Modal states
  const [isAddChargeOpen, setIsAddChargeOpen] = useState(false);
  const [isViewPaymentOpen, setIsViewPaymentOpen] = useState(false);
  const [selectedPaymentForView, setSelectedPaymentForView] = useState<StudentPayment | null>(null);
  const [isViewChargeOpen, setIsViewChargeOpen] = useState(false);
  const [selectedChargeForView, setSelectedChargeForView] = useState<StudentCharge | null>(null);
  const [isDeleteChargeOpen, setIsDeleteChargeOpen] = useState(false);
  const [chargeToDelete, setChargeToDelete] = useState<StudentCharge | null>(null);

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

  const { data: studentCharges, isLoading: chargesLoading } = useQuery({
    queryKey: ["student-charges", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("student_charges")
        .select("*")
        .eq("student_id", studentId)
        .order("charge_date", { ascending: false });
      if (error) throw error;
      return data as StudentCharge[];
    },
    enabled: !!studentId,
  });

  useEffect(() => {
    if (student) {
      const calculateRemainingBalance = async () => {
        const { data: existingPayments } = await supabase
          .from("student_payments")
          .select("payment_amount")
          .eq("student_id", student.id);
        
        const { data: existingCharges } = await supabase
          .from("student_charges")
          .select("amount")
          .eq("student_id", student.id);
        
        const totalPayments = existingPayments?.reduce((sum, p) => sum + (p.payment_amount || 0), 0) || 0;
        const totalCharges = existingCharges?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
        const totalFee = student.total_training_fee || 0;
        const downpayment = student.downpayment || 0;
        const remainingBalance = Math.max(0, totalFee - downpayment - totalPayments + totalCharges);
        
        setPaymentInfoFormData({
          total_training_fee: totalFee,
          downpayment: downpayment,
          remaining_balance: remainingBalance,
        });
      };
      
      calculateRemainingBalance();
    }
  }, [student, studentCharges]);

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
          notes: payment.notes?.trim() || null,
          payment_for: payment.payment_type,
          charge_id: payment.payment_type === "extra_charge" && payment.selected_charge_id ? payment.selected_charge_id : null,
        }])
        .select()
        .single();
      if (error) throw error;
      
      // If paying for a specific charge, update the charge status
      if (payment.payment_type === "extra_charge" && payment.selected_charge_id) {
        const charge = studentCharges?.find(c => c.id === payment.selected_charge_id);
        if (charge) {
          const newPaidAmount = (charge.paid_amount || 0) + payment.payment_amount;
          const isPaid = newPaidAmount >= charge.amount;
          
          await supabase
            .from("student_charges")
            .update({
              paid_amount: newPaidAmount,
              is_paid: isPaid,
              paid_at: isPaid ? new Date().toISOString() : null,
            })
            .eq("id", payment.selected_charge_id);
        }
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student-payments", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student-charges", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      toast.success("Payment recorded successfully");
      
      setSelectedPaymentForReceipt({
        id: data.id,
        student_id: data.student_id,
        payment_amount: data.payment_amount,
        extra_charges: data.extra_charges,
        charge_description: data.charge_description,
        payment_date: data.payment_date,
        notes: data.notes,
        created_at: data.created_at,
        updated_at: data.updated_at,
        payment_for: data.payment_for,
        charge_id: data.charge_id,
      });
      setIsReceiptOpen(true);
      
      setPaymentFormData({
        payment_amount: 0,
        payment_type: "balance",
        selected_charge_id: "",
        payment_date: new Date(),
        notes: "",
      });
    },
    onError: (error: Error) => {
      toast.error("Failed to record payment: " + error.message);
    },
  });

  const addChargeMutation = useMutation({
    mutationFn: async (charge: typeof chargeFormData & { student_id: string }) => {
      const { data, error } = await supabase
        .from("student_charges")
        .insert([{
          student_id: charge.student_id,
          amount: charge.amount,
          charge_type: "extra_charge",
          description: charge.description || null,
          charge_date: format(charge.charge_date, 'yyyy-MM-dd\'T\'HH:mm:ss'),
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student-charges", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      toast.success("Charge added successfully - Balance updated");
      setIsAddChargeOpen(false);
      setChargeFormData({
        amount: 0,
        description: "",
        charge_date: new Date(),
      });
    },
    onError: (error: Error) => {
      toast.error("Failed to add charge: " + error.message);
    },
  });

  const deleteChargeMutation = useMutation({
    mutationFn: async (chargeId: string) => {
      const { error } = await supabase
        .from("student_charges")
        .delete()
        .eq("id", chargeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student-charges", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      toast.success("Charge deleted - Balance updated");
      setIsDeleteChargeOpen(false);
      setChargeToDelete(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to delete charge: " + error.message);
    },
  });

  const updatePaymentInfoMutation = useMutation({
    mutationFn: async (paymentInfo: typeof paymentInfoFormData & { student_id: string }) => {
      const totalFee = paymentInfo.total_training_fee || 0;
      const downpayment = paymentInfo.downpayment || 0;
      
      const { data: existingPayments } = await supabase
        .from("student_payments")
        .select("payment_amount")
        .eq("student_id", paymentInfo.student_id);
      
      const { data: existingCharges } = await supabase
        .from("student_charges")
        .select("amount")
        .eq("student_id", paymentInfo.student_id);
      
      const totalPayments = existingPayments?.reduce((sum, p) => sum + (p.payment_amount || 0), 0) || 0;
      const totalCharges = existingCharges?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
      const remainingBalance = Math.max(0, totalFee - downpayment - totalPayments + totalCharges);
      
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
    onError: (error: Error) => {
      toast.error("Failed to update payment information: " + error.message);
    },
  });

  const totalCharges = studentCharges?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

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
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-3">Student not found</h3>
          <Button onClick={() => navigate("/dashboard/students")} className="bg-accent hover:bg-accent/80 text-accent-foreground">
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
            className="mb-4 border-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Players
          </Button>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 tracking-tight">
            Payment Management - {student.name}
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground">Manage payments, charges, and view balance history</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payment Information Card */}
          <Card className="border-2 border-border bg-card shadow-xl lg:col-span-1">
            <CardHeader className="border-b border-border bg-[#242833] p-3 sm:p-4 md:p-5">
              <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                <DollarSign className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" />
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
                  <Label htmlFor="total_training_fee" className="text-muted-foreground font-medium text-xs sm:text-sm truncate">
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
                        remaining_balance: Math.max(0, value - downpayment + totalCharges),
                      }));
                    }}
                    disabled={!isEditingPaymentInfo}
                    className="border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm disabled:bg-muted disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label htmlFor="downpayment" className="text-muted-foreground font-medium text-xs sm:text-sm truncate">
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
                        remaining_balance: Math.max(0, totalFee - value + totalCharges),
                      }));
                    }}
                    disabled={!isEditingPaymentInfo}
                    className="border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm disabled:bg-muted disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label htmlFor="remaining_balance" className="text-muted-foreground font-medium text-xs sm:text-sm truncate">
                    Remaining Balance
                  </Label>
                  <Input
                    id="remaining_balance"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentInfoFormData.remaining_balance}
                    readOnly
                    className="border-2 border-accent rounded-lg bg-muted w-full text-xs sm:text-sm"
                  />
                </div>
                {totalCharges > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Extra Charges: ₱{totalCharges.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                {!isEditingPaymentInfo ? (
                  <Button
                    type="button"
                    onClick={() => setIsEditingPaymentInfo(true)}
                    className="bg-accent hover:bg-accent/80 text-accent-foreground transition-all duration-300 w-full text-xs sm:text-sm flex items-center justify-center"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex space-x-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditingPaymentInfo(false);
                        if (student) {
                          const calculateRemainingBalance = async () => {
                            const { data: existingPayments } = await supabase
                              .from("student_payments")
                              .select("payment_amount")
                              .eq("student_id", student.id);
                            
                            const { data: existingCharges } = await supabase
                              .from("student_charges")
                              .select("amount")
                              .eq("student_id", student.id);
                            
                            const totalPayments = existingPayments?.reduce((sum, p) => sum + (p.payment_amount || 0), 0) || 0;
                            const totalChargesAmount = existingCharges?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
                            const totalFee = student.total_training_fee || 0;
                            const downpayment = student.downpayment || 0;
                            const remainingBalance = Math.max(0, totalFee - downpayment - totalPayments + totalChargesAmount);
                            
                            setPaymentInfoFormData({
                              total_training_fee: totalFee,
                              downpayment: downpayment,
                              remaining_balance: remainingBalance,
                            });
                          };
                          calculateRemainingBalance();
                        }
                      }}
                      className="flex-1 text-xs sm:text-sm"
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

          {/* Tabs Section */}
          <Card className="border-2 border-border bg-card shadow-xl lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <CardHeader className="border-b border-border bg-[#242833] p-3 sm:p-4 md:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
              <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                      <CreditCard className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" />
                      Financial Management
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs sm:text-sm">
                      Manage payments and extra charges
              </CardDescription>
                  </div>
                  <TabsList className="bg-[#1a1d24]">
                    <TabsTrigger value="payments" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                      Payments
                    </TabsTrigger>
                    <TabsTrigger value="charges" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                      Extra Charges
                    </TabsTrigger>
                  </TabsList>
                </div>
            </CardHeader>
              
            <CardContent className="p-3 sm:p-4 md:p-5">
                <TabsContent value="payments" className="mt-0">
                  {/* Add Payment Form */}
              <form onSubmit={(e) => {
                e.preventDefault();
                    // Validate extra charge selection
                    if (paymentFormData.payment_type === "extra_charge" && !paymentFormData.selected_charge_id) {
                      toast.error("Please select an extra charge to pay");
                      return;
                    }
                addPaymentMutation.mutate({
                  ...paymentFormData,
                  student_id: student.id,
                });
                  }} className="space-y-4 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col space-y-2 min-w-0">
                        <Label htmlFor="payment_type" className="text-muted-foreground font-medium text-xs sm:text-sm truncate">
                          Payment For
                        </Label>
                        <Select
                          value={paymentFormData.payment_type}
                          onValueChange={(value: "balance" | "extra_charge") => setPaymentFormData((prev) => ({ 
                            ...prev, 
                            payment_type: value,
                            selected_charge_id: "",
                            payment_amount: 0
                          }))}
                        >
                          <SelectTrigger className="border-2 border-accent rounded-lg text-xs sm:text-sm">
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="balance">
                              <div className="flex items-center gap-2">
                                <Wallet className="w-4 h-4 text-green-600" />
                                <span>Training Balance</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="extra_charge">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-amber-600" />
                                <span>Specific Extra Charge</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Show charge selector when paying for extra charge */}
                      {paymentFormData.payment_type === "extra_charge" ? (
                        <div className="flex flex-col space-y-2 min-w-0">
                          <Label className="text-muted-foreground font-medium text-xs sm:text-sm truncate">
                            Select Charge to Pay
                          </Label>
                          {studentCharges && studentCharges.filter(c => !c.is_paid).length > 0 ? (
                            <Select
                              value={paymentFormData.selected_charge_id}
                              onValueChange={(value) => {
                                const charge = studentCharges?.find(c => c.id === value);
                                const remainingToPay = charge ? (charge.amount - (charge.paid_amount || 0)) : 0;
                                setPaymentFormData((prev) => ({ 
                                  ...prev, 
                                  selected_charge_id: value,
                                  payment_amount: remainingToPay
                                }));
                              }}
                            >
                              <SelectTrigger className="border-2 border-amber-400 rounded-lg text-xs sm:text-sm">
                                <SelectValue placeholder="Select a charge" />
                              </SelectTrigger>
                              <SelectContent>
                                {studentCharges.filter(c => !c.is_paid).map((charge) => (
                                  <SelectItem key={charge.id} value={charge.id}>
                                    <div className="flex items-center justify-between gap-4">
                                      <span>{charge.description || 'Extra Charge'}</span>
                                      <span className="text-amber-600 font-medium">
                                        ₱{(charge.amount - (charge.paid_amount || 0)).toFixed(2)}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="p-3 rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                              <p className="text-sm text-amber-700 dark:text-amber-400 text-center">
                                No unpaid charges available
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col space-y-2 min-w-0">
                          <Label htmlFor="payment_amount" className="text-muted-foreground font-medium text-xs sm:text-sm truncate">
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
                            className="border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                    />
                  </div>
                      )}
                    </div>
                    
                    {/* Payment Amount for Extra Charge */}
                    {paymentFormData.payment_type === "extra_charge" && paymentFormData.selected_charge_id && (
                  <div className="flex flex-col space-y-2 min-w-0">
                        <Label htmlFor="payment_amount" className="text-muted-foreground font-medium text-xs sm:text-sm truncate">
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
                          className="border-2 border-amber-400 rounded-lg focus:border-amber-500 focus:ring-amber-500/20 w-full text-xs sm:text-sm"
                        />
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col space-y-2 min-w-0">
                        <Label className="text-muted-foreground font-medium text-xs sm:text-sm truncate">Payment Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                                "w-full justify-start text-left font-normal border-2 border-accent rounded-lg text-xs sm:text-sm",
                            !paymentFormData.payment_date && "text-muted-foreground"
                          )}
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
                  <div className="flex flex-col space-y-2 min-w-0">
                        <Label htmlFor="payment_notes" className="text-muted-foreground font-medium text-xs sm:text-sm truncate">
                      Notes (Optional)
                    </Label>
                    <Input
                      id="payment_notes"
                      value={paymentFormData.notes}
                      onChange={(e) => setPaymentFormData((prev) => ({ ...prev, notes: e.target.value }))}
                          placeholder="Additional notes..."
                          className="border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                    />
                  </div>
                </div>
                    
                    {/* Payment Preview - Enhanced */}
                    <div className={cn(
                      "p-4 rounded-lg border-2",
                      paymentFormData.payment_type === "extra_charge" 
                        ? "bg-amber-50 border-amber-300 dark:bg-amber-950/20 dark:border-amber-700" 
                        : "bg-green-50 border-green-300 dark:bg-green-950/20 dark:border-green-700"
                    )}>
                      <div className="flex items-center gap-2 mb-3">
                        {paymentFormData.payment_type === "extra_charge" ? (
                          <FileText className="w-5 h-5 text-amber-600" />
                        ) : (
                          <Wallet className="w-5 h-5 text-green-600" />
                        )}
                        <span className={cn(
                          "font-semibold text-sm",
                          paymentFormData.payment_type === "extra_charge" ? "text-amber-700" : "text-green-700"
                        )}>
                          {paymentFormData.payment_type === "extra_charge" 
                            ? `Paying for: ${studentCharges?.find(c => c.id === paymentFormData.selected_charge_id)?.description || 'Extra Charge'}` 
                            : 'Paying for Training Balance'}
                        </span>
                </div>
                      
                      {paymentFormData.payment_type === "balance" && (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Current Balance:</span>
                            <span className="font-medium">₱{paymentInfoFormData.remaining_balance.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-green-600">
                            <span>Payment Amount:</span>
                            <span className="font-medium">- ₱{paymentFormData.payment_amount.toFixed(2)}</span>
                          </div>
                          <div className="border-t border-green-300 dark:border-green-700 pt-2 mt-2">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-green-700">After Payment:</span>
                              <span className="font-bold text-lg text-green-700">
                                ₱{Math.max(0, paymentInfoFormData.remaining_balance - paymentFormData.payment_amount).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {paymentFormData.payment_type === "extra_charge" && paymentFormData.selected_charge_id && (
                        <div className="space-y-2 text-sm">
                          {(() => {
                            const selectedCharge = studentCharges?.find(c => c.id === paymentFormData.selected_charge_id);
                            const chargeAmount = selectedCharge?.amount || 0;
                            const paidAmount = selectedCharge?.paid_amount || 0;
                            const remainingCharge = chargeAmount - paidAmount;
                            const afterPayment = Math.max(0, remainingCharge - paymentFormData.payment_amount);
                            
                            return (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Charge Amount:</span>
                                  <span className="font-medium">₱{chargeAmount.toFixed(2)}</span>
                                </div>
                                {paidAmount > 0 && (
                                  <div className="flex justify-between items-center text-green-600">
                                    <span>Already Paid:</span>
                                    <span className="font-medium">- ₱{paidAmount.toFixed(2)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Remaining to Pay:</span>
                                  <span className="font-medium text-amber-600">₱{remainingCharge.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-amber-600">
                                  <span>This Payment:</span>
                                  <span className="font-medium">- ₱{paymentFormData.payment_amount.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-amber-300 dark:border-amber-700 pt-2 mt-2">
                                  <div className="flex justify-between items-center">
                                    <span className="font-semibold text-amber-700">After Payment:</span>
                                    <span className={cn(
                                      "font-bold text-lg",
                                      afterPayment === 0 ? "text-green-600" : "text-amber-700"
                                    )}>
                                      {afterPayment === 0 ? "FULLY PAID ✓" : `₱${afterPayment.toFixed(2)}`}
                                    </span>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-end">
                  <Button
                    type="submit"
                        disabled={addPaymentMutation.isPending || paymentFormData.payment_amount <= 0 || (paymentFormData.payment_type === "extra_charge" && !paymentFormData.selected_charge_id)}
                        className={cn(
                          "transition-all duration-300 text-xs sm:text-sm",
                          paymentFormData.payment_type === "extra_charge" 
                            ? "bg-amber-600 hover:bg-amber-700 text-white" 
                            : "bg-green-600 hover:bg-green-700 text-white"
                        )}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                    {addPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                  </Button>
                </div>
              </form>

                </TabsContent>

                <TabsContent value="charges" className="mt-0">
                  <div className="flex justify-end mb-4">
                    <Button
                      onClick={() => setIsAddChargeOpen(true)}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Extra Charge
                    </Button>
                  </div>

                  {chargesLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent mx-auto" />
                      <p className="text-muted-foreground mt-3 text-sm">Loading charges…</p>
                    </div>
                  ) : studentCharges && studentCharges.length > 0 ? (
                    <>
                      {/* Desktop: compact responsive table */}
                      <div className="hidden lg:block overflow-x-auto -mx-1">
                        <table className="w-full min-w-[540px] border-collapse">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                              <th className="py-3 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                              <th className="py-3 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paid</th>
                              <th className="py-3 px-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                              <th className="py-3 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentCharges.map((charge) => {
                              const remainingAmount = charge.amount - (charge.paid_amount || 0);
                              return (
                                <tr
                                  key={charge.id}
                                  className={cn(
                                    "border-b border-border/60 transition-colors hover:bg-muted/40",
                                    charge.is_paid && "bg-green-500/5"
                                  )}
                                >
                                  <td className="py-3 px-3 text-sm text-muted-foreground whitespace-nowrap">
                                    {format(new Date(charge.charge_date), "MMM d, yyyy")}
                                  </td>
                                  <td className="py-3 px-3 text-sm font-medium text-foreground max-w-[140px] truncate" title={charge.description || undefined}>
                                    {charge.description || "Extra charge"}
                                  </td>
                                  <td className="py-3 px-3 text-sm font-semibold text-amber-600 text-right">₱{charge.amount.toFixed(2)}</td>
                                  <td className="py-3 px-3 text-sm text-green-600 text-right">₱{(charge.paid_amount || 0).toFixed(2)}</td>
                                  <td className="py-3 px-3 text-center">
                                    {charge.is_paid ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                                        Paid
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                        ₱{remainingAmount.toFixed(2)} due
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                        onClick={() => { setSelectedChargeForView(charge); setIsViewChargeOpen(true); }}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      {!charge.is_paid && (
                                        <Button
                                          size="sm"
                                          className="h-8 px-2 bg-green-600 hover:bg-green-700 text-white text-xs"
                                          onClick={() => {
                                            setActiveTab("payments");
                                            setPaymentFormData({
                                              payment_amount: remainingAmount,
                                              payment_type: "extra_charge",
                                              selected_charge_id: charge.id,
                                              payment_date: new Date(),
                                              notes: "",
                                            });
                                          }}
                                        >
                                          <DollarSign className="h-3.5 w-3 mr-1" />
                                          Pay
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                        onClick={() => { setChargeToDelete(charge); setIsDeleteChargeOpen(true); }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Tablet/mobile: cards (sm–lg) and small screens */}
                      <div className="lg:hidden space-y-3">
                        {studentCharges.map((charge) => {
                          const remainingAmount = charge.amount - (charge.paid_amount || 0);
                          return (
                            <div
                              key={charge.id}
                              className={cn(
                                "rounded-xl border p-4 shadow-sm transition-shadow",
                                charge.is_paid
                                  ? "border-green-200 bg-green-50/50 dark:border-green-800/60 dark:bg-green-950/20"
                                  : "border-amber-200/80 bg-amber-50/30 dark:border-amber-800/60 dark:bg-amber-950/10"
                              )}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-foreground truncate">{charge.description || "Extra charge"}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(charge.charge_date), "MMM d, yyyy")}</p>
                                </div>
                                {charge.is_paid ? (
                                  <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                                    Paid
                                  </span>
                                ) : (
                                  <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                    ₱{remainingAmount.toFixed(2)} due
                                  </span>
                                )}
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                                <span className="text-amber-600 font-semibold">₱{charge.amount.toFixed(2)}</span>
                                <span className="text-green-600">₱{(charge.paid_amount || 0).toFixed(2)} paid</span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-border/60">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 min-w-[80px] text-xs"
                                  onClick={() => { setSelectedChargeForView(charge); setIsViewChargeOpen(true); }}
                                >
                                  <Eye className="h-3.5 w-3 mr-1.5" />
                                  View
                                </Button>
                                {!charge.is_paid && (
                                  <Button
                                    size="sm"
                                    className="flex-1 min-w-[80px] bg-green-600 hover:bg-green-700 text-white text-xs"
                                    onClick={() => {
                                      setActiveTab("payments");
                                      setPaymentFormData({
                                        payment_amount: remainingAmount,
                                        payment_type: "extra_charge",
                                        selected_charge_id: charge.id,
                                        payment_date: new Date(),
                                        notes: "",
                                      });
                                    }}
                                  >
                                    <DollarSign className="h-3.5 w-3 mr-1.5" />
                                    Pay
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 text-xs"
                                  onClick={() => { setChargeToDelete(charge); setIsDeleteChargeOpen(true); }}
                                >
                                  <Trash2 className="h-3.5 w-3 mr-1.5" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Total extra charges</span>
                          <span className="text-lg font-bold text-amber-700 dark:text-amber-400">₱{totalCharges.toFixed(2)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-xs sm:text-sm text-center py-8">No extra charges found.</p>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        {/* Payment History Section - At Bottom */}
        <Card className="border-2 border-border bg-card shadow-xl">
          <CardHeader className="border-b border-border bg-[#242833] p-3 sm:p-4 md:p-5">
            <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
              <Receipt className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" />
              Payment History
            </CardTitle>
            <CardDescription className="text-gray-400 text-xs sm:text-sm">
              All recorded payments for this student
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-5">
            {paymentsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
                <p className="text-muted-foreground mt-2 text-xs sm:text-sm">Loading payments...</p>
              </div>
            ) : (() => {
              const allPayments: Array<{
                id: string;
                payment_amount: number;
                payment_date: string;
                created_at: string;
                notes: string | null;
                payment_for: string;
                charge_id: string | null;
                isDownpayment: boolean;
              }> = [];

              if (student.downpayment && student.downpayment > 0) {
                const dpDate = student.created_at || new Date().toISOString();
                allPayments.push({
                  id: 'downpayment',
                  payment_amount: student.downpayment,
                  payment_date: dpDate,
                  created_at: dpDate,
                  notes: null,
                  payment_for: 'downpayment',
                  charge_id: null,
                  isDownpayment: true,
                });
              }

              if (studentPayments && studentPayments.length > 0) {
                studentPayments.forEach(payment => {
                  allPayments.push({
                    id: payment.id,
                    payment_amount: payment.payment_amount,
                    payment_date: payment.payment_date,
                    created_at: payment.created_at,
                    notes: payment.notes,
                    payment_for: payment.payment_for || 'balance',
                    charge_id: payment.charge_id,
                    isDownpayment: false,
                  });
                });
              }

              allPayments.sort((a, b) => {
                const dateA = new Date(a.payment_date).getTime();
                const dateB = new Date(b.payment_date).getTime();
                return dateB - dateA;
              });

              if (allPayments.length === 0) {
                return <p className="text-muted-foreground text-xs sm:text-sm text-center py-8">No payment records found.</p>;
              }

              // Get charge description helper
              const getChargeDescription = (chargeId: string | null) => {
                if (!chargeId) return null;
                const charge = studentCharges?.find(c => c.id === chargeId);
                return charge?.description || 'Extra Charge';
              };

              return (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-[800px] rounded-lg border-2 border-border">
                  <thead className="bg-[#242833] text-[#efeff1]">
                    <tr>
                          <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Date</th>
                          <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Receipt #</th>
                          <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Amount</th>
                          <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Payment For</th>
                      <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Notes</th>
                          <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPayments.map((payment, index) => (
                      <tr
                        key={payment.id}
                            className={cn(
                              "transition-all duration-300",
                              payment.isDownpayment 
                                ? "bg-blue-50 dark:bg-blue-950/20" 
                                : payment.payment_for === 'extra_charge'
                                  ? "bg-amber-50/50 dark:bg-amber-950/10"
                                  : index % 2 === 0 ? "bg-card" : "bg-muted/50"
                            )}
                          >
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground text-xs sm:text-sm whitespace-nowrap">
                              {format(new Date(payment.created_at), "MMM dd, yyyy h:mm a")}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground text-xs sm:text-sm font-mono">
                          {payment.isDownpayment 
                            ? `REC-${student.id.slice(0, 8).toUpperCase()}-DP`
                            : `REC-${student.id.slice(0, 8).toUpperCase()}-${payment.id.slice(0, 8).toUpperCase()}`
                          }
                        </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-foreground text-xs sm:text-sm font-medium">
                          ₱{payment.payment_amount.toFixed(2)}
                        </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                              {payment.isDownpayment ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                  <DollarSign className="w-3 h-3 mr-1" />
                                  Downpayment
                                </span>
                              ) : payment.payment_for === 'extra_charge' ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  <FileText className="w-3 h-3 mr-1" />
                                  {getChargeDescription(payment.charge_id) || 'Extra Charge'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  <Wallet className="w-3 h-3 mr-1" />
                                  Training Balance
                                </span>
                              )}
                        </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground text-xs sm:text-sm max-w-[180px]">
                              <span className="truncate block" title={payment.notes ?? ''}>
                                {payment.notes || '—'}
                              </span>
                            </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                              <div className="flex gap-2">
                          <Button
                            size="sm"
                                  variant="outline"
                            onClick={() => {
                              if (payment.isDownpayment) {
                                      setSelectedPaymentForView({
                                        id: 'downpayment',
                                        student_id: student.id,
                                        payment_amount: payment.payment_amount,
                                        extra_charges: 0,
                                        charge_description: null,
                                        payment_date: payment.payment_date,
                                        notes: 'Initial Downpayment',
                                        created_at: payment.payment_date,
                                        updated_at: payment.payment_date,
                                        payment_for: 'downpayment',
                                        charge_id: null,
                                      });
                                    } else {
                                      const regularPayment = studentPayments?.find(p => p.id === payment.id);
                                      if (regularPayment) {
                                        setSelectedPaymentForView(regularPayment);
                                      }
                                    }
                                    setIsViewPaymentOpen(true);
                                  }}
                                  className="text-xs"
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (payment.isDownpayment) {
                                setSelectedPaymentForReceipt({
                                  id: 'downpayment',
                                  student_id: student.id,
                                  payment_amount: payment.payment_amount,
                                  extra_charges: 0,
                                        charge_description: null,
                                  payment_date: payment.payment_date,
                                  notes: 'Initial Downpayment',
                                  created_at: payment.payment_date,
                                  updated_at: payment.payment_date,
                                        payment_for: 'downpayment',
                                        charge_id: null,
                                });
                              } else {
                                const regularPayment = studentPayments?.find(p => p.id === payment.id);
                                if (regularPayment) {
                                  setSelectedPaymentForReceipt(regularPayment);
                                }
                              }
                              setIsReceiptOpen(true);
                            }}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                          >
                                  <Printer className="w-3 h-3" />
                          </Button>
                              </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {allPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className={cn(
                          "border rounded-lg p-4 space-y-3",
                          payment.isDownpayment 
                            ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800" 
                            : payment.payment_for === 'extra_charge'
                              ? "bg-amber-50/50 border-amber-200 dark:bg-amber-950/10 dark:border-amber-800"
                              : "bg-card border-border"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(payment.created_at), "MMM dd, yyyy h:mm a")}
                            </p>
                            <p className="font-bold text-lg text-green-600">
                              ₱{payment.payment_amount.toFixed(2)}
                            </p>
                          </div>
                          {payment.isDownpayment ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              Downpayment
                            </span>
                          ) : payment.payment_for === 'extra_charge' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              Extra Charge
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              Balance
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Receipt #</p>
                            <p className="text-xs font-mono">
                              {payment.isDownpayment 
                                ? `REC-...${student.id.slice(0, 4).toUpperCase()}-DP`
                                : `REC-...${payment.id.slice(0, 6).toUpperCase()}`
                              }
                            </p>
                          </div>
                          {payment.payment_for === 'extra_charge' && payment.charge_id && (
                            <div>
                              <p className="text-xs text-muted-foreground">For</p>
                              <p className="text-xs font-medium text-amber-700">
                                {getChargeDescription(payment.charge_id)}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground">Notes</p>
                          <p className="text-sm">{payment.notes || "—"}</p>
                        </div>
                        
                        <div className="flex gap-2 pt-2 border-t border-border">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (payment.isDownpayment) {
                                setSelectedPaymentForView({
                                  id: 'downpayment',
                                  student_id: student.id,
                                  payment_amount: payment.payment_amount,
                                  extra_charges: 0,
                                  charge_description: null,
                                  payment_date: payment.payment_date,
                                  notes: 'Initial Downpayment',
                                  created_at: payment.payment_date,
                                  updated_at: payment.payment_date,
                                  payment_for: 'downpayment',
                                  charge_id: null,
                                });
                              } else {
                                const regularPayment = studentPayments?.find(p => p.id === payment.id);
                                if (regularPayment) {
                                  setSelectedPaymentForView(regularPayment);
                                }
                              }
                              setIsViewPaymentOpen(true);
                            }}
                            className="flex-1 text-xs"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (payment.isDownpayment) {
                                setSelectedPaymentForReceipt({
                                  id: 'downpayment',
                                  student_id: student.id,
                                  payment_amount: payment.payment_amount,
                                  extra_charges: 0,
                                  charge_description: null,
                                  payment_date: payment.payment_date,
                                  notes: 'Initial Downpayment',
                                  created_at: payment.payment_date,
                                  updated_at: payment.payment_date,
                                  payment_for: 'downpayment',
                                  charge_id: null,
                                });
                              } else {
                                const regularPayment = studentPayments?.find(p => p.id === payment.id);
                                if (regularPayment) {
                                  setSelectedPaymentForReceipt(regularPayment);
                                }
                              }
                              setIsReceiptOpen(true);
                            }}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                          >
                            <Printer className="w-3 h-3 mr-1" />
                            Receipt
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-green-700 dark:text-green-400 font-medium text-sm">Total Payments:</span>
                      <span className="text-green-700 dark:text-green-400 font-bold text-lg">
                        ₱{allPayments.reduce((sum, p) => sum + p.payment_amount, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>

        {/* Add Charge Modal */}
        <Dialog open={isAddChargeOpen} onOpenChange={setIsAddChargeOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-600" />
                Add Extra Charge
              </DialogTitle>
              <DialogDescription>
                Add an extra charge to increase the remaining balance.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              addChargeMutation.mutate({
                ...chargeFormData,
                student_id: student.id,
              });
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="charge_amount">Amount</Label>
                <Input
                  id="charge_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={chargeFormData.amount}
                  onChange={(e) => setChargeFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  required
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="charge_description">Description</Label>
                <Input
                  id="charge_description"
                  value={chargeFormData.description}
                  onChange={(e) => setChargeFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., Equipment fee, Late fee, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !chargeFormData.charge_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {chargeFormData.charge_date ? format(chargeFormData.charge_date, "MM/dd/yyyy") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={chargeFormData.charge_date || undefined}
                      onSelect={(date) => setChargeFormData(prev => ({ ...prev, charge_date: date || new Date() }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddChargeOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addChargeMutation.isPending || chargeFormData.amount <= 0}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {addChargeMutation.isPending ? "Adding..." : "Add Charge"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Payment Modal */}
        <Dialog open={isViewPaymentOpen} onOpenChange={setIsViewPaymentOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-accent" />
                Payment Details
              </DialogTitle>
            </DialogHeader>
            {selectedPaymentForView && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">{format(new Date(selectedPaymentForView.payment_date), "MMM dd, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="font-medium text-green-600">₱{selectedPaymentForView.payment_amount.toFixed(2)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Receipt Number</p>
                  <p className="font-mono text-sm">
                    {selectedPaymentForView.id === 'downpayment'
                      ? `REC-${student.id.slice(0, 8).toUpperCase()}-DP`
                      : `REC-${student.id.slice(0, 8).toUpperCase()}-${selectedPaymentForView.id.slice(0, 8).toUpperCase()}`
                    }
                  </p>
                </div>
                {selectedPaymentForView.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-sm">{selectedPaymentForView.notes}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Created At</p>
                  <p className="text-sm">{format(new Date(selectedPaymentForView.created_at), "MMM dd, yyyy HH:mm")}</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewPaymentOpen(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setSelectedPaymentForReceipt(selectedPaymentForView);
                  setIsReceiptOpen(true);
                  setIsViewPaymentOpen(false);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Receipt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Charge Modal */}
        <Dialog open={isViewChargeOpen} onOpenChange={setIsViewChargeOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-600" />
                Charge Details
              </DialogTitle>
            </DialogHeader>
            {selectedChargeForView && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">{format(new Date(selectedChargeForView.charge_date), "MMM dd, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="font-medium text-amber-600">+₱{selectedChargeForView.amount.toFixed(2)}</p>
                  </div>
                </div>
                {selectedChargeForView.description && (
                  <div>
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="text-sm">{selectedChargeForView.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Created At</p>
                  <p className="text-sm">{format(new Date(selectedChargeForView.created_at), "MMM dd, yyyy HH:mm")}</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewChargeOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Charge Confirmation */}
        <AlertDialog open={isDeleteChargeOpen} onOpenChange={setIsDeleteChargeOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Extra Charge</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this charge of ₱{chargeToDelete?.amount.toFixed(2)}? 
                This will reduce the remaining balance by this amount. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => chargeToDelete && deleteChargeMutation.mutate(chargeToDelete.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteChargeMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
