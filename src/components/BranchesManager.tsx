import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Filter, Search, Users, ChevronLeft, ChevronRight, MapPin, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Branch = {
  id: string;
  name: string;
  address: string;
  city: string;
  contact_info: string | null;
  created_at: string;
};

export function BranchesManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    contact_info: "",
  });

  const queryClient = useQueryClient();

  const { data: branches, isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Branch[];
    },
  });

  const filteredBranches = branches?.filter((branch) =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Pagination logic for branches
  const totalPages = Math.ceil(filteredBranches.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBranches = filteredBranches.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const createMutation = useMutation({
    mutationFn: async (branch: typeof formData) => {
      const { data, error } = await supabase
        .from("branches")
        .insert([{
          ...branch,
          contact_info: branch.contact_info || null,
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Branch created successfully");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Failed to create branch: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...branch }: typeof formData & { id: string }) => {
      const { data, error } = await supabase
        .from("branches")
        .update({
          ...branch,
          contact_info: branch.contact_info || null,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast.success("Branch updated successfully");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Failed to update branch: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Branch deleted successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to delete branch: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({ name: "", address: "", city: "", contact_info: "" });
    setEditingBranch(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBranch) {
      updateMutation.mutate({ ...formData, id: editingBranch.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address,
      city: branch.city,
      contact_info: branch.contact_info || "",
    });
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-2 sm:p-3 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <Users className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3">Loading branches...</h3>
          <p className="text-xs sm:text-sm md:text-lg text-gray-600">Please wait while we fetch the branch data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-4 p-2 sm:p-3 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#181818] mb-2 tracking-tight">Branches Manager</h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-700">Manage training locations and branch information</p>
        </div>

        <Card className="border-2 border-[#181A18] bg-white shadow-xl">
          <CardHeader className="border-b border-[#181A18] bg-[#181A18] p-2 sm:p-3 md:p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div>
                <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                  <Users className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" style={{ color: '#BEA877' }} />
                  Branch Management
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs sm:text-sm">
                  View and manage branch profiles
                </CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => resetForm()}
                    className="bg-accent text-white hover:bg-accent/90 transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                    style={{ backgroundColor: '#BEA877' }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Branch
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md bg-white border-2 border-[#181A18] p-2 sm:p-3 md:p-4">
                  <DialogHeader>
                    <DialogTitle className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                      {editingBranch ? "Edit Branch" : "Add New Branch"}
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                      {editingBranch ? "Update branch information" : "Add a new training location"}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="min-w-0">
                      <Label htmlFor="name" className="text-gray-700 font-medium text-xs sm:text-sm">Branch Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        required
                        className="mt-1 pl-4 pr-4 py-1.5 sm:py-2 border-2 border-accent rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-accent/20 bg-white"
                        style={{ borderColor: '#BEA877' }}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="address" className="text-gray-700 font-medium text-xs sm:text-sm">Address</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                        required
                        className="mt-1 pl-4 pr-4 py-1.5 sm:py-2 border-2 border-accent rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-accent/20 bg-white"
                        style={{ borderColor: '#BEA877' }}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="city" className="text-gray-700 font-medium text-xs sm:text-sm">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                        required
                        className="mt-1 pl-4 pr-4 py-1.5 sm:py-2 border-2 border-accent rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-accent/20 bg-white"
                        style={{ borderColor: '#BEA877' }}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="contact_info" className="text-gray-700 font-medium text-xs sm:text-sm">Contact Information</Label>
                      <Textarea
                        id="contact_info"
                        value={formData.contact_info}
                        onChange={(e) => setFormData((prev) => ({ ...prev, contact_info: e.target.value }))}
                        placeholder="Phone, email, or other contact details"
                        className="mt-1 pl-4 pr-4 py-1.5 sm:py-2 border-2 border-accent rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-accent/20 bg-white"
                        style={{ borderColor: '#BEA877' }}
                      />
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
                        style={{ backgroundColor: '#BEA877' }}
                      >
                        {createMutation.isPending || updateMutation.isPending ? "Processing..." : editingBranch ? "Update" : "Create"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-3 md:p-4">
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <Filter className="h-4 sm:h-5 w-4 sm:w-5 text-accent mr-2" style={{ color: '#BEA877' }} />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Filter Branches</h3>
              </div>
              <div className="relative max-w-md min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search branches..."
                  className="pl-10 pr-4 py-1.5 sm:py-2 w-full border-2 border-accent rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-accent/20 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ borderColor: '#BEA877' }}
                />
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mt-3">
                Showing {filteredBranches.length} branch{filteredBranches.length === 1 ? '' : 'es'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
              {paginatedBranches.map((branch) => (
                <Card
                  key={branch.id}
                  className="border-2 transition-all duration-300 hover:shadow-lg rounded-xl border-accent"
                  style={{ borderColor: '#BEA877' }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-sm" style={{ backgroundColor: '#BEA877' }}>
                        {branch.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                      </div>
                      <h3 className="font-bold text-base sm:text-lg text-gray-900 truncate">{branch.name}</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center space-x-2 min-w-0">
                      <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-xs sm:text-sm line-clamp-2"><span className="font-medium">Address:</span> {branch.address}</span>
                    </div>
                    <div className="flex items-center space-x-2 min-w-0">
                      <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-xs sm:text-sm truncate"><span className="font-medium">City:</span> {branch.city}</span>
                    </div>
                    <div className="flex items-center space-x-2 min-w-0">
                      <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-xs sm:text-sm line-clamp-2"><span className="font-medium">Contact:</span> {branch.contact_info || "N/A"}</span>
                    </div>
                    <div className="flex items-center justify-end pt-2">
                      <div className="flex space-x-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(branch)}
                          className="bg-yellow-600 text-white hover:bg-accent w-10 h-10 p-0 flex items-center justify-center"
                          style={{ borderColor: '#BEA877' }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMutation.mutate(branch.id)}
                          className="bg-red-600 text-white hover:bg-accent w-10 h-10 p-0 flex items-center justify-center"
                          style={{ borderColor: '#BEA877' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {filteredBranches.length === 0 ? (
              <div className="text-center py-12 sm:py-16">
                <Users className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2">
                  {searchTerm ? "No branches found" : "No branches"}
                </h3>
                <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-6">
                  {searchTerm ? "Try adjusting your search terms." : "Add a new branch to get started."}
                </p>
              </div>
            ) : totalPages > 1 && (
              <div className="flex justify-center items-center mt-6 space-x-2 flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="border-2 border-accent text-accent hover:bg-accent hover:text-white w-10 h-10 p-0 flex items-center justify-center"
                  style={{ borderColor: '#BEA877', color: '#BEA877' }}
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
                        ? 'bg-accent text-white'
                        : 'border-accent text-accent hover:bg-accent hover:text-white'
                    }`}
                    style={{
                      backgroundColor: currentPage === page ? '#BEA877' : 'transparent',
                      borderColor: '#BEA877',
                      color: currentPage === page ? 'white' : '#BEA877'
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
                  style={{ borderColor: '#BEA877', color: '#BEA877' }}
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