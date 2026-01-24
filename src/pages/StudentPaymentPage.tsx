import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, DollarSign, CreditCard, CalendarIcon, Edit, Printer, Plus, Eye, Receipt, AlertCircle, Trash2 } from "lucide-react";
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
}

export default function StudentPaymentPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("payments");
  const [paymentFormData, setPaymentFormData] = useState({
    payment_amount: 0,
    payment_date: new Date(),
    notes: "",
  });

  const [chargeFormData, setChargeFormData] = useState({
    amount: 0,
    description: "",
    notes: "",
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
      });
      setIsReceiptOpen(true);
      
      setPaymentFormData({
        payment_amount: 0,
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
          notes: charge.notes || null,
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
        notes: "",
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
                    addPaymentMutation.mutate({
                      ...paymentFormData,
                      student_id: student.id,
                    });
                  }} className="space-y-4 mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                          className="border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={addPaymentMutation.isPending || paymentFormData.payment_amount <= 0}
                        className="bg-green-600 hover:bg-green-700 text-white transition-all duration-300 text-xs sm:text-sm"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        {addPaymentMutation.isPending ? "Recording..." : "Add Payment"}
                      </Button>
                    </div>
                  </form>

                  {/* Payment History Table */}
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
                      notes: string | null;
                      isDownpayment: boolean;
                    }> = [];

                    if (student.downpayment && student.downpayment > 0) {
                      allPayments.push({
                        id: 'downpayment',
                        payment_amount: student.downpayment,
                        payment_date: student.created_at || new Date().toISOString(),
                        notes: 'Initial Downpayment',
                        isDownpayment: true,
                      });
                    }

                    if (studentPayments && studentPayments.length > 0) {
                      studentPayments.forEach(payment => {
                        allPayments.push({
                          ...payment,
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

                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[600px] rounded-lg border-2 border-border">
                          <thead className="bg-[#242833] text-[#efeff1]">
                            <tr>
                              <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Date</th>
                              <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Receipt #</th>
                              <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Amount</th>
                              <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Notes</th>
                              <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allPayments.map((payment, index) => (
                              <tr
                                key={payment.id}
                                className={`transition-all duration-300 ${index % 2 === 0 ? "bg-card" : "bg-muted/50"} ${payment.isDownpayment ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
                              >
                                <td className="py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground text-xs sm:text-sm">
                                  {format(new Date(payment.payment_date), "MMM dd, yyyy")}
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
                                <td className="py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground text-xs sm:text-sm">
                                  <span className="truncate block max-w-[150px]" title={payment.notes || 'N/A'}>
                                    {payment.notes || 'N/A'}
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
                    );
                  })()}
                </TabsContent>

                <TabsContent value="charges" className="mt-0">
                  {/* Add Charge Button */}
                  <div className="flex justify-end mb-4">
                    <Button
                      onClick={() => setIsAddChargeOpen(true)}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Extra Charge
                    </Button>
                  </div>

                  {/* Charges Table */}
                  {chargesLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
                      <p className="text-muted-foreground mt-2 text-xs sm:text-sm">Loading charges...</p>
                    </div>
                  ) : studentCharges && studentCharges.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px] rounded-lg border-2 border-border">
                        <thead className="bg-[#242833] text-[#efeff1]">
                          <tr>
                            <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Date</th>
                            <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Amount</th>
                            <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Description</th>
                            <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Notes</th>
                            <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentCharges.map((charge, index) => (
                            <tr
                              key={charge.id}
                              className={`transition-all duration-300 ${index % 2 === 0 ? "bg-card" : "bg-muted/50"}`}
                            >
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground text-xs sm:text-sm">
                                {format(new Date(charge.charge_date), "MMM dd, yyyy")}
                              </td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-amber-600 text-xs sm:text-sm font-medium">
                                +₱{charge.amount.toFixed(2)}
                              </td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground text-xs sm:text-sm">
                                <span className="truncate block max-w-[150px]" title={charge.description || 'N/A'}>
                                  {charge.description || 'N/A'}
                                </span>
                              </td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground text-xs sm:text-sm">
                                <span className="truncate block max-w-[150px]" title={charge.notes || 'N/A'}>
                                  {charge.notes || 'N/A'}
                                </span>
                              </td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedChargeForView(charge);
                                      setIsViewChargeOpen(true);
                                    }}
                                    className="text-xs"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setChargeToDelete(charge);
                                      setIsDeleteChargeOpen(true);
                                    }}
                                    className="text-xs"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-amber-700 dark:text-amber-400 font-medium text-sm">Total Extra Charges:</span>
                          <span className="text-amber-700 dark:text-amber-400 font-bold text-lg">₱{totalCharges.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs sm:text-sm text-center py-8">No extra charges found.</p>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

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
              <div className="space-y-2">
                <Label htmlFor="charge_notes">Notes (Optional)</Label>
                <Textarea
                  id="charge_notes"
                  value={chargeFormData.notes}
                  onChange={(e) => setChargeFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  rows={3}
                />
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
                {selectedChargeForView.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-sm">{selectedChargeForView.notes}</p>
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
