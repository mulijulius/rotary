import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Edit2, QrCode } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/admin/meetings")({
  component: AdminMeetings,
});

type Meeting = Database["public"]["Tables"]["meetings"]["Row"];
type MeetingType = Database["public"]["Enums"]["meeting_type"];

type MeetingFormData = Omit<Meeting, "id" | "created_at">;

const MEETING_TYPES: MeetingType[] = ["weekly", "board", "event", "project", "fellowship"];

function AdminMeetings() {
  const { role } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [formData, setFormData] = useState<MeetingFormData>({
    title: "",
    meeting_type: "weekly",
    meeting_date: new Date().toISOString().split("T")[0],
    start_time: "12:00",
    end_time: "13:00",
    venue: "",
    description: "",
    is_mandatory: true,
    is_public: false,
    checkin_opens_at: null,
    checkin_closes_at: null,
    is_closed: false,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .order("meeting_date", { ascending: false });
    if (error) {
      console.error("[admin/meetings] failed to load", error);
      toast.error("Couldn't load meetings.");
      return;
    }
    setMeetings(data);
  }

  function handleOpenDialog(meeting?: Meeting) {
    if (meeting) {
      setEditingMeeting(meeting);
      setFormData({
        title: meeting.title,
        meeting_type: meeting.meeting_type,
        meeting_date: new Date(meeting.meeting_date).toISOString().split("T")[0],
        start_time: meeting.start_time,
        end_time: meeting.end_time || "",
        venue: meeting.venue || "",
        description: meeting.description || "",
        is_mandatory: meeting.is_mandatory,
        is_public: meeting.is_public,
        checkin_opens_at: meeting.checkin_opens_at,
        checkin_closes_at: meeting.checkin_closes_at,
        is_closed: meeting.is_closed,
      });
    } else {
      setEditingMeeting(null);
      setFormData({
        title: "",
        meeting_type: "weekly",
        meeting_date: new Date().toISOString().split("T")[0],
        start_time: "12:00",
        end_time: "13:00",
        venue: "",
        description: "",
        is_mandatory: true,
        is_public: false,
        checkin_opens_at: null,
        checkin_closes_at: null,
        is_closed: false,
      });
    }
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingMeeting(null);
  }

  async function handleSaveMeeting() {
    if (!formData.title || !formData.meeting_date || !formData.start_time) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setBusyId("save");
    try {
      const payload = {
        title: formData.title,
        meeting_type: formData.meeting_type,
        meeting_date: formData.meeting_date,
        start_time: formData.start_time,
        end_time: formData.end_time || null,
        venue: formData.venue || null,
        description: formData.description || null,
        is_mandatory: formData.is_mandatory,
        is_public: formData.is_public,
        checkin_opens_at: formData.checkin_opens_at,
        checkin_closes_at: formData.checkin_closes_at,
      };

      if (editingMeeting) {
        const { error } = await supabase
          .from("meetings")
          .update(payload)
          .eq("id", editingMeeting.id);
        if (error) throw error;
        toast.success("Meeting updated.");
      } else {
        const { error } = await supabase.from("meetings").insert(payload);
        if (error) throw error;
        toast.success("Meeting created.");
      }
      handleCloseDialog();
      load();
    } catch (err) {
      console.error("[admin/meetings] save error", err);
      toast.error(err instanceof Error ? err.message : "Failed to save meeting.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleCheckin(meeting: Meeting) {
    setBusyId(meeting.id.toString());
    const now = new Date();
    try {
      if (!meeting.checkin_opens_at) {
        // Open check-in window
        const opens = now;
        const closes = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
        const { error } = await supabase
          .from("meetings")
          .update({
            checkin_opens_at: opens.toISOString(),
            checkin_closes_at: closes.toISOString(),
          })
          .eq("id", meeting.id);
        if (error) throw error;
        toast.success("QR check-in window opened.");
      } else {
        // Close check-in window
        const { error } = await supabase
          .from("meetings")
          .update({
            checkin_opens_at: null,
            checkin_closes_at: null,
            is_closed: true,
          })
          .eq("id", meeting.id);
        if (error) throw error;
        toast.success("QR check-in window closed.");
      }
      load();
    } catch (err) {
      console.error("[admin/meetings] toggle checkin error", err);
      toast.error("Failed to toggle check-in window.");
    } finally {
      setBusyId(null);
    }
  }

  if (role && !["admin", "secretary"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to meetings management.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meetings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and manage club meetings, set attendance requirements.</p>
        </div>
        {role === "admin" && (
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New Meeting
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-96 overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingMeeting ? "Edit Meeting" : "Create New Meeting"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Weekly Meeting"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select value={formData.meeting_type} onValueChange={(v) => setFormData({ ...formData, meeting_type: v as MeetingType })}>
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEETING_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.meeting_date}
                      onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startTime">Start Time *</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.end_time || ""}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value || null })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="venue">Venue</Label>
                  <Input
                    id="venue"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    placeholder="Hotel Name, Conference Room"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Meeting details, agenda, etc."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="mandatory"
                      checked={formData.is_mandatory}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_mandatory: checked === true })}
                    />
                    <Label htmlFor="mandatory" className="cursor-pointer">Mandatory attendance</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="public"
                      checked={formData.is_public}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked === true })}
                    />
                    <Label htmlFor="public" className="cursor-pointer">Public (visible to non-members)</Label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveMeeting} disabled={busyId === "save"} className="flex-1">
                    {editingMeeting ? "Update" : "Create"} Meeting
                  </Button>
                  <Button variant="outline" onClick={handleCloseDialog} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Mandatory</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetings === null && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {meetings?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No meetings scheduled yet.
                </TableCell>
              </TableRow>
            )}
            {meetings?.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-semibold text-foreground">{m.title}</TableCell>
                <TableCell className="text-sm">{m.meeting_type}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(m.meeting_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {m.start_time} {m.end_time ? `- ${m.end_time}` : ""}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.venue || "—"}</TableCell>
                <TableCell>
                  <Badge variant={m.is_mandatory ? "default" : "secondary"}>
                    {m.is_mandatory ? "Yes" : "No"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    {role === "admin" && (
                      <button
                        onClick={() => handleOpenDialog(m)}
                        title="Edit"
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleCheckin(m)}
                      disabled={busyId === m.id.toString()}
                      title={m.checkin_opens_at ? "Close QR check-in" : "Open QR check-in"}
                      className={`p-1 transition-colors disabled:opacity-50 ${m.checkin_opens_at ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <QrCode className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => window.location.href = `/admin/attendance/${m.id}`}
                      title="Manage attendance"
                      className="px-2 py-1 text-xs rounded border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      Attendance
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
