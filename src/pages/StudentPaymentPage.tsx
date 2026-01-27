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
import { ArrowLeft, DollarSign, CreditCard, CalendarIcon, Edit, Printer, Plus, Eye, Receipt, AlertCircle, Trash2, Wallet, FileText, TrendingUp, TrendingDown, Clock, CheckCircle2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Student {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  total_training_fee: number | null;
  downpayment: number | null;
  remaining_balance: number | null;
  created_at: string | null;
  package_type: string | null;
  sessions: number | null;
  remaining_sessions: number | null;
  enrollment_date: string | null;
  expiration_date: string | null;
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
  package_history_id: string | null;
}

interface PackageHistory {
  id: string;
  student_id: string | null;
  package_type: string | null;
  sessions: number | null;
  remaining_sessions: number | null;
  enrollment_date: string | null;
  expiration_date: string | null;
  captured_at: string;
  reason: string | null;
  total_training_fee: number | null;
  downpayment: number | null;
  remaining_balance: number | null;
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
  package_history_id: string | null;
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
    selected_package_history_id: "" as string,
    payment_date: new Date(),
    notes: "",
  });

  const [chargeFormData, setChargeFormData] = useState({
    amount: 0,
    description: "",
    charge_date: new Date(),
    selected_package_history_id: "" as string,
  });

  const [selectedPackageForPaymentInfo, setSelectedPackageForPaymentInfo] = useState<string>("");
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
        .select("id, name, email, phone, total_training_fee, downpayment, remaining_balance, created_at, package_type, sessions, remaining_sessions, enrollment_date, expiration_date")
        .eq("id", studentId)
        .maybeSingle();
      if (error) throw error;
      return data as Student | null;
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
      return (data || []) as StudentCharge[];
    },
    enabled: !!studentId,
  });

  // Fetch package history
  const { data: packageHistory, isLoading: packageHistoryLoading } = useQuery({
    queryKey: ["student-package-history", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("student_package_history")
        .select("id, student_id, package_type, sessions, remaining_sessions, enrollment_date, expiration_date, captured_at, reason")
        .eq("student_id", studentId)
        .order("captured_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(p => ({
        ...p,
        total_training_fee: null,
        downpayment: null,
        remaining_balance: null,
      })) as PackageHistory[];
    },
    enabled: !!studentId,
  });

  // Determine if student has a current package
  const hasCurrentPackage = student && student.package_type !== null && student.package_type !== '';
  
  // Create current package entry from student record
  const currentPackageFromStudent: PackageHistory | null = hasCurrentPackage && student ? {
    id: 'current',
    student_id: student.id,
    package_type: student.package_type,
    sessions: student.sessions,
    remaining_sessions: student.remaining_sessions,
    enrollment_date: student.enrollment_date,
    expiration_date: student.expiration_date,
    captured_at: new Date().toISOString(),
    reason: null,
    total_training_fee: student.total_training_fee,
    downpayment: student.downpayment,
    remaining_balance: student.remaining_balance,
  } : null;

  // Combine current package with history
  const allPackages: PackageHistory[] = currentPackageFromStudent 
    ? [currentPackageFromStudent, ...(packageHistory || [])]
    : (packageHistory || []);
  
  const currentCycleNumber = packageHistory ? packageHistory.length + (hasCurrentPackage ? 1 : 0) : (hasCurrentPackage ? 1 : 0);

  // Get package display helper
  const getPackageDisplay = (pkgHistoryId: string | null | undefined, chargeDate?: string) => {
    if (pkgHistoryId === 'current') {
      if (student && student.package_type) {
        const cycleNum = packageHistory ? packageHistory.length + 1 : 1;
        return `${student.package_type} ${cycleNum}`;
      }
      return null;
    }
    
    if (!pkgHistoryId && chargeDate && student && student.package_type) {
      const chargeDateObj = new Date(chargeDate);
      const enrollmentDate = student.enrollment_date ? new Date(student.enrollment_date) : null;
      const expirationDate = student.expiration_date ? new Date(student.expiration_date) : null;
      
      if (enrollmentDate && chargeDateObj >= enrollmentDate) {
        if (!expirationDate || chargeDateObj <= expirationDate) {
          const cycleNum = packageHistory ? packageHistory.length + 1 : 1;
          return `${student.package_type} ${cycleNum}`;
        }
      }
    }
    
    if (pkgHistoryId) {
      const pkg = packageHistory?.find(p => p.id === pkgHistoryId);
      if (pkg) {
        const pkgIndex = packageHistory?.findIndex(p => p.id === pkg.id) ?? 0;
        const cycleNumber = (packageHistory?.length || 0) - pkgIndex;
        return `${pkg.package_type || 'Package'} ${cycleNumber}`;
      }
    }
    
    return null;
  };

  // Initialize selected package for payment info
  useEffect(() => {
    if (currentPackageFromStudent && !selectedPackageForPaymentInfo) {
      setSelectedPackageForPaymentInfo(currentPackageFromStudent.id);
    } else if (!currentPackageFromStudent && packageHistory && packageHistory.length > 0 && !selectedPackageForPaymentInfo) {
      setSelectedPackageForPaymentInfo(packageHistory[0].id);
    }
  }, [currentPackageFromStudent, packageHistory, selectedPackageForPaymentInfo]);

  // Calculate remaining balance for selected package
  useEffect(() => {
    if (student && selectedPackageForPaymentInfo) {
      const calculateRemainingBalance = async () => {
        let totalFee = 0;
        let downpayment = 0;
        
        if (selectedPackageForPaymentInfo === 'current') {
          totalFee = student.total_training_fee || 0;
          downpayment = student.downpayment || 0;
        } else {
          const selectedPkg = packageHistory?.find(p => p.id === selectedPackageForPaymentInfo);
          if (selectedPkg) {
            totalFee = selectedPkg.total_training_fee || 0;
            downpayment = selectedPkg.downpayment || 0;
          }
        }
        
        // Get payments for this specific package
        const { data: existingPayments } = await supabase
          .from("student_payments")
          .select("payment_amount, payment_for, charge_id, package_history_id")
          .eq("student_id", student.id);
        
        // Get charges for this specific package
        const { data: existingCharges } = await supabase
          .from("student_charges")
          .select("amount, package_history_id")
          .eq("student_id", student.id);
        
        // Calculate payments for balance for this package
        const balancePayments = (existingPayments || []).filter(p => 
          p.payment_for === 'balance' && 
          (p.package_history_id === selectedPackageForPaymentInfo || 
           (selectedPackageForPaymentInfo === 'current' && !p.package_history_id))
        ).reduce((sum, p) => sum + (p.payment_amount || 0), 0);
        
        const totalCharges = (existingCharges || []).filter(c => 
          c.package_history_id === selectedPackageForPaymentInfo || 
          (selectedPackageForPaymentInfo === 'current' && !c.package_history_id)
        ).reduce((sum, c) => sum + (c.amount || 0), 0);
        
        const remainingBalance = Math.max(0, totalFee - downpayment - balancePayments + totalCharges);
        
        setPaymentInfoFormData({
          total_training_fee: totalFee,
          downpayment: downpayment,
          remaining_balance: remainingBalance,
        });
      };
      
      calculateRemainingBalance();
    }
  }, [student, studentCharges, selectedPackageForPaymentInfo, packageHistory]);

  // Initialize package selection when package history loads
  useEffect(() => {
    if (currentPackageFromStudent && paymentFormData.payment_type === "balance" && !paymentFormData.selected_package_history_id) {
      setPaymentFormData((prev) => ({
        ...prev,
        selected_package_history_id: currentPackageFromStudent.id,
      }));
    } else if (!currentPackageFromStudent && packageHistory && packageHistory.length > 0 && paymentFormData.payment_type === "balance" && !paymentFormData.selected_package_history_id) {
      setPaymentFormData((prev) => ({
        ...prev,
        selected_package_history_id: packageHistory[0].id,
      }));
    }
  }, [currentPackageFromStudent, packageHistory, paymentFormData.payment_type, paymentFormData.selected_package_history_id]);

  // Initialize package selection for charges
  useEffect(() => {
    if (currentPackageFromStudent && !chargeFormData.selected_package_history_id) {
      setChargeFormData((prev) => ({
        ...prev,
        selected_package_history_id: currentPackageFromStudent.id,
      }));
    } else if (!currentPackageFromStudent && packageHistory && packageHistory.length > 0 && !chargeFormData.selected_package_history_id) {
      setChargeFormData((prev) => ({
        ...prev,
        selected_package_history_id: packageHistory[0].id,
      }));
    }
  }, [currentPackageFromStudent, packageHistory, chargeFormData.selected_package_history_id]);

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
      return (data || []) as StudentPayment[];
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
          package_history_id: payment.payment_type === "balance" && payment.selected_package_history_id && payment.selected_package_history_id !== 'current' ? payment.selected_package_history_id : null,
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
        package_history_id: data.package_history_id,
      });
      setIsReceiptOpen(true);
      
      setPaymentFormData({
        payment_amount: 0,
        payment_type: "balance",
        selected_charge_id: "",
        selected_package_history_id: currentPackageFromStudent?.id || (packageHistory && packageHistory.length > 0 ? packageHistory[0].id : ""),
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
          package_history_id: charge.selected_package_history_id && charge.selected_package_history_id !== 'current' ? charge.selected_package_history_id : null,
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
        selected_package_history_id: currentPackageFromStudent?.id || "",
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
    mutationFn: async (paymentInfo: typeof paymentInfoFormData & { student_id: string; package_id: string }) => {
      const totalFee = paymentInfo.total_training_fee || 0;
      const downpayment = paymentInfo.downpayment || 0;
      
      // Get payments for this specific package
      const { data: existingPayments } = await supabase
        .from("student_payments")
        .select("payment_amount, payment_for, package_history_id")
        .eq("student_id", paymentInfo.student_id);
      
      // Get charges for this specific package
      const { data: existingCharges } = await supabase
        .from("student_charges")
        .select("amount, package_history_id")
        .eq("student_id", paymentInfo.student_id);
      
      // Calculate balance payments for this package
      const balancePayments = (existingPayments || []).filter(p => 
        p.payment_for === 'balance' &&
        (p.package_history_id === paymentInfo.package_id || 
         (paymentInfo.package_id === 'current' && !p.package_history_id))
      ).reduce((sum, p) => sum + (p.payment_amount || 0), 0);
      
      const totalCharges = (existingCharges || []).filter(c =>
        c.package_history_id === paymentInfo.package_id || 
        (paymentInfo.package_id === 'current' && !c.package_history_id)
      ).reduce((sum, c) => sum + (c.amount || 0), 0);
      
      const remainingBalance = Math.max(0, totalFee - downpayment - balancePayments + totalCharges);
      
      if (paymentInfo.package_id === 'current') {
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
      } else {
        const { data, error } = await supabase
          .from("student_package_history")
          .update({
            remaining_sessions: paymentInfo.downpayment,
          })
          .eq("id", paymentInfo.package_id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student-package-history", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student-payments", studentId] });
      setIsEditingPaymentInfo(false);
      toast.success("Payment information updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update payment information: " + error.message);
    },
  });

  // Calculate total charges for selected package
  const totalChargesForSelectedPackage = selectedPackageForPaymentInfo 
    ? (studentCharges?.filter(c => {
        if (selectedPackageForPaymentInfo === 'current') {
          return !c.package_history_id;
        }
        return c.package_history_id === selectedPackageForPaymentInfo;
      }).reduce((sum, c) => sum + (c.amount || 0), 0) || 0)
    : 0;

  // Calculate summary stats
  const totalPaid = (studentPayments || []).reduce((sum, p) => sum + p.payment_amount, 0) + (student?.downpayment || 0);
  const totalCharges = (studentCharges || []).reduce((sum, c) => sum + c.amount, 0);
  const unpaidCharges = (studentCharges || []).filter(c => !c.is_paid);
  const paidPercentage = student?.total_training_fee 
    ? Math.min(100, ((totalPaid) / (student.total_training_fee + totalCharges)) * 100)
    : 0;

  if (studentLoading) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4" style={{ borderColor: '#79e58f' }}></div>
          <p className="text-muted-foreground text-xs sm:text-sm">Loading student information...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pt-4 p-3 sm:p-4 md:p-6 pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard/students")}
            className="mb-4 border-2 border-accent/50 text-accent hover:bg-accent hover:text-accent-foreground hover:border-accent transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Players
          </Button>
          <div className="bg-gradient-to-r from-accent/10 via-accent/5 to-transparent rounded-xl p-4 sm:p-6 border border-accent/20 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1 tracking-tight">
                  Financial Management
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground font-medium">{student.name}</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground/80 ml-11">Manage payments, charges, and view balance history</p>
          </div>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200/50 dark:border-green-800/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">Total</Badge>
              </div>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">₱{totalPaid.toFixed(2)}</p>
              <p className="text-xs text-green-600/80">Total Paid</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200/50 dark:border-amber-800/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <TrendingDown className="w-5 h-5 text-amber-600" />
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">{unpaidCharges.length}</Badge>
              </div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">₱{(student.remaining_balance || 0).toFixed(2)}</p>
              <p className="text-xs text-amber-600/80">Remaining Balance</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200/50 dark:border-blue-800/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">Fee</Badge>
              </div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">₱{(student.total_training_fee || 0).toFixed(2)}</p>
              <p className="text-xs text-blue-600/80">Training Fee</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200/50 dark:border-purple-800/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 className="w-5 h-5 text-purple-600" />
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">{Math.round(paidPercentage)}%</Badge>
              </div>
              <Progress value={paidPercentage} className="h-2 mb-2" />
              <p className="text-xs text-purple-600/80">Payment Progress</p>
            </CardContent>
          </Card>
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
                if (student && selectedPackageForPaymentInfo) {
                  updatePaymentInfoMutation.mutate({
                    ...paymentInfoFormData,
                    student_id: student.id,
                    package_id: selectedPackageForPaymentInfo,
                  });
                }
              }} className="space-y-4">
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label className="text-muted-foreground font-medium text-xs sm:text-sm truncate">
                    Package
                  </Label>
                  {allPackages && allPackages.length > 0 ? (
                    <Select
                      value={selectedPackageForPaymentInfo}
                      onValueChange={(value) => {
                        setSelectedPackageForPaymentInfo(value);
                        setIsEditingPaymentInfo(false);
                      }}
                      disabled={isEditingPaymentInfo}
                    >
                      <SelectTrigger className="border-2 border-accent rounded-lg text-xs sm:text-sm disabled:bg-muted disabled:cursor-not-allowed">
                        <SelectValue placeholder="Select package" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {allPackages.map((pkg, idx) => {
                          const cycleNumber = currentCycleNumber - idx;
                          const isExpired = pkg.expiration_date ? new Date(pkg.expiration_date) < new Date() : false;
                          const isCurrent = pkg.id === 'current' || (idx === 0 && currentPackageFromStudent);
                          return (
                            <SelectItem key={pkg.id} value={pkg.id}>
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {pkg.package_type || 'Package'} {cycleNumber}
                                  </span>
                                  {isCurrent && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">
                                      Current
                                    </span>
                                  )}
                                  {!isCurrent && isExpired && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                                      Expired
                                    </span>
                                  )}
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-3 rounded-lg border-2 border-muted bg-muted/50">
                      <p className="text-sm text-muted-foreground text-center">
                        No package found
                      </p>
                    </div>
                  )}
                </div>
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
                        remaining_balance: Math.max(0, value - downpayment + totalChargesForSelectedPackage),
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
                        remaining_balance: Math.max(0, totalFee - value + totalChargesForSelectedPackage),
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
                {totalChargesForSelectedPackage > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Extra Charges: ₱{totalChargesForSelectedPackage.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                {!isEditingPaymentInfo ? (
                  <Button
                    type="button"
                    onClick={() => setIsEditingPaymentInfo(true)}
                    className="w-full bg-accent hover:bg-accent/80 text-accent-foreground"
                    disabled={!selectedPackageForPaymentInfo}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Payment Info
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditingPaymentInfo(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updatePaymentInfoMutation.isPending}
                      className="flex-1 bg-accent hover:bg-accent/80 text-accent-foreground"
                    >
                      {updatePaymentInfoMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Record Payment Card */}
          <Card className="border-2 border-border bg-card shadow-xl lg:col-span-2">
            <CardHeader className="border-b border-border bg-[#242833] p-3 sm:p-4 md:p-5">
              <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                <CreditCard className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" />
                Record Payment
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs sm:text-sm">
                Record new payments for balance or extra charges
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-5">
              <form onSubmit={(e) => {
                e.preventDefault();
                if (student) {
                  addPaymentMutation.mutate({
                    ...paymentFormData,
                    student_id: student.id,
                  });
                }
              }} className="space-y-4">
                {/* Payment Type Selection */}
                <div className="flex flex-col space-y-2">
                  <Label className="text-muted-foreground font-medium text-xs sm:text-sm">
                    Payment Type
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={paymentFormData.payment_type === "balance" ? "default" : "outline"}
                      onClick={() => setPaymentFormData((prev) => ({ 
                        ...prev, 
                        payment_type: "balance",
                        selected_charge_id: "",
                        selected_package_history_id: currentPackageFromStudent?.id || (packageHistory && packageHistory.length > 0 ? packageHistory[0].id : ""),
                      }))}
                      className={cn(
                        "h-auto py-3 flex flex-col items-center gap-1",
                        paymentFormData.payment_type === "balance" 
                          ? "bg-accent hover:bg-accent/80 text-accent-foreground border-accent" 
                          : "border-2 border-accent/50 hover:bg-accent/10"
                      )}
                    >
                      <Wallet className="w-5 h-5" />
                      <span className="text-xs font-medium">Training Balance</span>
                    </Button>
                    <Button
                      type="button"
                      variant={paymentFormData.payment_type === "extra_charge" ? "default" : "outline"}
                      onClick={() => setPaymentFormData((prev) => ({ 
                        ...prev, 
                        payment_type: "extra_charge",
                        selected_package_history_id: "",
                      }))}
                      className={cn(
                        "h-auto py-3 flex flex-col items-center gap-1",
                        paymentFormData.payment_type === "extra_charge" 
                          ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600" 
                          : "border-2 border-amber-400/50 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      )}
                    >
                      <FileText className="w-5 h-5" />
                      <span className="text-xs font-medium">Extra Charge</span>
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {paymentFormData.payment_type === "extra_charge" ? (
                    <>
                      {/* Charge Selection */}
                      <div className="flex flex-col space-y-2 min-w-0 sm:col-span-2">
                        <Label className="text-muted-foreground font-medium text-xs sm:text-sm truncate">
                          Select Charge to Pay
                        </Label>
                        {unpaidCharges.length > 0 ? (
                          <Select
                            value={paymentFormData.selected_charge_id}
                            onValueChange={(value) => {
                              const selectedCharge = studentCharges?.find(c => c.id === value);
                              setPaymentFormData((prev) => ({ 
                                ...prev, 
                                selected_charge_id: value,
                                payment_amount: selectedCharge ? (selectedCharge.amount - (selectedCharge.paid_amount || 0)) : 0,
                                selected_package_history_id: "",
                              }));
                            }}
                          >
                            <SelectTrigger className="border-2 border-amber-400 rounded-lg text-xs sm:text-sm">
                              <SelectValue placeholder="Select a charge..." />
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              {unpaidCharges.map((charge) => {
                                const pkgDisplay = getPackageDisplay(charge.package_history_id, charge.charge_date);
                                return (
                                  <SelectItem key={charge.id} value={charge.id}>
                                    <div className="flex flex-col gap-1 w-full">
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="font-medium">{charge.description || 'Extra Charge'}</span>
                                        <span className="text-amber-600 font-medium">
                                          ₱{(charge.amount - (charge.paid_amount || 0)).toFixed(2)}
                                        </span>
                                      </div>
                                      {pkgDisplay && (
                                        <span className="text-xs text-purple-600 font-medium">
                                          Package: {pkgDisplay}
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })}
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
                      {paymentFormData.selected_charge_id && (
                        <div className="flex flex-col space-y-2 min-w-0 sm:col-span-2">
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
                    </>
                  ) : (
                    <>
                      {/* Package Selection */}
                      <div className="flex flex-col space-y-2 min-w-0">
                        <Label className="text-muted-foreground font-medium text-xs sm:text-sm truncate">
                          Package
                        </Label>
                        {allPackages && allPackages.length > 0 ? (
                          <Select
                            value={paymentFormData.selected_package_history_id}
                            onValueChange={(value) => setPaymentFormData((prev) => ({ 
                              ...prev, 
                              selected_package_history_id: value
                            }))}
                          >
                            <SelectTrigger className="border-2 border-accent rounded-lg text-xs sm:text-sm">
                              <SelectValue placeholder="Select package" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              {allPackages.map((pkg, idx) => {
                                const cycleNumber = currentCycleNumber - idx;
                                const isExpired = pkg.expiration_date ? new Date(pkg.expiration_date) < new Date() : false;
                                const isCurrent = pkg.id === 'current' || (idx === 0 && currentPackageFromStudent);
                                return (
                                  <SelectItem key={pkg.id} value={pkg.id}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {pkg.package_type || 'Package'} {cycleNumber}
                                      </span>
                                      {isCurrent && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">
                                          Current
                                        </span>
                                      )}
                                      {!isCurrent && isExpired && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                                          Expired
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="p-3 rounded-lg border-2 border-muted bg-muted/50">
                            <p className="text-sm text-muted-foreground text-center">
                              No package found
                            </p>
                          </div>
                        )}
                      </div>
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
                    </>
                  )}
                </div>
                
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
                      <PopoverContent className="w-auto p-0 z-50" align="start">
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
                
                <Button
                  type="submit"
                  disabled={
                    addPaymentMutation.isPending || 
                    paymentFormData.payment_amount <= 0 ||
                    (paymentFormData.payment_type === "extra_charge" && !paymentFormData.selected_charge_id) ||
                    (paymentFormData.payment_type === "balance" && !paymentFormData.selected_package_history_id)
                  }
                  className={cn(
                    "w-full",
                    paymentFormData.payment_type === "extra_charge" 
                      ? "bg-amber-600 hover:bg-amber-700 text-white" 
                      : "bg-accent hover:bg-accent/80 text-accent-foreground"
                  )}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {addPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Payment History and Charges Section */}
        <Card className="border-2 border-border bg-card shadow-xl">
          <CardHeader className="border-b border-border bg-[#242833] p-3 sm:p-4 md:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                  <Receipt className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" />
                  Transaction History
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs sm:text-sm">
                  View all payments and charges
                </CardDescription>
              </div>
              <Button
                onClick={() => setIsAddChargeOpen(true)}
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Charge
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 p-0 h-auto">
                <TabsTrigger 
                  value="payments" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-6 py-3"
                >
                  Payments ({(studentPayments?.length || 0) + (student.downpayment ? 1 : 0)})
                </TabsTrigger>
                <TabsTrigger 
                  value="charges" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent px-6 py-3"
                >
                  Extra Charges ({studentCharges?.length || 0})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="payments" className="m-0 p-4">
                {paymentsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
                    <p className="text-muted-foreground mt-2 text-sm">Loading payments...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Downpayment Entry */}
                    {student.downpayment && student.downpayment > 0 && (
                      <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/50">
                            <DollarSign className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Downpayment</p>
                            <p className="text-xs text-muted-foreground">
                              {student.enrollment_date ? format(new Date(student.enrollment_date), 'MMM dd, yyyy') : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-blue-600">₱{student.downpayment.toFixed(2)}</p>
                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">Initial</Badge>
                        </div>
                      </div>
                    )}
                    
                    {/* Regular Payments */}
                    {studentPayments && studentPayments.length > 0 ? (
                      studentPayments.map((payment) => (
                        <div 
                          key={payment.id}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-md",
                            payment.payment_for === 'extra_charge'
                              ? "bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800"
                              : "bg-gradient-to-r from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-full",
                              payment.payment_for === 'extra_charge' 
                                ? "bg-amber-100 dark:bg-amber-900/50" 
                                : "bg-green-100 dark:bg-green-900/50"
                            )}>
                              {payment.payment_for === 'extra_charge' ? (
                                <FileText className="w-4 h-4 text-amber-600" />
                              ) : (
                                <Wallet className="w-4 h-4 text-green-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">
                                {payment.payment_for === 'extra_charge' ? 'Charge Payment' : 'Balance Payment'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(payment.payment_date), 'MMM dd, yyyy h:mm a')}
                              </p>
                              {payment.notes && (
                                <p className="text-xs text-muted-foreground mt-1 italic">"{payment.notes}"</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className={cn(
                                "text-lg font-bold",
                                payment.payment_for === 'extra_charge' ? "text-amber-600" : "text-green-600"
                              )}>
                                ₱{payment.payment_amount.toFixed(2)}
                              </p>
                              {getPackageDisplay(payment.package_history_id, payment.payment_date) && (
                                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                                  {getPackageDisplay(payment.package_history_id, payment.payment_date)}
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedPaymentForView(payment);
                                  setIsViewPaymentOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedPaymentForReceipt(payment);
                                  setIsReceiptOpen(true);
                                }}
                              >
                                <Printer className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : !student.downpayment && (
                      <div className="text-center py-8 text-muted-foreground">
                        <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No payment records found</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="charges" className="m-0 p-4">
                {chargesLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto"></div>
                    <p className="text-muted-foreground mt-2 text-sm">Loading charges...</p>
                  </div>
                ) : studentCharges && studentCharges.length > 0 ? (
                  <div className="space-y-3">
                    {studentCharges.map((charge) => (
                      <div 
                        key={charge.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-md",
                          charge.is_paid
                            ? "bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-950/30 dark:to-gray-900/20 border-gray-200 dark:border-gray-800"
                            : "bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-full",
                            charge.is_paid 
                              ? "bg-gray-100 dark:bg-gray-900/50" 
                              : "bg-amber-100 dark:bg-amber-900/50"
                          )}>
                            <Receipt className={cn(
                              "w-4 h-4",
                              charge.is_paid ? "text-gray-500" : "text-amber-600"
                            )} />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">
                              {charge.description || 'Extra Charge'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(charge.charge_date), 'MMM dd, yyyy')}
                            </p>
                            {getPackageDisplay(charge.package_history_id, charge.charge_date) && (
                              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 mt-1">
                                {getPackageDisplay(charge.package_history_id, charge.charge_date)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={cn(
                              "text-lg font-bold",
                              charge.is_paid ? "text-gray-500 line-through" : "text-amber-600"
                            )}>
                              ₱{charge.amount.toFixed(2)}
                            </p>
                            <Badge 
                              variant={charge.is_paid ? "secondary" : "destructive"}
                              className={cn(
                                "text-xs",
                                charge.is_paid 
                                  ? "bg-green-100 text-green-700" 
                                  : "bg-red-100 text-red-700"
                              )}
                            >
                              {charge.is_paid ? 'Paid' : 'Unpaid'}
                            </Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                setSelectedChargeForView(charge);
                                setIsViewChargeOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => {
                                setChargeToDelete(charge);
                                setIsDeleteChargeOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No extra charges found</p>
                    <Button
                      onClick={() => setIsAddChargeOpen(true)}
                      variant="outline"
                      size="sm"
                      className="mt-3"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add First Charge
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Add Charge Modal */}
        <Dialog open={isAddChargeOpen} onOpenChange={setIsAddChargeOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-600" />
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
                <Label>Package</Label>
                {allPackages && allPackages.length > 0 ? (
                  <Select
                    value={chargeFormData.selected_package_history_id}
                    onValueChange={(value) => setChargeFormData((prev) => ({ 
                      ...prev, 
                      selected_package_history_id: value
                    }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select package" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {allPackages.map((pkg, idx) => {
                        const cycleNumber = currentCycleNumber - idx;
                        const isCurrent = pkg.id === 'current' || (idx === 0 && currentPackageFromStudent);
                        return (
                          <SelectItem key={pkg.id} value={pkg.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {pkg.package_type || 'Package'} {cycleNumber}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">
                                  Current
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-3 rounded-lg border-2 border-muted bg-muted/50">
                    <p className="text-sm text-muted-foreground text-center">
                      No package found
                    </p>
                  </div>
                )}
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
                  <PopoverContent className="w-auto p-0 z-50" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={chargeFormData.charge_date || undefined}
                      onSelect={(date) => setChargeFormData(prev => ({ ...prev, charge_date: date || new Date() }))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
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
                    REC-{student.id.slice(0, 8).toUpperCase()}-{selectedPaymentForView.id.slice(0, 8).toUpperCase()}
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
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge 
                    variant={selectedChargeForView.is_paid ? "secondary" : "destructive"}
                    className={selectedChargeForView.is_paid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}
                  >
                    {selectedChargeForView.is_paid ? 'Paid' : 'Unpaid'}
                  </Badge>
                </div>
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
              isDownpayment: selectedPaymentForReceipt.payment_for === 'downpayment' || selectedPaymentForReceipt.id.startsWith('downpayment'),
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
