import { useState, useEffect, useRef } from "react";
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
  const latestSelectedPackageRef = useRef<string>(selectedPackageForPaymentInfo);
  latestSelectedPackageRef.current = selectedPackageForPaymentInfo;
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
        .select(`
          *,
          package_history:student_package_history (
            id,
            package_type,
            sessions,
            enrollment_date,
            expiration_date,
            captured_at
          )
        `)
        .eq("student_id", studentId)
        .order("charge_date", { ascending: false });
      if (error) throw error;
      return data as (StudentCharge & { package_history?: PackageHistory | null })[];
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
        .select("id, student_id, package_type, sessions, remaining_sessions, enrollment_date, expiration_date, captured_at, reason, total_training_fee, downpayment, remaining_balance")
        .eq("student_id", studentId)
        .order("captured_at", { ascending: false });
      if (error) throw error;
      return data as PackageHistory[];
    },
    enabled: !!studentId,
  });

  // Determine if student has a current package (always show if package_type exists)
  const hasCurrentPackage = student && student.package_type !== null && student.package_type !== '';
  
  // Create current package entry from student record (always show if exists)
  const currentPackageFromStudent: PackageHistory | null = hasCurrentPackage && student ? {
    id: 'current', // Special ID to identify current package
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

  // Combine current package with history (current first, then history)
  const allPackages: PackageHistory[] = currentPackageFromStudent 
    ? [currentPackageFromStudent, ...(packageHistory || [])]
    : (packageHistory || []);
  
  const currentCycleNumber = packageHistory ? packageHistory.length + (hasCurrentPackage ? 1 : 0) : (hasCurrentPackage ? 1 : 0);

  // Get package display helper (defined early so it can be used in charges section)
  const getPackageDisplay = (pkgHistory: PackageHistory | null | undefined, pkgHistoryId: string | null, chargeDate?: string) => {
    // Check if it's the current package
    if (pkgHistoryId === 'current' || (pkgHistory && pkgHistory.id === 'current')) {
      if (student && student.package_type) {
        const cycleNum = packageHistory ? packageHistory.length + 1 : 1;
        return `${student.package_type} ${cycleNum}`;
      }
      return null;
    }
    
    // If package_history_id is null, it means it was created for 'current' package
    // Show current package (no date matching needed)
    if (!pkgHistoryId && !pkgHistory) {
      if (student && student.package_type) {
        const cycleNum = packageHistory ? packageHistory.length + 1 : 1;
        return `${student.package_type} ${cycleNum}`;
      }
      return null;
    }
    
    // If we have the package history object directly, use it
    if (pkgHistory && pkgHistory.id) {
      const pkgIndex = allPackages.findIndex(p => p.id === pkgHistory.id);
      const cycleNumber = pkgIndex >= 0 ? currentCycleNumber - pkgIndex : (packageHistory?.findIndex(p => p.id === pkgHistory.id) ?? -1) >= 0 ? (packageHistory!.length - packageHistory!.findIndex(p => p.id === pkgHistory.id)) : 0;
      return `${pkgHistory.package_type || 'Package'} ${cycleNumber}`;
    }
    
    // If we only have the ID, look it up in allPackages (includes current and history, including expired)
    if (pkgHistoryId) {
      // First try allPackages (includes current package and all history, including expired)
      const pkg = allPackages.find(p => p.id === pkgHistoryId);
      if (pkg) {
        const pkgIndex = allPackages.findIndex(p => p.id === pkg.id);
        const cycleNumber = currentCycleNumber - pkgIndex;
        return `${pkg.package_type || 'Package'} ${cycleNumber}`;
      }
      // Fallback to packageHistory if not found in allPackages
      const pkgFromHistory = packageHistory?.find(p => p.id === pkgHistoryId);
      if (pkgFromHistory) {
        const pkgIndex = packageHistory.findIndex(p => p.id === pkgFromHistory.id);
        const cycleNumber = packageHistory.length - pkgIndex;
        return `${pkgFromHistory.package_type || 'Package'} ${cycleNumber}`;
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
  }, [currentPackageFromStudent, packageHistory]);

  // Calculate remaining balance for selected package
  // Current package: use student only (0 after new package; set via create-new-package).
  // Old/expired packages: use packageHistory only — never student, never zero out; keep stored values for tracking.
  useEffect(() => {
    if (!student || !selectedPackageForPaymentInfo) return;
    const selectedId = selectedPackageForPaymentInfo;

    const calculateRemainingBalance = async () => {
      let totalFee = 0;
      let downpayment = 0;
      let remainingBalance = 0;

      if (selectedId === 'current') {
        // Use the database's remaining_balance directly (which is updated when payments are made)
        totalFee = student.total_training_fee ?? 0;
        downpayment = student.downpayment ?? 0;
        remainingBalance = student.remaining_balance ?? 0;
      } else {
        const historyPkg = packageHistory?.find(p => p.id === selectedId);
        if (historyPkg) {
          // Use the database's remaining_balance directly (which is updated when payments are made)
          totalFee = historyPkg.total_training_fee ?? 0;
          downpayment = historyPkg.downpayment ?? 0;
          remainingBalance = historyPkg.remaining_balance ?? 0;
        } else {
          // Fallback: calculate from payments and charges if package not found
          let paymentsQuery = supabase
            .from("student_payments")
            .select("payment_amount, payment_for, charge_id, package_history_id")
            .eq("student_id", student.id);
          if (selectedId === 'current') {
            paymentsQuery = paymentsQuery.or('package_history_id.is.null,package_history_id.eq.null');
          } else {
            paymentsQuery = paymentsQuery.eq("package_history_id", selectedId);
          }
          const { data: existingPayments } = await paymentsQuery;

          let chargesQuery = supabase
            .from("student_charges")
            .select("amount, paid_amount, package_history_id")
            .eq("student_id", student.id);
          if (selectedId === 'current') {
            chargesQuery = chargesQuery.is("package_history_id", null);
            // Only include charges created on or after the current package's enrollment date
            // This prevents old charges from expired packages from being included
            if (student.enrollment_date) {
              chargesQuery = chargesQuery.gte("created_at", student.enrollment_date);
            }
          } else {
            chargesQuery = chargesQuery.eq("package_history_id", selectedId);
          }
          const { data: existingCharges } = await chargesQuery;

          const balancePayments = existingPayments?.filter(p =>
            p.payment_for === 'balance' &&
            (p.package_history_id === selectedId || (selectedId === 'current' && !p.package_history_id))
          ).reduce((sum, p) => sum + (p.payment_amount || 0), 0) || 0;

          // Calculate unpaid charges (charges that haven't been fully paid)
          // Only unpaid portion of charges should increase remaining balance
          const unpaidCharges = existingCharges?.filter(c =>
            c.package_history_id === selectedId || (selectedId === 'current' && !c.package_history_id)
          ).reduce((sum, c) => {
            const chargeAmount = c.amount || 0;
            const paidAmount = c.paid_amount || 0;
            const unpaidPortion = Math.max(0, chargeAmount - paidAmount);
            return sum + unpaidPortion;
          }, 0) || 0;

          remainingBalance = Math.max(0, totalFee - downpayment - balancePayments + unpaidCharges);
        }
      }

      if (latestSelectedPackageRef.current !== selectedId) return;
      setPaymentInfoFormData({
        total_training_fee: totalFee,
        downpayment: downpayment,
        remaining_balance: remainingBalance,
      });
    };

    calculateRemainingBalance();
  }, [student, studentCharges, selectedPackageForPaymentInfo, packageHistory]);

  // Initialize package selection when package history loads
  useEffect(() => {
    if (currentPackageFromStudent && paymentFormData.payment_type === "balance" && !paymentFormData.selected_package_history_id) {
      setPaymentFormData((prev) => ({
        ...prev,
        selected_package_history_id: currentPackageFromStudent.id,
      }));
    } else if (!currentPackageFromStudent && packageHistory && packageHistory.length > 0 && paymentFormData.payment_type === "balance" && !paymentFormData.selected_package_history_id) {
      // If no current package, select the most recent history entry
      setPaymentFormData((prev) => ({
        ...prev,
        selected_package_history_id: packageHistory[0].id,
      }));
    }
  }, [currentPackageFromStudent, packageHistory, paymentFormData.payment_type]);

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
  }, [currentPackageFromStudent, packageHistory]);

  const { data: studentPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["student-payments", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("student_payments")
        .select(`
          *,
          package_history:student_package_history (
            id,
            package_type,
            sessions,
            enrollment_date,
            expiration_date,
            captured_at
          )
        `)
        .eq("student_id", studentId)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data as (StudentPayment & { package_history?: PackageHistory | null })[];
    },
    enabled: !!studentId,
  });

  const addPaymentMutation = useMutation({
    mutationFn: async (payment: typeof paymentFormData & { student_id: string }) => {
      // Get package_history_id for extra charge payments from the charge
      let packageHistoryId: string | null = null;
      if (payment.payment_type === "extra_charge" && payment.selected_charge_id) {
        const charge = studentCharges?.find(c => c.id === payment.selected_charge_id);
        if (charge && charge.package_history_id) {
          packageHistoryId = charge.package_history_id !== 'current' ? charge.package_history_id : null;
        }
      } else if (payment.payment_type === "balance" && payment.selected_package_history_id && payment.selected_package_history_id !== 'current') {
        packageHistoryId = payment.selected_package_history_id;
      }
      // For 'current' package, packageHistoryId remains null (which represents current package)

      const { data, error } = await supabase
        .from("student_payments")
        .insert([{
          student_id: payment.student_id,
          payment_amount: payment.payment_amount,
          payment_date: format(payment.payment_date, 'yyyy-MM-dd\'T\'HH:mm:ss'),
          notes: payment.notes?.trim() || null,
          payment_for: payment.payment_type,
          charge_id: payment.payment_type === "extra_charge" && payment.selected_charge_id ? payment.selected_charge_id : null,
          package_history_id: packageHistoryId,
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
      
      // Update remaining_balance for the correct package (student for current, package_history for old)
      if (payment.payment_type === "balance") {
        const targetPackageId = packageHistoryId; // null for current, UUID for old package
        
        if (targetPackageId) {
          // Update package_history record
          const { data: pkgHistory } = await supabase
            .from("student_package_history")
            .select("total_training_fee, downpayment, remaining_balance")
            .eq("id", targetPackageId)
            .single();
          
          if (pkgHistory) {
            // Get balance payments for this package (including the one we just inserted)
            const { data: pkgPayments } = await supabase
              .from("student_payments")
              .select("payment_amount, payment_for")
              .eq("student_id", payment.student_id)
              .eq("package_history_id", targetPackageId)
              .eq("payment_for", "balance");
            
            const balancePayments = pkgPayments?.reduce((sum, p) => sum + (p.payment_amount || 0), 0) || 0;
            
            // Get charges for this package (need amount and paid_amount to calculate unpaid portion)
            const { data: pkgCharges } = await supabase
              .from("student_charges")
              .select("amount, paid_amount")
              .eq("student_id", payment.student_id)
              .eq("package_history_id", targetPackageId);
            
            // Calculate unpaid charges (charges that haven't been fully paid)
            // Only unpaid portion of charges should increase remaining balance
            const unpaidCharges = pkgCharges?.reduce((sum, c) => {
              const chargeAmount = c.amount || 0;
              const paidAmount = c.paid_amount || 0;
              const unpaidPortion = Math.max(0, chargeAmount - paidAmount);
              return sum + unpaidPortion;
            }, 0) || 0;
            
            const remainingBalance = Math.max(0, 
              (pkgHistory.total_training_fee || 0) - 
              (pkgHistory.downpayment || 0) - 
              balancePayments + 
              unpaidCharges
            );
            
            const { error: updateError } = await supabase
              .from("student_package_history")
              .update({ remaining_balance: remainingBalance } as Record<string, any>)
              .eq("id", targetPackageId);
            
            if (updateError) {
              console.error("Failed to update package history remaining balance:", updateError);
              throw new Error("Payment recorded but failed to update remaining balance: " + updateError.message);
            }
          }
        } else {
          // Update student record (current package)
          const { data: currentStudent } = await supabase
            .from("students")
            .select("total_training_fee, downpayment, remaining_balance, enrollment_date")
            .eq("id", payment.student_id)
            .single();
          
          if (currentStudent) {
            // Get balance payments for current package (package_history_id is null, including the one we just inserted)
            const { data: currentPayments } = await supabase
              .from("student_payments")
              .select("payment_amount, payment_for")
              .eq("student_id", payment.student_id)
              .is("package_history_id", null)
              .eq("payment_for", "balance");
            
            const balancePayments = currentPayments?.reduce((sum, p) => sum + (p.payment_amount || 0), 0) || 0;
            
            // Get charges for current package (package_history_id is null, need amount and paid_amount)
            // Filter by enrollment_date to exclude old charges from expired packages
            let currentChargesQuery = supabase
              .from("student_charges")
              .select("amount, paid_amount")
              .eq("student_id", payment.student_id)
              .is("package_history_id", null);
            
            // Only include charges created on or after the current package's enrollment date
            // This prevents old charges from expired packages from being included
            if (currentStudent.enrollment_date) {
              currentChargesQuery = currentChargesQuery.gte("created_at", currentStudent.enrollment_date);
            }
            
            const { data: currentCharges } = await currentChargesQuery;
            
            // Calculate unpaid charges (charges that haven't been fully paid)
            // Only unpaid portion of charges should increase remaining balance
            const unpaidCharges = currentCharges?.reduce((sum, c) => {
              const chargeAmount = c.amount || 0;
              const paidAmount = c.paid_amount || 0;
              const unpaidPortion = Math.max(0, chargeAmount - paidAmount);
              return sum + unpaidPortion;
            }, 0) || 0;
            
            const remainingBalance = Math.max(0,
              (currentStudent.total_training_fee || 0) -
              (currentStudent.downpayment || 0) -
              balancePayments +
              unpaidCharges
            );
            
            const { error: updateError } = await supabase
              .from("students")
              .update({ remaining_balance: remainingBalance })
              .eq("id", payment.student_id);
            
            if (updateError) {
              console.error("Failed to update student remaining balance:", updateError);
              throw new Error("Payment recorded but failed to update remaining balance: " + updateError.message);
            }
          }
        }
      }
      
      return data;
    },
    onSuccess: async (data) => {
      // Invalidate and refetch queries to refresh data - this will trigger useEffect to recalculate
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({ queryKey: ["student-payments", studentId] }),
        queryClient.invalidateQueries({ queryKey: ["student-charges", studentId] }),
        queryClient.invalidateQueries({ queryKey: ["student", studentId] }),
        queryClient.invalidateQueries({ queryKey: ["student-package-history", studentId] }),
      ]);
      
      // Explicitly refetch to ensure fresh data
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["student", studentId] }),
        queryClient.refetchQueries({ queryKey: ["student-package-history", studentId] }),
        queryClient.refetchQueries({ queryKey: ["student-payments", studentId] }),
      ]);
      
      toast.success("Payment recorded successfully");
      
      setSelectedPaymentForReceipt({
        id: data.id,
        student_id: data.student_id,
        payment_amount: data.payment_amount,
        extra_charges: data.extra_charges || 0,
        charge_description: data.charge_description || null,
        payment_date: data.payment_date,
        notes: data.notes || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        payment_for: data.payment_for,
        charge_id: data.charge_id || null,
        package_history_id: data.package_history_id || null,
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
      let paymentsQuery = supabase
        .from("student_payments")
        .select("payment_amount, payment_for, package_history_id")
        .eq("student_id", paymentInfo.student_id);
      
      if (paymentInfo.package_id === 'current') {
        paymentsQuery = paymentsQuery.is("package_history_id", null);
      } else {
        paymentsQuery = paymentsQuery.eq("package_history_id", paymentInfo.package_id);
      }
      
      const { data: existingPayments } = await paymentsQuery;
      
      // Get charges for this specific package (need amount and paid_amount)
      // Get student enrollment_date for date filtering
      const { data: studentData } = await supabase
        .from("students")
        .select("enrollment_date")
        .eq("id", paymentInfo.student_id)
        .single();
      
      let chargesQuery = supabase
        .from("student_charges")
        .select("amount, paid_amount, package_history_id")
        .eq("student_id", paymentInfo.student_id);
      
      if (paymentInfo.package_id === 'current') {
        chargesQuery = chargesQuery.is("package_history_id", null);
        // Only include charges created on or after the current package's enrollment date
        // This prevents old charges from expired packages from being included
        if (studentData?.enrollment_date) {
          chargesQuery = chargesQuery.gte("created_at", studentData.enrollment_date);
        }
      } else {
        chargesQuery = chargesQuery.eq("package_history_id", paymentInfo.package_id);
      }
      
      const { data: existingCharges } = await chargesQuery;
      
      // Calculate balance payments for this package (only balance payments, not extra charges)
      const balancePayments = existingPayments?.filter(p => 
        p.payment_for === 'balance'
      ).reduce((sum, p) => sum + (p.payment_amount || 0), 0) || 0;
      
      // Calculate unpaid charges (charges that haven't been fully paid)
      // Only unpaid portion of charges should increase remaining balance
      const unpaidCharges = existingCharges?.reduce((sum, c) => {
        const chargeAmount = c.amount || 0;
        const paidAmount = c.paid_amount || 0;
        const unpaidPortion = Math.max(0, chargeAmount - paidAmount);
        return sum + unpaidPortion;
      }, 0) || 0;
      
      const remainingBalance = Math.max(0, totalFee - downpayment - balancePayments + unpaidCharges);
      
      // Update the appropriate record based on package_id
      if (paymentInfo.package_id === 'current') {
        // Update student record for current package
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
        // Update package history record
        const { data, error } = await supabase
          .from("student_package_history")
          .update({
            total_training_fee: totalFee,
            downpayment: downpayment,
            remaining_balance: remainingBalance,
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

  // Calculate unpaid charges for selected package (only unpaid portion should affect balance)
  const unpaidChargesForSelectedPackage = selectedPackageForPaymentInfo 
    ? (studentCharges?.filter(c => {
        if (selectedPackageForPaymentInfo === 'current') {
          // For current package, only include charges with null package_history_id
          // AND created on or after the current package's enrollment date
          // This prevents old charges from expired packages from being included
          if (c.package_history_id) return false;
          if (student?.enrollment_date && c.created_at) {
            const chargeDate = new Date(c.created_at);
            const enrollmentDate = new Date(student.enrollment_date);
            return chargeDate >= enrollmentDate;
          }
          return true; // If no enrollment date, include all null charges (fallback)
        }
        return c.package_history_id === selectedPackageForPaymentInfo;
      }).reduce((sum, c) => {
        const chargeAmount = c.amount || 0;
        const paidAmount = c.paid_amount || 0;
        const unpaidPortion = Math.max(0, chargeAmount - paidAmount);
        return sum + unpaidPortion;
      }, 0) || 0)
    : 0;

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pt-4 p-3 sm:p-4 md:p-6 pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Enhanced Header Section */}
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
                      <SelectContent>
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
                                {pkg.enrollment_date && (
                                  <span className="text-xs text-gray-500">
                                    {format(new Date(pkg.enrollment_date), 'MMM yyyy')}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-3 rounded-lg border-2 border-gray-200 bg-gray-50">
                      <p className="text-sm text-gray-600 text-center">
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
                        remaining_balance: Math.max(0, value - downpayment + unpaidChargesForSelectedPackage),
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
                        remaining_balance: Math.max(0, totalFee - value + unpaidChargesForSelectedPackage),
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
                {unpaidChargesForSelectedPackage > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Extra Charges: ₱{unpaidChargesForSelectedPackage.toFixed(2)}</span>
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
                  }} className="space-y-5 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col space-y-2 min-w-0">
                        <Label htmlFor="payment_type" className="text-muted-foreground font-medium text-xs sm:text-sm">
                          Payment For
                        </Label>
                        <Select
                          value={paymentFormData.payment_type}
                          onValueChange={(value: "balance" | "extra_charge") => setPaymentFormData((prev) => ({ 
                            ...prev, 
                            payment_type: value,
                            selected_charge_id: "",
                            selected_package_history_id: value === "balance" && currentPackageFromStudent ? currentPackageFromStudent.id : (value === "balance" && packageHistory && packageHistory.length > 0 ? packageHistory[0].id : ""),
                            payment_amount: 0
                          }))}
                        >
                          <SelectTrigger className="h-10 border-2 border-accent/60 rounded-lg text-xs sm:text-sm hover:border-accent transition-colors shadow-sm bg-background">
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="balance">
                              <div className="flex items-center gap-2 py-1">
                                <Wallet className="w-4 h-4 text-green-600" />
                                <span className="font-medium">Training Balance</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="extra_charge">
                              <div className="flex items-center gap-2 py-1">
                                <FileText className="w-4 h-4 text-amber-600" />
                                <span className="font-medium">Specific Extra Charge</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Show charge selector when paying for extra charge */}
                      {paymentFormData.payment_type === "extra_charge" ? (
                        <>
                          <div className="flex flex-col space-y-2 min-w-0">
                            <Label className="text-muted-foreground font-medium text-xs sm:text-sm">
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
                                <SelectTrigger className="h-10 border-2 border-amber-400/60 rounded-lg text-xs sm:text-sm hover:border-amber-400 transition-colors shadow-sm bg-background">
                                  <SelectValue placeholder="Select a charge" />
                                </SelectTrigger>
                                <SelectContent>
                                  {studentCharges.filter(c => !c.is_paid).map((charge) => {
                                    // Get package information for the charge
                                    const chargeData = charge as any;
                                    let chargePkg: PackageHistory | null = null;
                                    if (chargeData.package_history) {
                                      if (Array.isArray(chargeData.package_history) && chargeData.package_history.length > 0) {
                                        chargePkg = chargeData.package_history[0];
                                      } else if (!Array.isArray(chargeData.package_history)) {
                                        chargePkg = chargeData.package_history;
                                      }
                                    }
                                    const chargePkgId = charge.package_history_id;
                                    const pkgDisplay = getPackageDisplay(chargePkg, chargePkgId, charge.charge_date);
                                    
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
                                            <div className="flex items-center gap-1">
                                              <span className="text-xs text-purple-600 font-medium">
                                                Package: {pkgDisplay}
                                              </span>
                                            </div>
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
                          {/* Payment Amount for Extra Charge */}
                          {paymentFormData.selected_charge_id && (
                            <div className="flex flex-col space-y-2 min-w-0">
                              <Label htmlFor="payment_amount" className="text-muted-foreground font-medium text-xs sm:text-sm">
                                Payment Amount
                              </Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-muted-foreground font-medium">₱</span>
                                <Input
                                  id="payment_amount"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={paymentFormData.payment_amount}
                                  onChange={(e) => setPaymentFormData((prev) => ({ ...prev, payment_amount: parseFloat(e.target.value) || 0 }))}
                                  required
                                  placeholder="0.00"
                                  className="h-10 pl-7 pr-3 w-full border-2 border-amber-400/60 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-xs sm:text-sm shadow-sm transition-all"
                                />
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Package Selection for Balance Payment */}
                          <div className="flex flex-col space-y-2 min-w-0">
                            <Label className="text-muted-foreground font-medium text-xs sm:text-sm">
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
                                <SelectTrigger className="h-10 border-2 border-accent/60 rounded-lg text-xs sm:text-sm hover:border-accent transition-colors shadow-sm bg-background">
                                  <SelectValue placeholder="Select package" />
                                </SelectTrigger>
                                <SelectContent>
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
                                          {pkg.enrollment_date && (
                                            <span className="text-xs text-gray-500">
                                              {format(new Date(pkg.enrollment_date), 'MMM yyyy')}
                                            </span>
                                          )}
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="p-3 rounded-lg border-2 border-gray-200 bg-gray-50">
                                <p className="text-sm text-gray-600 text-center">
                                  No package found
                                </p>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      
                      {/* Payment Amount */}
                      <div className="flex flex-col space-y-2 min-w-0">
                        <Label htmlFor="payment_amount" className="text-muted-foreground font-medium text-xs sm:text-sm">
                          Payment Amount
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-muted-foreground font-medium">₱</span>
                          <Input
                            id="payment_amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={paymentFormData.payment_amount}
                            onChange={(e) => setPaymentFormData((prev) => ({ ...prev, payment_amount: parseFloat(e.target.value) || 0 }))}
                            required
                            placeholder="0.00"
                            className="h-10 pl-7 pr-3 w-full border-2 border-accent/60 rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/20 text-xs sm:text-sm shadow-sm transition-all"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col space-y-2 min-w-0">
                        <Label className="text-muted-foreground font-medium text-xs sm:text-sm">Payment Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                                "h-10 w-full justify-start text-left font-normal border-2 border-accent/60 rounded-lg text-xs sm:text-sm hover:border-accent transition-colors shadow-sm",
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
                        <Label htmlFor="payment_notes" className="text-muted-foreground font-medium text-xs sm:text-sm">
                      Notes (Optional)
                    </Label>
                    <Input
                      id="payment_notes"
                      value={paymentFormData.notes}
                      onChange={(e) => setPaymentFormData((prev) => ({ ...prev, notes: e.target.value }))}
                          placeholder="Additional notes..."
                          className="h-10 border-2 border-accent/60 rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/20 w-full text-xs sm:text-sm shadow-sm transition-all"
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
                      
                      {paymentFormData.payment_type === "balance" && (() => {
                        // Calculate remaining balance for the selected package in payment form
                        const selectedPackageId = paymentFormData.selected_package_history_id;
                        let previewRemainingBalance = 0;
                        
                        if (selectedPackageId === 'current' || !selectedPackageId) {
                          // Use current package's remaining balance
                          previewRemainingBalance = student?.remaining_balance ?? 0;
                        } else {
                          // Find the package in history
                          const selectedPkg = packageHistory?.find(p => p.id === selectedPackageId);
                          if (selectedPkg) {
                            previewRemainingBalance = selectedPkg.remaining_balance ?? 0;
                          }
                        }
                        
                        return (
                          <div className="space-y-2 text-sm">
                            {selectedPackageId && (() => {
                              const selectedPkg = allPackages.find(p => p.id === selectedPackageId);
                              const pkgIndex = allPackages.findIndex(p => p.id === selectedPackageId);
                              const cycleNumber = pkgIndex >= 0 ? currentCycleNumber - pkgIndex : 0;
                              return selectedPkg ? (
                                <div className="mb-3 p-2 bg-white/50 rounded border border-green-200">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-600">Package:</span>
                                    <span className="font-semibold text-green-700">
                                      {selectedPkg.package_type || 'Package'} {cycleNumber}
                                      {selectedPkg.id === 'current' && (
                                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">
                                          Current
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  {selectedPkg.enrollment_date && (
                                    <div className="flex items-center justify-between mt-1">
                                      <span className="text-xs text-gray-500">Enrolled:</span>
                                      <span className="text-xs text-gray-600">
                                        {format(new Date(selectedPkg.enrollment_date), 'MMM dd, yyyy')}
                                      </span>
                                    </div>
                                  )}
                                  {selectedPkg.expiration_date && (
                                    <div className="flex items-center justify-between mt-1">
                                      <span className="text-xs text-gray-500">Expires:</span>
                                      <span className="text-xs text-gray-600">
                                        {format(new Date(selectedPkg.expiration_date), 'MMM dd, yyyy')}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : null;
                            })()}
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Current Balance:</span>
                              <span className="font-medium">₱{previewRemainingBalance.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-green-600">
                              <span>Payment Amount:</span>
                              <span className="font-medium">- ₱{paymentFormData.payment_amount.toFixed(2)}</span>
                            </div>
                            <div className="border-t border-green-300 dark:border-green-700 pt-2 mt-2">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-green-700">After Payment:</span>
                                <span className="font-bold text-lg text-green-700">
                                  ₱{Math.max(0, previewRemainingBalance - paymentFormData.payment_amount).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      
                      {paymentFormData.payment_type === "extra_charge" && paymentFormData.selected_charge_id && (
                        <div className="space-y-2 text-sm">
                          {(() => {
                            const selectedCharge = studentCharges?.find(c => c.id === paymentFormData.selected_charge_id);
                            if (!selectedCharge) return null;
                            
                            const chargeAmount = selectedCharge.amount || 0;
                            const paidAmount = selectedCharge.paid_amount || 0;
                            const remainingCharge = chargeAmount - paidAmount;
                            const afterPayment = Math.max(0, remainingCharge - paymentFormData.payment_amount);
                            
                            // Get package information for the charge
                            const chargeData = selectedCharge as any;
                            let chargePkg: PackageHistory | null = null;
                            if (chargeData.package_history) {
                              if (Array.isArray(chargeData.package_history) && chargeData.package_history.length > 0) {
                                chargePkg = chargeData.package_history[0];
                              } else if (!Array.isArray(chargeData.package_history)) {
                                chargePkg = chargeData.package_history;
                              }
                            }
                            const chargePkgId = selectedCharge.package_history_id;
                            const pkgDisplay = getPackageDisplay(chargePkg, chargePkgId, selectedCharge.charge_date);
                            
                            return (
                              <>
                                {pkgDisplay && (
                                  <div className="mb-3 p-2 bg-white/50 rounded border border-amber-200">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-gray-600">Package:</span>
                                      <span className="font-semibold text-amber-700">
                                        {pkgDisplay}
                                      </span>
                                    </div>
                                  </div>
                                )}
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
                      {/* Desktop: table with design */}
                      <div className="hidden lg:block overflow-x-auto rounded-lg border border-amber-200/50 shadow-sm">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-b-2 border-amber-200 dark:border-amber-800">
                              <th className="py-3 px-4 text-left text-sm font-bold text-amber-900 dark:text-amber-200">Date</th>
                              <th className="py-3 px-4 text-left text-sm font-bold text-amber-900 dark:text-amber-200">Description</th>
                              <th className="py-3 px-4 text-left text-sm font-bold text-amber-900 dark:text-amber-200">Package</th>
                              <th className="py-3 px-4 text-right text-sm font-bold text-amber-900 dark:text-amber-200">Amount</th>
                              <th className="py-3 px-4 text-right text-sm font-bold text-amber-900 dark:text-amber-200">Paid</th>
                              <th className="py-3 px-4 text-center text-sm font-bold text-amber-900 dark:text-amber-200">Status</th>
                              <th className="py-3 px-4 text-right text-sm font-bold text-amber-900 dark:text-amber-200">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentCharges.map((charge, index) => {
                              const remainingAmount = charge.amount - (charge.paid_amount || 0);
                              const chargeData = charge as any;
                              let chargePkg: PackageHistory | null = null;
                              
                              // Get package from relation if available
                              if (chargeData.package_history) {
                                if (!Array.isArray(chargeData.package_history)) {
                                  chargePkg = chargeData.package_history;
                                } else if (Array.isArray(chargeData.package_history) && chargeData.package_history.length > 0) {
                                  chargePkg = chargeData.package_history[0];
                                }
                              }
                              
                              const chargePkgId = charge.package_history_id;
                              const pkgDisplay = getPackageDisplay(chargePkg, chargePkgId, charge.charge_date);
                              return (
                                <tr
                                  key={charge.id}
                                  className={cn(
                                    "border-b border-amber-100/50 dark:border-amber-900/30 transition-colors hover:bg-amber-50/50 dark:hover:bg-amber-950/20",
                                    index % 2 === 0 ? "bg-white dark:bg-card" : "bg-amber-50/30 dark:bg-amber-950/10"
                                  )}
                                >
                                  <td className="py-3 px-4 text-sm whitespace-nowrap font-medium">
                                    {format(new Date(charge.charge_date), "MMM d, yyyy")}
                                  </td>
                                  <td className="py-3 px-4 text-sm font-semibold text-foreground">
                                    {charge.description || "Extra charge"}
                                  </td>
                                  <td className="py-3 px-4">
                                    {pkgDisplay ? (
                                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                        {pkgDisplay}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">—</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-sm font-bold text-amber-600 dark:text-amber-500 text-right">₱{charge.amount.toFixed(2)}</td>
                                  <td className="py-3 px-4 text-sm font-semibold text-green-600 dark:text-green-500 text-right">₱{(charge.paid_amount || 0).toFixed(2)}</td>
                                  <td className="py-3 px-4 text-center">
                                    {charge.is_paid ? (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                        Paid
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                        ₱{remainingAmount.toFixed(2)} due
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center justify-end gap-2">
                                      {!charge.is_paid && (
                                        <Button
                                          size="sm"
                                          className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold shadow-sm hover:shadow"
                                          onClick={() => {
                                            setActiveTab("payments");
                                            setPaymentFormData({
                                              payment_amount: remainingAmount,
                                              payment_type: "extra_charge",
                                              selected_charge_id: charge.id,
                                              selected_package_history_id: "",
                                              payment_date: new Date(),
                                              notes: "",
                                            });
                                          }}
                                        >
                                          Pay
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
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

                      {/* Mobile: cards with design */}
                      <div className="lg:hidden space-y-3">
                        {studentCharges.map((charge) => {
                          const remainingAmount = charge.amount - (charge.paid_amount || 0);
                          const chargeData = charge as any;
                          let chargePkg: PackageHistory | null = null;
                          if (chargeData.package_history) {
                            if (Array.isArray(chargeData.package_history) && chargeData.package_history.length > 0) {
                              chargePkg = chargeData.package_history[0];
                            } else if (!Array.isArray(chargeData.package_history)) {
                              chargePkg = chargeData.package_history;
                            }
                          }
                          const chargePkgId = charge.package_history_id;
                          let pkgDisplay = getPackageDisplay(chargePkg, chargePkgId, charge.charge_date);
                          
                          // If no display and package_history_id is null, show current package
                          if (!pkgDisplay && !charge.package_history_id && student && student.package_type) {
                            const cycleNum = packageHistory ? packageHistory.length + 1 : 1;
                            pkgDisplay = `${student.package_type} ${cycleNum}`;
                          }
                          
                          return (
                            <div
                              key={charge.id}
                              className={cn(
                                "border-2 rounded-lg p-4 space-y-3 shadow-sm transition-all",
                                charge.is_paid 
                                  ? "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20" 
                                  : "border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20"
                              )}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-bold text-foreground">{charge.description || "Extra charge"}</p>
                                  <p className="text-sm text-muted-foreground mt-1">{format(new Date(charge.charge_date), "MMM d, yyyy")}</p>
                                  {pkgDisplay && (
                                    <span className="inline-flex items-center px-2 py-0.5 mt-2 rounded-md text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                      {pkgDisplay}
                                    </span>
                                  )}
                                </div>
                                {charge.is_paid ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                    Paid
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                    ₱{remainingAmount.toFixed(2)} due
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm p-2 rounded-md bg-white/50 dark:bg-black/20">
                                <span className="font-medium">Amount: <span className="font-bold text-amber-600">₱{charge.amount.toFixed(2)}</span></span>
                                <span className="font-medium">Paid: <span className="font-bold text-green-600">₱{(charge.paid_amount || 0).toFixed(2)}</span></span>
                              </div>
                              <div className="flex gap-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                                {!charge.is_paid && (
                                  <Button
                                    size="sm"
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold shadow-sm"
                                    onClick={() => {
                                      setActiveTab("payments");
                                      setPaymentFormData({
                                        payment_amount: remainingAmount,
                                        payment_type: "extra_charge",
                                        selected_charge_id: charge.id,
                                        selected_package_history_id: "",
                                        payment_date: new Date(),
                                        notes: "",
                                      });
                                    }}
                                  >
                                    Pay
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:bg-destructive/10 border-destructive/30"
                                  onClick={() => { setChargeToDelete(charge); setIsDeleteChargeOpen(true); }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 border-2 border-amber-300/50 rounded-lg p-4 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-amber-900 dark:text-amber-200">Total Extra Charges</span>
                          <span className="text-xl font-extrabold text-amber-700 dark:text-amber-400">₱{(studentCharges?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0).toFixed(2)}</span>
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
                package_history_id: string | null;
                package_history?: PackageHistory | null;
                isDownpayment: boolean;
              }> = [];

              // Add downpayment from current package (student record)
              if (student.downpayment && student.downpayment > 0) {
                const dpDate = student.enrollment_date || student.created_at || new Date().toISOString();
                allPayments.push({
                  id: 'downpayment-current',
                  payment_amount: student.downpayment,
                  payment_date: dpDate,
                  created_at: dpDate,
                  notes: null,
                  payment_for: 'downpayment',
                  charge_id: null,
                  package_history_id: 'current',
                  package_history: currentPackageFromStudent,
                  isDownpayment: true,
                });
              }

              // Add downpayments from historical packages
              if (packageHistory && packageHistory.length > 0) {
                packageHistory.forEach((pkg) => {
                  if (pkg.downpayment && pkg.downpayment > 0) {
                    const dpDate = pkg.enrollment_date || pkg.captured_at || new Date().toISOString();
                    allPayments.push({
                      id: `downpayment-${pkg.id}`,
                      payment_amount: pkg.downpayment,
                      payment_date: dpDate,
                      created_at: dpDate,
                      notes: null,
                      payment_for: 'downpayment',
                      charge_id: null,
                      package_history_id: pkg.id,
                      package_history: pkg,
                      isDownpayment: true,
                    });
                  }
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
                    package_history_id: payment.package_history_id || null,
                    package_history: (payment as any).package_history || null,
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
                  <div className="hidden md:block overflow-x-auto rounded-lg border-2 border-border bg-card shadow-sm">
                    <table className="w-full min-w-[900px] border-collapse">
                  <thead className="bg-gradient-to-r from-[#242833] to-[#1a1d24] text-[#efeff1] border-b-2 border-accent/30">
                    <tr>
                          <th className="py-4 px-4 text-left font-bold text-xs sm:text-sm uppercase tracking-wider">Date</th>
                          <th className="py-4 px-4 text-left font-bold text-xs sm:text-sm uppercase tracking-wider">Receipt #</th>
                          <th className="py-4 px-4 text-left font-bold text-xs sm:text-sm uppercase tracking-wider">Amount</th>
                          <th className="py-4 px-4 text-left font-bold text-xs sm:text-sm uppercase tracking-wider">Payment For</th>
                          <th className="py-4 px-4 text-left font-bold text-xs sm:text-sm uppercase tracking-wider">Package</th>
                      <th className="py-4 px-4 text-left font-bold text-xs sm:text-sm uppercase tracking-wider">Notes</th>
                          <th className="py-4 px-4 text-left font-bold text-xs sm:text-sm uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPayments.map((payment, index) => (
                      <tr
                        key={payment.id}
                            className={cn(
                              "border-b border-border/40 transition-all duration-200",
                              payment.isDownpayment 
                                ? "bg-gradient-to-r from-blue-50/80 to-blue-100/40 dark:from-blue-950/30 dark:to-blue-900/10 hover:from-blue-100 hover:to-blue-150 dark:hover:from-blue-950/40 dark:hover:to-blue-900/20" 
                                : payment.payment_for === 'extra_charge'
                                  ? "bg-gradient-to-r from-amber-50/60 to-amber-100/30 dark:from-amber-950/15 dark:to-amber-900/5 hover:from-amber-100/80 hover:to-amber-150/50 dark:hover:from-amber-950/25 dark:hover:to-amber-900/15"
                                  : index % 2 === 0 ? "bg-card hover:bg-muted/40" : "bg-muted/30 hover:bg-muted/60"
                            )}
                          >
                            <td className="py-4 px-4 text-foreground text-sm font-semibold whitespace-nowrap">
                              {format(new Date(payment.created_at), "MMM dd, yyyy h:mm a")}
                            </td>
                            <td className="py-4 px-4 text-muted-foreground text-sm font-mono font-medium">
                          {payment.isDownpayment 
                            ? `REC-${student.id.slice(0, 8).toUpperCase()}-DP`
                            : `REC-${student.id.slice(0, 8).toUpperCase()}-${payment.id.slice(0, 8).toUpperCase()}`
                          }
                        </td>
                            <td className="py-4 px-4 text-foreground text-sm font-bold text-green-600 dark:text-green-500">
                          ₱{payment.payment_amount.toFixed(2)}
                        </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                            {payment.isDownpayment ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 dark:from-blue-900/50 dark:to-blue-800/30 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50">
                                <DollarSign className="w-3.5 h-3.5" />
                                Downpayment
                              </span>
                            ) : payment.payment_for === 'extra_charge' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 dark:from-amber-900/50 dark:to-amber-800/30 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                                  <FileText className="w-3.5 h-3.5" />
                                  {getChargeDescription(payment.charge_id) || 'Extra Charge'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-green-100 to-green-50 text-green-700 dark:from-green-900/50 dark:to-green-800/30 dark:text-green-300 border border-green-200 dark:border-green-700/50">
                                  <Wallet className="w-3.5 h-3.5" />
                                  Training Balance
                                </span>
                              )}
                        </td>
                            <td className="py-4 px-4">
                              {payment.isDownpayment ? (
                                (() => {
                                  // For downpayment, get package from package_history_id
                                  // Try getPackageDisplay first, then fallback to direct lookup
                                  let pkgDisplay = getPackageDisplay(payment.package_history, payment.package_history_id, payment.payment_date);
                                  
                                  // If still no display and we have package_history_id, try direct lookup
                                  if (!pkgDisplay && payment.package_history_id) {
                                    const pkg = allPackages.find(p => p.id === payment.package_history_id);
                                    if (pkg) {
                                      const pkgIndex = allPackages.findIndex(p => p.id === pkg.id);
                                      const cycleNumber = currentCycleNumber - pkgIndex;
                                      pkgDisplay = `${pkg.package_type || 'Package'} ${cycleNumber}`;
                                    }
                                  }
                                  
                                  // Fallback for current package
                                  if (!pkgDisplay && payment.package_history_id === 'current' && student && student.package_type) {
                                    const cycleNum = packageHistory ? packageHistory.length + 1 : 1;
                                    pkgDisplay = `${student.package_type} ${cycleNum}`;
                                  }
                                  
                                  return pkgDisplay ? (
                                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-100 to-purple-50 text-purple-700 dark:from-purple-900/40 dark:to-purple-800/20 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50">
                                      {pkgDisplay}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-xs font-medium">—</span>
                                  );
                                })()
                              ) : payment.payment_for === 'balance' && !payment.isDownpayment ? (
                                (() => {
                                  // Use ONLY stored package_history_id - never infer from date
                                  // This ensures payments stay linked to their original package even after expiration
                                  let pkgDisplay = null;
                                  
                                  if (payment.package_history_id) {
                                    // Payment has explicit package_history_id - use it
                                    const historyPkg = packageHistory?.find(p => p.id === payment.package_history_id);
                                    if (historyPkg) {
                                      const pkgIndex = packageHistory.findIndex(p => p.id === historyPkg.id);
                                      const cycleNumber = packageHistory.length - pkgIndex;
                                      pkgDisplay = `${historyPkg.package_type || 'Package'} ${cycleNumber}`;
                                    } else {
                                      // Try allPackages as fallback (includes current)
                                      const pkg = allPackages.find(p => p.id === payment.package_history_id);
                                      if (pkg) {
                                        const pkgIndex = allPackages.findIndex(p => p.id === pkg.id);
                                        const cycleNumber = currentCycleNumber - pkgIndex;
                                        pkgDisplay = `${pkg.package_type || 'Package'} ${cycleNumber}`;
                                      }
                                    }
                                  } else {
                                    // package_history_id is null - this should be rare now since we update payments when archiving
                                    // Show current package as fallback (for payments made very recently before archiving completes)
                                    if (student && student.package_type) {
                                      const cycleNum = packageHistory ? packageHistory.length + 1 : 1;
                                      pkgDisplay = `${student.package_type} ${cycleNum}`;
                                    }
                                  }
                                  
                                  return pkgDisplay ? (
                                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-100 to-purple-50 text-purple-700 dark:from-purple-900/40 dark:to-purple-800/20 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50">
                                      {pkgDisplay}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-xs font-medium">—</span>
                                  );
                                })()
                              ) : payment.payment_for === 'extra_charge' && payment.charge_id ? (
                                (() => {
                                  // For extra charge payments, get package from the charge
                                  const charge = studentCharges?.find(c => c.id === payment.charge_id);
                                  if (charge) {
                                    const chargeData = charge as any;
                                    let chargePkg: PackageHistory | null = null;
                                    if (chargeData.package_history) {
                                      if (Array.isArray(chargeData.package_history) && chargeData.package_history.length > 0) {
                                        chargePkg = chargeData.package_history[0];
                                      } else if (!Array.isArray(chargeData.package_history)) {
                                        chargePkg = chargeData.package_history;
                                      }
                                    }
                                    const chargePkgId = charge.package_history_id;
                                    const pkgDisplay = getPackageDisplay(chargePkg, chargePkgId, charge.charge_date);
                                    return pkgDisplay ? (
                                      <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-100 to-purple-50 text-purple-700 dark:from-purple-900/40 dark:to-purple-800/20 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50">
                                        {pkgDisplay}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-xs font-medium">—</span>
                                    );
                                  }
                                  return <span className="text-gray-400 text-xs font-medium">—</span>;
                                })()
                              ) : (
                                <span className="text-gray-400 text-xs font-medium">—</span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-muted-foreground text-sm max-w-[200px]">
                              <span className="truncate block font-medium" title={payment.notes ?? ''}>
                                {payment.notes || '—'}
                              </span>
                            </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                              <div className="flex gap-2">
                          <Button
                            size="sm"
                                  variant="ghost"
                                  className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-all"
                            onClick={() => {
                              if (payment.isDownpayment) {
                                      setSelectedPaymentForView({
                                        id: payment.id,
                                        student_id: student.id,
                                        payment_amount: payment.payment_amount,
                                        extra_charges: 0,
                                        charge_description: null,
                                        payment_date: payment.payment_date,
                                        notes: 'Downpayment',
                                        created_at: payment.payment_date,
                                        updated_at: payment.payment_date,
                                        payment_for: 'downpayment',
                                        charge_id: null,
                                        package_history_id: payment.package_history_id,
                                      });
                                    } else {
                                      const regularPayment = studentPayments?.find(p => p.id === payment.id);
                                      if (regularPayment) {
                                        setSelectedPaymentForView(regularPayment);
                                      }
                                    }
                                    setIsViewPaymentOpen(true);
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
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
                                        package_history_id: payment.package_history_id,
                                      });
                              } else {
                                const regularPayment = studentPayments?.find(p => p.id === payment.id);
                                if (regularPayment) {
                                  setSelectedPaymentForReceipt(regularPayment);
                                }
                              }
                              setIsReceiptOpen(true);
                            }}
                                  className="h-9 w-9 p-0 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg transition-all rounded-lg"
                          >
                                  <Printer className="w-4 h-4" />
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
                                ? `REC-...${student.id.slice(0, 4).toUpperCase()}-DP${payment.package_history_id && payment.package_history_id !== 'current' ? `-${payment.package_history_id.slice(0, 4).toUpperCase()}` : ''}`
                                : `REC-...${payment.id.slice(0, 6).toUpperCase()}`
                              }
                            </p>
                          </div>
                          {payment.payment_for === 'extra_charge' && payment.charge_id ? (
                            <div>
                              <p className="text-xs text-muted-foreground">For</p>
                              <p className="text-xs font-medium text-amber-700">
                                {getChargeDescription(payment.charge_id)}
                              </p>
                            </div>
                          ) : null}
                        </div>
                        
                        {/* Package information for all payment types */}
                        <div>
                          <p className="text-xs text-muted-foreground">Package</p>
                          {payment.isDownpayment ? (
                            (() => {
                              // For downpayment, get package from package_history_id
                              let pkgDisplay = getPackageDisplay(payment.package_history, payment.package_history_id, payment.payment_date);
                              
                              // If still no display and we have package_history_id, try direct lookup
                              if (!pkgDisplay && payment.package_history_id) {
                                const pkg = allPackages.find(p => p.id === payment.package_history_id);
                                if (pkg) {
                                  const pkgIndex = allPackages.findIndex(p => p.id === pkg.id);
                                  const cycleNumber = currentCycleNumber - pkgIndex;
                                  pkgDisplay = `${pkg.package_type || 'Package'} ${cycleNumber}`;
                                }
                              }
                              
                              // Fallback for current package
                              if (!pkgDisplay && payment.package_history_id === 'current' && student && student.package_type) {
                                const cycleNum = packageHistory ? packageHistory.length + 1 : 1;
                                pkgDisplay = `${student.package_type} ${cycleNum}`;
                              }
                              
                              return pkgDisplay ? (
                                <p className="text-xs font-medium text-purple-700">
                                  {pkgDisplay}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400">—</p>
                              );
                            })()
                          ) : payment.payment_for === 'balance' && !payment.isDownpayment ? (
                            (() => {
                              // Use ONLY stored package_history_id - never infer from date
                              let pkgDisplay = null;
                              
                              if (payment.package_history_id) {
                                // Payment has explicit package_history_id - use it
                                const historyPkg = packageHistory?.find(p => p.id === payment.package_history_id);
                                if (historyPkg) {
                                  const pkgIndex = packageHistory.findIndex(p => p.id === historyPkg.id);
                                  const cycleNumber = packageHistory.length - pkgIndex;
                                  pkgDisplay = `${historyPkg.package_type || 'Package'} ${cycleNumber}`;
                                } else {
                                  // Try allPackages as fallback (includes current)
                                  const pkg = allPackages.find(p => p.id === payment.package_history_id);
                                  if (pkg) {
                                    const pkgIndex = allPackages.findIndex(p => p.id === pkg.id);
                                    const cycleNumber = currentCycleNumber - pkgIndex;
                                    pkgDisplay = `${pkg.package_type || 'Package'} ${cycleNumber}`;
                                  }
                                }
                              } else {
                                // package_history_id is null - this should be rare now since we update payments when archiving
                                // Show current package as fallback (for payments made very recently before archiving completes)
                                if (student && student.package_type) {
                                  const cycleNum = packageHistory ? packageHistory.length + 1 : 1;
                                  pkgDisplay = `${student.package_type} ${cycleNum}`;
                                }
                              }
                              
                              return pkgDisplay ? (
                                <p className="text-xs font-medium text-purple-700">
                                  {pkgDisplay}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400">—</p>
                              );
                            })()
                          ) : payment.payment_for === 'extra_charge' && payment.charge_id ? (
                            (() => {
                              // For extra charge payments, get package from the charge
                              const charge = studentCharges?.find(c => c.id === payment.charge_id);
                              if (charge) {
                                const chargeData = charge as any;
                                let chargePkg: PackageHistory | null = null;
                                if (chargeData.package_history) {
                                  if (Array.isArray(chargeData.package_history) && chargeData.package_history.length > 0) {
                                    chargePkg = chargeData.package_history[0];
                                  } else if (!Array.isArray(chargeData.package_history)) {
                                    chargePkg = chargeData.package_history;
                                  }
                                }
                                const chargePkgId = charge.package_history_id;
                                const pkgDisplay = getPackageDisplay(chargePkg, chargePkgId, charge.charge_date);
                                return pkgDisplay ? (
                                  <p className="text-xs font-medium text-purple-700">
                                    {pkgDisplay}
                                  </p>
                                ) : (
                                  <p className="text-xs text-gray-400">—</p>
                                );
                              }
                              return <p className="text-xs text-gray-400">—</p>;
                            })()
                          ) : (
                            <p className="text-xs text-gray-400">—</p>
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
                                  id: payment.id,
                                  student_id: student.id,
                                  payment_amount: payment.payment_amount,
                                  extra_charges: 0,
                                  charge_description: null,
                                  payment_date: payment.payment_date,
                                  notes: 'Downpayment',
                                  created_at: payment.payment_date,
                                  updated_at: payment.payment_date,
                                  payment_for: 'downpayment',
                                  charge_id: null,
                                  package_history_id: payment.package_history_id,
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
                                  id: payment.id,
                                  student_id: student.id,
                                  payment_amount: payment.payment_amount,
                                  extra_charges: 0,
                                  charge_description: null,
                                  payment_date: payment.payment_date,
                                  notes: 'Downpayment',
                                  created_at: payment.payment_date,
                                  updated_at: payment.payment_date,
                                  payment_for: 'downpayment',
                                  charge_id: null,
                                  package_history_id: payment.package_history_id,
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
                    <SelectContent>
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
                              {pkg.enrollment_date && (
                                <span className="text-xs text-gray-500">
                                  {format(new Date(pkg.enrollment_date), 'MMM yyyy')}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-3 rounded-lg border-2 border-gray-200 bg-gray-50">
                    <p className="text-sm text-gray-600 text-center">
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
                    {selectedPaymentForView.payment_for === 'downpayment' || selectedPaymentForView.id.startsWith('downpayment')
                      ? `REC-${student.id.slice(0, 8).toUpperCase()}-DP`
                      : `REC-${student.id.slice(0, 8).toUpperCase()}-${selectedPaymentForView.id.slice(0, 8).toUpperCase()}`
                    }
                  </p>
                </div>
                {selectedPaymentForView.payment_for === 'balance' && selectedPaymentForView.package_history_id && (() => {
                  const pkg = packageHistory?.find(p => p.id === selectedPaymentForView.package_history_id);
                  const pkgIndex = packageHistory?.findIndex(p => p.id === selectedPaymentForView.package_history_id) ?? -1;
                  const cycleNumber = pkgIndex >= 0 ? packageHistory!.length - pkgIndex : 0;
                  return pkg ? (
                    <div>
                      <p className="text-xs text-muted-foreground">Package</p>
                      <p className="text-sm font-medium text-purple-700">
                        {pkg.package_type || 'Package'} {cycleNumber}
                      </p>
                      {pkg.enrollment_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          Enrolled: {format(new Date(pkg.enrollment_date), 'MMM dd, yyyy')}
                        </p>
                      )}
                    </div>
                  ) : null;
                })()}
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
                {selectedChargeForView.package_history_id && (() => {
                  const chargePkg = studentCharges?.find(c => c.id === selectedChargeForView.id) as any;
                  const pkg = chargePkg?.package_history;
                  const pkgId = selectedChargeForView.package_history_id;
                  const pkgIndex = packageHistory?.findIndex(p => p.id === pkgId) ?? -1;
                  const cycleNumber = pkgId === 'current' 
                    ? (packageHistory ? packageHistory.length + 1 : 1)
                    : (pkgIndex >= 0 ? packageHistory!.length - pkgIndex : 0);
                  return pkg || pkgId ? (
                    <div>
                      <p className="text-xs text-muted-foreground">Package</p>
                      <p className="text-sm font-medium text-purple-700">
                        {pkgId === 'current' && student?.package_type
                          ? `${student.package_type} ${cycleNumber}`
                          : pkg
                          ? `${pkg.package_type || 'Package'} ${cycleNumber}`
                          : 'Package'}
                      </p>
                      {pkg?.enrollment_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          Enrolled: {format(new Date(pkg.enrollment_date), 'MMM dd, yyyy')}
                        </p>
                      )}
                    </div>
                  ) : null;
                })()}
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
