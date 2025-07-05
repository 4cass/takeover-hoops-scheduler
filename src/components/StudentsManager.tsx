import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

type AttendanceStatus = "present" | "absent" | "pending";

type Student = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  branch_id: string | null;
  package_type: string | null;
  sessions: number | null;
  remaining_sessions: number;
  created_at: string;
  updated_at: string;
};

type AttendanceRecord = {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_at: string | null;
  created_at: string;
  training_sessions: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    coach_id: string;
    branches: { name: string };
    coaches: { name: string };
  };
};

export function StudentsManager() {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Student[];
    },
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['student-attendance', selectedStudent?.id],
    queryFn: async () => {
      if (!selectedStudent?.id) return [];
      
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          training_sessions (
            id, date, start_time, end_time, coach_id,
            branches (name),
            coaches (name)
          )
        `)
        .eq('student_id', selectedStudent.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AttendanceRecord[];
    },
    enabled: !!selectedStudent?.id
  });

  const filteredStudents = students.filter((student) =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case "present":
        return "bg-green-500";
      case "absent":
        return "bg-red-500";
      case "pending":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const formatTime12Hour = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Student List */}
      <Card className="md:w-1/3">
        <CardHeader>
          <CardTitle>Students</CardTitle>
          <CardDescription>Select a student to view attendance.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="search"
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-4"
          />
          <div className="overflow-y-auto max-h-[400px]">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                className={`flex items-center space-x-4 p-2 rounded-md hover:bg-secondary cursor-pointer ${
                  selectedStudent?.id === student.id ? "bg-secondary" : ""
                }`}
                onClick={() => setSelectedStudent(student)}
              >
                <Avatar>
                  <AvatarImage src={`https://avatar.vercel.sh/${student.name}.png`} />
                  <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium leading-none">{student.name}</p>
                  <p className="text-sm text-muted-foreground">{student.email}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Attendance Records */}
      <Card className="md:w-2/3">
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
          <CardDescription>
            Attendance records for{" "}
            <span className="font-medium">{selectedStudent?.name || "No Student Selected"}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedStudent ? (
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>
                  Attendance records for {selectedStudent.name}.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Date</TableHead>
                    <TableHead>Session Time</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Coach</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {format(new Date(record.training_sessions.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {formatTime12Hour(record.training_sessions.start_time)} -{" "}
                        {formatTime12Hour(record.training_sessions.end_time)}
                      </TableCell>
                      <TableCell>{record.training_sessions.branches.name}</TableCell>
                      <TableCell>{record.training_sessions.coaches.name}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(record.status)}>
                          {record.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground">Select a student to view their attendance records.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
