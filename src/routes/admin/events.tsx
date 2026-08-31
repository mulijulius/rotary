import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/admin/events")({
  component: AdminEditorEvents,
});

type EditorEvent = Database["public"]["Tables"]["editor_events"]["Row"];

type EventFormData = {
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  description: string;
  is_public: boolean;
};

const EMPTY_FORM: EventFormData = {
  title: "",
  event_date: new Date().toISOString().slice(0, 10),
  start_time: "",
  end_time: "",
  venue: "",
  description: "",
  is_public: true,
};

function AdminEditorEvents() {
  const { role } = useAuth();
  const [events, setEvents] = useState<EditorEvent[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EditorEvent | null>(null);
  const [formData, setFormData] = useState<EventFormData>(EMPTY_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("editor_events")
      .select("*")
      .order("event_date", { ascending: false });
    if (error) {
      console.error("[admin/events] failed to load", error);
      toast.error("Couldn't load events.");
      return;
    }
    setEvents(data);
  }

  function handleOpenDialog(event?: EditorEvent) {
    if (event) {
      setEditingEvent(event);
      setFormData({
        title: event.title,
        event_date: event.event_date,
        start_time: event.start_time || "",
        end_time: event.end_time || "",
        venue: event.venue || "",
        description: event.description || "",
        is_public: event.is_public,
      });
    } else {
      setEditingEvent(null);
      setFormData(EMPTY_FORM);
    }
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingEvent(null);
  }

  async function handleSaveEvent() {
    if (!formData.title || !formData.event_date) {
      toast.error("Please fill in the title and date.");
      return;
    }

    setBusyId("save");
    try {
      const payload = {
        title: formData.title,
        event_date: formData.event_date,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        venue: formData.venue || null,
        description: formData.description || null,
        is_public: formData.is_public,
      };

      if (editingEvent) {
        const { error } = await supabase
          .from("editor_events")
          .update(payload)
          .eq("id", editingEvent.id);
        if (error) throw error;
        toast.success("Event updated.");
      } else {
        const { error } = await supabase.from("editor_events").insert(payload);
        if (error) throw error;
        toast.success("Event created.");
      }
      handleCloseDialog();
      load();
    } catch (err) {
      console.error("[admin/events] save error", err);
      toast.error(err instanceof Error ? err.message : "Failed to save event.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(event: EditorEvent) {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    setBusyId(event.id.toString());
    try {
      const { error } = await supabase.from("editor_events").delete().eq("id", event.id);
      if (error) throw error;
      toast.success("Event deleted.");
      load();
    } catch (err) {
      console.error("[admin/events] delete error", err);
      toast.error("Failed to delete event.");
    } finally {
      setBusyId(null);
    }
  }

  if (role && !["admin", "editor"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to events.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Post events for the public calendar — these show up on the /events page in pink.
          </p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEvent ? "Edit Event" : "Create Event"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Community Blood Drive"
                />
              </div>
              <div>
                <Label htmlFor="event_date">Date *</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
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
                  placeholder="What this event is about..."
                  rows={4}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_public"
                  checked={formData.is_public}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_public: checked === true })
                  }
                />
                <Label htmlFor="is_public" className="cursor-pointer">
                  Public (visible on the /events calendar)
                </Label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveEvent} disabled={busyId === "save"} className="flex-1">
                  {busyId === "save" ? "Saving…" : `${editingEvent ? "Update" : "Create"} Event`}
                </Button>
                <Button variant="outline" onClick={handleCloseDialog} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Visible</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events === null && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {events?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No events posted yet.
                </TableCell>
              </TableRow>
            )}
            {events?.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-semibold text-foreground">{e.title}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(e.event_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.venue || "—"}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      e.is_public
                        ? "border-transparent bg-pink-500 text-white hover:bg-pink-600"
                        : ""
                    }
                    variant={e.is_public ? "default" : "outline"}
                  >
                    {e.is_public ? "On calendar" : "Hidden"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleOpenDialog(e)}
                      title="Edit"
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(e)}
                      disabled={busyId === e.id.toString()}
                      title="Delete"
                      className="p-1 text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
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
