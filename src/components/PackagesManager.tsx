import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, Plus, Edit, Trash2, Filter, Search, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format, parseISO } from "date-fns";

interface Package {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export function PackagesManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
  });

  const queryClient = useQueryClient();

  const { data: packages, isLoading, error } = useQuery({
    queryKey: ["packages"],
    queryFn: async (): Promise<Package[]> => {
      const { data, error } = await (supabase as any)
        .from("packages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching packages:", error);
        toast.error(`Failed to fetch packages: ${error.message}`);
        throw error;
      }
      return (data ?? []).map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description || null,
        is_active: item.is_active ?? true,
        created_at: item.created_at || new Date().toISOString(),
      })) as Package[];
    },
    staleTime: 0,
    gcTime: 0,
  });

  const filteredPackages = packages?.filter((pkg) =>
    pkg.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalPages = Math.ceil(filteredPackages.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPackages = filteredPackages.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const createMutation = useMutation({
    mutationFn: async (packageData: typeof formData) => {
      const { data, error } = await (supabase as any)
        .from("packages")
        .insert([{
          ...packageData,
          description: packageData.description || null,
        }])
        .select()
        .single();
      if (error) {
        console.error("Create package error:", error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast.success("Package created successfully");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Failed to create package: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...packageData }: typeof formData & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("packages")
        .update({
          ...packageData,
          description: packageData.description || null,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) {
        console.error("Update package error:", error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast.success("Package updated successfully");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Failed to update package: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("packages")
        .delete()
        .eq("id", id);
      if (error) {
        console.error("Delete package error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast.success("Package deleted successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to delete package: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", is_active: true });
    setEditingPackage(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Package name is required");
      return;
    }
    if (editingPackage) {
      updateMutation.mutate({ ...formData, id: editingPackage.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (pkg: Package) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || "",
      is_active: pkg.is_active,
    });
    setIsDialogOpen(true);
  };

  const formatDate = (date: string): string => {
    try {
      return format(parseISO(date), "MMMM d, yyyy");
    } catch {
      return "Invalid date";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-2 sm:p-3 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <Package className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3">
            Loading packages...
          </h3>
          <p className="text-xs sm:text-sm md:text-lg text-gray-600">
            Please wait while we fetch the package data.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white p-2 sm:p-3 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <Package className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3">
            Error loading packages
          </h3>
          <p className="text-xs sm:text-sm md:text-lg text-gray-600">
            Failed to load package data. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-4 p-2 sm:p-3 md:p-6 pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#242833] mb-2 tracking-tight">
            Packages Manager
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-700">
            Manage training packages for Takeover Basketball
          </p>
        </div>

        <Card className="border-2 border-[#242833] bg-white shadow-xl">
          <CardHeader className="border-b border-[#242833] bg-[#242833] p-2 sm:p-3 md:p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div>
                <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                  <Package className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" style={{ color: "#79e58f" }} />
                  Package Management
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs sm:text-sm">
                  View and manage training packages
                </CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => resetForm()}
                    className="bg-accent text-white hover:bg-accent/90 transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                    style={{ backgroundColor: "#79e58f" }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Package
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
                  <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
                    <DialogTitle className="text-sm sm:text-base md:text-lg font-bold text-white flex items-center gap-2 sm:gap-3">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                        <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                      </div>
                      <span className="truncate">{editingPackage ? "Edit Package" : "Add New Package"}</span>
                    </DialogTitle>
                    <DialogDescription className="text-gray-300 text-xs sm:text-sm mt-1 ml-9 sm:ml-11 md:ml-13 hidden sm:block">
                      {editingPackage ? "Update package details" : "Add a new training package"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="p-3 sm:p-4 md:p-5 overflow-y-auto flex-1 custom-scrollbar">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="min-w-0">
                      <Label htmlFor="name" className="text-gray-700 font-medium text-xs sm:text-sm">
                        Package Name
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        required
                        className="mt-1 pl-4 pr-4 py-1.5 sm:py-2 border-2 border-accent rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-accent/20 bg-white"
                        style={{ borderColor: "#79e58f" }}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="description" className="text-gray-700 font-medium text-xs sm:text-sm">
                        Description
                      </Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe the package"
                        className="mt-1 pl-4 pr-4 py-1.5 sm:py-2 border-2 border-accent rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-accent/20 bg-white"
                        style={{ borderColor: "#79e58f" }}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="is_active" className="text-gray-700 font-medium text-xs sm:text-sm">
                        Active
                      </Label>
                      <div className="mt-1">
                        <input
                          type="checkbox"
                          id="is_active"
                          checked={formData.is_active}
                          onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                          className="h-4 w-4 text-accent focus:ring-accent border-gray-300 rounded"
                          style={{ accentColor: "#79e58f" }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-row justify-end gap-2 pt-4 border-t border-gray-200">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetForm}
                        className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 min-w-fit w-auto px-2 sm:px-3 text-xs sm:text-sm"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        className="bg-accent text-white hover:bg-accent/90 min-w-fit w-auto px-2 sm:px-3 text-xs sm:text-sm"
                        style={{ backgroundColor: "#79e58f" }}
                      >
                        {createMutation.isPending || updateMutation.isPending ? "Processing..." : editingPackage ? "Update" : "Create"}
                      </Button>
                    </div>
                  </form>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-3 md:p-4">
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <Filter className="h-4 sm:h-5 w-4 sm:w-5 text-accent mr-2" style={{ color: "#79e58f" }} />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  Filter Packages
                </h3>
              </div>
              <div className="relative max-w-md min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search packages..."
                  className="pl-10 pr-4 py-1.5 sm:py-2 w-full border-2 border-accent rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-accent/20 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ borderColor: "#79e58f" }}
                />
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mt-3">
                Showing {filteredPackages.length} package{filteredPackages.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
              {paginatedPackages.map((pkg) => (
                <Card
                  key={pkg.id}
                  className="border-2 transition-all duration-300 hover:shadow-lg rounded-xl border-accent"
                  style={{ borderColor: "#79e58f" }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-sm" style={{ backgroundColor: "#79e58f" }}>
                        {pkg.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                      </div>
                      <h3 className="font-bold text-base sm:text-lg text-gray-900 truncate">{pkg.name}</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center space-x-2 min-w-0">
                      <Package className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-xs sm:text-sm line-clamp-2">
                        <span className="font-medium">Description:</span> {pkg.description || "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 min-w-0">
                      <Package className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-xs sm:text-sm truncate">
                        <span className="font-medium">Status:</span> {pkg.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 min-w-0">
                      <Package className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-xs sm:text-sm truncate">
                        <span className="font-medium">Created:</span> {formatDate(pkg.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-end pt-2">
                      <div className="flex space-x-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(pkg)}
                          className="bg-yellow-600 text-white hover:bg-accent w-10 h-10 p-0 flex items-center justify-center"
                          style={{ borderColor: "#79e58f" }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMutation.mutate(pkg.id)}
                          className="bg-red-600 text-white hover:bg-accent w-10 h-10 p-0 flex items-center justify-center"
                          style={{ borderColor: "#79e58f" }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {filteredPackages.length === 0 ? (
              <div className="text-center py-12 sm:py-16">
                <Package className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2">
                  {searchTerm ? "No packages found" : "No packages"}
                </h3>
                <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-6">
                  {searchTerm ? "Try adjusting your search terms." : "Add a new package to get started."}
                </p>
              </div>
            ) : totalPages > 1 && (
              <div className="flex justify-center items-center mt-6 space-x-2 flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="border-2 border-accent text-accent hover:bg-accent hover:text-white w-10 h-10 p-0 flex items-center justify-center"
                  style={{ borderColor: "#79e58f", color: "#79e58f" }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    onClick={() => handlePageChange(page)}
                    className={`border-2 w-10 h-10 p-0 flex items-center justify-center text-xs sm:text-sm ${
                      currentPage === page
                        ? "bg-accent text-white"
                        : "border-accent text-accent hover:bg-accent hover:text-white"
                    }`}
                    style={{
                      backgroundColor: currentPage === page ? "#79e58f" : "transparent",
                      borderColor: "#79e58f",
                      color: currentPage === page ? "white" : "#79e58f",
                    }}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="border-2 border-accent text-accent hover:bg-accent hover:text-white w-10 h-10 p-0 flex items-center justify-center"
                  style={{ borderColor: "#79e58f", color: "#79e58f" }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
