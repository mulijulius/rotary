import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Check, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/attendance/$meetingId")({
  component: AdminAttendance,
});

type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];
type Member = Database["public"]["Tables"]["members"]["Row"];
type Meeting = Database["public"]["Tables"]["meetings"]["Row"];

const STATUS_OPTIONS: AttendanceStatus[] = ["present", "late", "absent", "excused"];
const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "bg-green-100 text-green-800",
  late: "bg-yellow-100 text-yellow-800",
  absent: "bg-red-100 text-red-800",
  excused: "bg-blue-100 text-blue-800",
};

function AdminAttendance() {
  const { role } = useAuth();
  const { meetingId } = useParams({ from: "/admin/attendance/$meetingId" });
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [attendance, setAttendance] = useState<Map<number, Attendance>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Map<number, string>>(new Map());

  const meetingIdNum = parseInt(meetingId);

  useEffect(() => {
    load();
  }, [meetingId]);

  async function load() {
    try {
      const [meetingResult, membersResult, attendanceResult] = await Promise.all([
        supabase.from("meetings").select("*").eq("id", meetingIdNum).single(),
        supabase
          .from("members")
          .select("*")
          .eq("status", "active")
          .order("last_name", { ascending: true }),
        supabase
          .from("attendance")
          .select("*")
          .eq("meeting_id", meetingIdNum),
      ]);

      if (meetingResult.error) throw meetingResult.error;
      if (membersResult.error) throw membersResult.error;
      if (attendanceResult.error) throw attendanceResult.error;

      setMeeting(meetingResult.data);
      setMembers(membersResult.data);

      const attendanceMap = new Map();
      attendanceResult.data?.forEach((a) => {
        attendanceMap.set(a.member_id, a);
      });
      setAttendance(attendanceMap);
    } catch (err) {
      console.error("[admin/attendance] failed to load", err);
      toast.error("Couldn't load attendance data.");
    }
  }

  async function handleStatusChange(memberId: number, status: AttendanceStatus) {
    setBusyId(memberId.toString());
    try {
      const existing = attendance.get(memberId);
      if (existing) {
        const { error } = await supabase
          .from("attendance")
          .update({ status })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("attendance")
          .insert({
            meeting_id: meetingIdNum,
            member_id: memberId,
            status,
          });
        if (error) throw error;
      }
      load();
      toast.success("Attendance recorded.");
    } catch (err) {
      console.error("[admin/attendance] status change error", err);
      toast.error("Failed to update attendance.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleNoteChange(memberId: number, note: string) {
    setBusyId(memberId.toString());
    try {
      const existing = attendance.get(memberId);
      if (!existing) {
        toast.error("Please set attendance status first.");
        setBusyId(null);
        return;
      }
      const { error } = await supabase
        .from("attendance")
        .update({ notes: note || null })
        .eq("id", existing.id);
      if (error) throw error;
      setNotes(new Map(notes).set(memberId, note));
      toast.success("Note saved.");
    } catch (err) {
      console.error("[admin/attendance] note error", err);
      toast.error("Failed to save note.");
    } finally {
      setBusyId(null);
    }
  }

  if (role && !["admin", "secretary"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to attendance management.</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Meeting Attendance</h1>
        {meeting && (
          <p className="mt-1 text-sm text-muted-foreground">
            {meeting.title} — {new Date(meeting.meeting_date).toLocaleDateString()} at {meeting.start_time}
          </p>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member Name</TableHead>
              <TableHead>RI Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members === null && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {members?.map((m) => {
              const att = attendance.get(m.id);
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-semibold text-foreground">
                    {m.first_name} {m.last_name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.ri_number}</TableCell>
                  <TableCell>
                    {att ? (
                      <Badge className={STATUS_COLORS[att.status]}>
                        {att.status}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Unmarked</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      placeholder="Add note…"
                      value={notes.get(m.id) || att?.notes || ""}
                      onChange={(e) => setNotes(new Map(notes).set(m.id, e.target.value))}
                      onBlur={(e) => handleNoteChange(m.id, e.target.value)}
                      className="text-sm"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Select value={att?.status || ""} onValueChange={(v) => handleStatusChange(m.id, v as AttendanceStatus)}>
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue placeholder="Set status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 p-4 rounded-lg border border-blue-200 bg-blue-50 flex gap-2 text-sm text-blue-800">
        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">QR Check-in Status</p>
          <p>When the QR check-in window is open for this meeting, members can scan and check in automatically. You can override or manually record attendance here.</p>
        </div>
      </div>
    </div>
  );
}
