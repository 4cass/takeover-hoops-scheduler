
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Student {
  id: string;
  name: string;
  email: string;
  remaining_sessions: number;
}

interface Coach {
  id: string;
  name: string;
  email: string;
}

interface Branch {
  id: string;
  name: string;
  city: string;
}

interface CreateSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionCreated: () => void;
}

export function CreateSessionModal({ open, onOpenChange, onSessionCreated }: CreateSessionModalProps) {
  const [date, setDate] = useState<Date>();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [packageType, setPackageType] = useState('');
  const [notes, setNotes] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const [studentsRes, coachesRes, branchesRes] = await Promise.all([
        supabase.from('students').select('*').order('name'),
        supabase.from('coaches').select('*').order('name'),
        supabase.from('branches').select('*').order('name')
      ]);

      if (studentsRes.data) setStudents(studentsRes.data);
      if (coachesRes.data) setCoaches(coachesRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAllStudents = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(students.map(student => student.id));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleCoachToggle = (coachId: string) => {
    setSelectedCoaches(prev => 
      prev.includes(coachId) 
        ? prev.filter(id => id !== coachId)
        : [...prev, coachId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !startTime || !endTime || !selectedBranch || selectedStudents.length === 0 || selectedCoaches.length === 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Create session
      const { data: session, error: sessionError } = await supabase
        .from('training_sessions')
        .insert({
          date: format(date, 'yyyy-MM-dd'),
          start_time: startTime,
          end_time: endTime,
          branch_id: selectedBranch,
          package_type: packageType || null,
          notes: notes || null,
          status: 'scheduled'
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Add participants
      const participantInserts = selectedStudents.map(studentId => ({
        session_id: session.id,
        student_id: studentId
      }));

      const { error: participantsError } = await supabase
        .from('session_participants')
        .insert(participantInserts);

      if (participantsError) throw participantsError;

      // Add coaches
      const coachInserts = selectedCoaches.map(coachId => ({
        session_id: session.id,
        coach_id: coachId
      }));

      const { error: coachesError } = await supabase
        .from('session_coaches')
        .insert(coachInserts);

      if (coachesError) throw coachesError;

      // Create attendance records
      const attendanceInserts = selectedStudents.map(studentId => ({
        session_id: session.id,
        student_id: studentId,
        status: 'pending'
      }));

      const { error: attendanceError } = await supabase
        .from('attendance_records')
        .insert(attendanceInserts);

      if (attendanceError) throw attendanceError;

      toast({
        title: "Success",
        description: "Session created successfully"
      });

      onSessionCreated();
      onOpenChange(false);
      
      // Reset form
      setDate(undefined);
      setStartTime('');
      setEndTime('');
      setSelectedStudents([]);
      setSelectedCoaches([]);
      setSelectedBranch('');
      setPackageType('');
      setNotes('');
    } catch (error) {
      console.error('Error creating session:', error);
      toast({
        title: "Error",
        description: "Failed to create session",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const allStudentsSelected = students.length > 0 && selectedStudents.length === students.length;
  const someStudentsSelected = selectedStudents.length > 0 && selectedStudents.length < students.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Branch *</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name} - {branch.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="packageType">Package Type</Label>
              <Input
                id="packageType"
                value={packageType}
                onChange={(e) => setPackageType(e.target.value)}
                placeholder="e.g., Premium, Basic"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Select Players *</Label>
              <div className="mt-2 space-y-3">
                <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded-md">
                  <Checkbox
                    id="select-all-students"
                    checked={allStudentsSelected}
                    onCheckedChange={handleSelectAllStudents}
                    className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
                    {...(someStudentsSelected && { 'data-state': 'indeterminate' })}
                  />
                  <Label htmlFor="select-all-students" className="font-medium">
                    Select All Players ({students.length})
                  </Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`student-${student.id}`}
                        checked={selectedStudents.includes(student.id)}
                        onCheckedChange={() => handleStudentToggle(student.id)}
                      />
                      <Label 
                        htmlFor={`student-${student.id}`} 
                        className="text-sm cursor-pointer"
                      >
                        {student.name} ({student.remaining_sessions} sessions left)
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Select Coaches *</Label>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-3">
                {coaches.map((coach) => (
                  <div key={coach.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`coach-${coach.id}`}
                      checked={selectedCoaches.includes(coach.id)}
                      onCheckedChange={() => handleCoachToggle(coach.id)}
                    />
                    <Label 
                      htmlFor={`coach-${coach.id}`} 
                      className="text-sm cursor-pointer"
                    >
                      {coach.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[80px] px-3 py-2 text-sm border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Additional session notes..."
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Session'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
