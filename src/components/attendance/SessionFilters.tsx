
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter } from "lucide-react";

interface SessionFiltersProps {
  branchFilter: string;
  setBranchFilter: (value: string) => void;
  packageFilter: "All" | "Camp Training" | "Personal Training";
  setPackageFilter: (value: "All" | "Camp Training" | "Personal Training") => void;
  statusFilter: "all" | "scheduled" | "completed" | "cancelled";
  setStatusFilter: (value: "all" | "scheduled" | "completed" | "cancelled") => void;
  sessionSearchTerm: string;
  setSessionSearchTerm: (value: string) => void;
  branches?: Array<{ id: string; name: string }>;
  filteredSessionsCount: number;
}

export function SessionFilters({
  branchFilter,
  setBranchFilter,
  packageFilter,
  setPackageFilter,
  statusFilter,
  setStatusFilter,
  sessionSearchTerm,
  setSessionSearchTerm,
  branches,
  filteredSessionsCount
}: SessionFiltersProps) {
  return (
    <div className="mb-6 space-y-4 sm:space-y-6">
      <div className="flex items-center mb-4">
        <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-accent mr-2" style={{ color: '#BEA877' }} />
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-foreground">Filter Sessions</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-gray-700">Branch</label>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="border-accent focus:border-accent focus:ring-accent/20 text-xs sm:text-sm h-8 sm:h-10" style={{ borderColor: '#BEA877' }}>
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches?.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-gray-700">Package Type</label>
          <Select
            value={packageFilter}
            onValueChange={(value: "All" | "Camp Training" | "Personal Training") => setPackageFilter(value)}
          >
            <SelectTrigger className="border-accent focus:border-accent focus:ring-accent/20 text-xs sm:text-sm h-8 sm:h-10" style={{ borderColor: '#BEA877' }}>
              <SelectValue placeholder="Select package type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Sessions</SelectItem>
              <SelectItem value="Camp Training">Camp Training</SelectItem>
              <SelectItem value="Personal Training">Personal Training</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-gray-700">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="border-accent focus:border-accent focus:ring-accent/20 text-xs sm:text-sm h-8 sm:h-10" style={{ borderColor: '#BEA877' }}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by branch..."
          className="pl-8 sm:pl-10 pr-4 py-2 sm:py-3 w-full border-2 border-accent/40 rounded-xl text-xs sm:text-sm focus:border-accent focus:ring-accent/20 bg-white"
          value={sessionSearchTerm}
          onChange={(e) => setSessionSearchTerm(e.target.value)}
          style={{ borderColor: '#BEA877' }}
        />
      </div>
      <p className="text-xs sm:text-sm text-gray-600">
        Showing {filteredSessionsCount} session{filteredSessionsCount === 1 ? '' : 's'}
      </p>
    </div>
  );
}
