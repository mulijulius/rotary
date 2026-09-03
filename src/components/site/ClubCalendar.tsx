import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isToday as isTodayFn,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Clock, MapPin, Users, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Same calendar UX as the public /events page, but pulling from the full
// `meetings` table (any signed-in role can read all meetings, not just the
// ones marked public) so back-office users see everything on the books.
//
// Also pulls from `editor_events` directly (not the public view) so every
// signed-in role viewing their Overview page sees posted club events too —
// RLS on editor_events (see migration 20260902_026) allows SELECT to any
// authenticated role; only INSERT/UPDATE/DELETE stay scoped to admin/editor.
type CalendarMeeting = {
  id: number;
  title: string;
  meeting_type: string;
  meeting_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  description: string | null;
  is_mandatory: boolean;
};

type CalendarEditorEvent = {
  id: number;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  description: string | null;
  is_public: boolean;
};

type MeetingStatus = "past" | "soon" | "upcoming";
type DayStatus = MeetingStatus | "editorEvent";

const SOON_THRESHOLD_DAYS = 3;

const MEETING_TYPE_LABELS: Record<string, string> = {
  weekly: "Weekly Meeting",
  board: "Board Meeting",
  event: "Event",
  project: "Service Project",
  fellowship: "Fellowship",
};

const STATUS_STYLES: Record<DayStatus, string> = {
  upcoming: "bg-emerald-600 text-white hover:bg-emerald-700",
  soon: "bg-amber-500 text-white hover:bg-amber-600",
  past: "bg-rose-600/90 text-white hover:bg-rose-700",
  editorEvent: "bg-pink-500 text-white hover:bg-pink-600",
};

const STATUS_LABELS: Record<DayStatus, string> = {
  upcoming: "Upcoming",
  soon: "Coming up soon",
  past: "Past",
  editorEvent: "Club event",
};

// Hex equivalents of the classes above, for days where a meeting *and* an
// editor event land on the same date. Those days render as a diagonal
// split (half pink for the event, half whatever the meeting's own status
// color is) instead of letting one type silently hide the other — a past
// meeting clashing with an event still shows rose on its half, not green.
const STATUS_HEX: Record<DayStatus, string> = {
  upcoming: "#059669",
  soon: "#f59e0b",
  past: "#e11d48",
  editorEvent: "#ec4899",
};

function meetingStatus(meetingDate: string): MeetingStatus {
  const diff = differenceInCalendarDays(parseISO(meetingDate), new Date());
  if (diff < 0) return "past";
  if (diff <= SOON_THRESHOLD_DAYS) return "soon";
  return "upcoming";
}

function formatTime(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = Number(h);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m} ${period}`;
}

function meetingTypeLabel(type: string): string {
  return MEETING_TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

export function ClubCalendar() {
  const [meetings, setMeetings] = useState<CalendarMeeting[] | null>(null);
  const [editorEvents, setEditorEvents] = useState<CalendarEditorEvent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [meetingsRes, editorEventsRes] = await Promise.all([
        supabase
          .from("meetings")
          .select("id, title, meeting_type, meeting_date, start_time, end_time, venue, description, is_mandatory")
          .order("meeting_date", { ascending: true }),
        supabase
          .from("editor_events")
          .select("id, title, event_date, start_time, end_time, venue, description, is_public")
          .order("event_date", { ascending: true }),
      ]);

      if (cancelled) return;

      if (meetingsRes.error) {
        console.error("[ClubCalendar] failed to load meetings", meetingsRes.error);
        setLoadError("Couldn't load the calendar right now.");
        setMeetings([]);
      } else {
        setMeetings(meetingsRes.data ?? []);
      }

      if (editorEventsRes.error) {
        console.error("[ClubCalendar] failed to load editor events", editorEventsRes.error);
        setEditorEvents([]);
      } else {
        setEditorEvents(editorEventsRes.data ?? []);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const meetingsByDate = useMemo(() => {
    const map = new Map<string, CalendarMeeting[]>();
    for (const m of meetings ?? []) {
      if (!m.meeting_date) continue;
      const key = m.meeting_date.slice(0, 10);
      const existing = map.get(key);
      if (existing) existing.push(m);
      else map.set(key, [m]);
    }
    return map;
  }, [meetings]);

  const editorEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEditorEvent[]>();
    for (const e of editorEvents ?? []) {
      if (!e.event_date) continue;
      const key = e.event_date.slice(0, 10);
      const existing = map.get(key);
      if (existing) existing.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [editorEvents]);

  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const leadingBlanks = getDay(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const cells: Array<{ date: Date; key: string } | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...daysInMonth.map((date) => ({ date, key: format(date, "yyyy-MM-dd") })),
  ];

  const selectedMeetings = selectedDateKey ? (meetingsByDate.get(selectedDateKey) ?? []) : [];
  const selectedEditorEvents = selectedDateKey ? (editorEventsByDate.get(selectedDateKey) ?? []) : [];
  const selectedDateLabel = selectedDateKey
    ? format(parseISO(selectedDateKey), "EEEE, MMMM d, yyyy")
    : "";
  const selectedCount = selectedMeetings.length + selectedEditorEvents.length;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Previous month"
            onClick={() => setMonthCursor((d) => subMonths(d, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="min-w-[150px] text-center text-xl">{format(monthCursor, "MMMM yyyy")}</h3>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Next month"
            onClick={() => setMonthCursor((d) => addMonths(d, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="hidden text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:inline">
          Club Calendar
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={`${d}-${i}`} className="py-2 text-xs font-bold text-muted-foreground">
            {d}
          </span>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <span key={`blank-${i}`} />;

          const dayMeetings = meetingsByDate.get(cell.key) ?? [];
          const dayEditorEvents = editorEventsByDate.get(cell.key) ?? [];
          const hasEditorEvent = dayEditorEvents.length > 0;
          const hasMeeting = dayMeetings.length > 0;
          const hasAny = hasMeeting || hasEditorEvent;

          // A meeting's own status (upcoming/soon/past) reflects whether
          // it's actually overdue — used both standalone and as the
          // non-pink half of a clash day below.
          const meetingSideStatus: MeetingStatus | null = hasMeeting
            ? meetingStatus(dayMeetings[0].meeting_date)
            : null;

          // Clash day: an editor event and a meeting on the same date.
          // Split the cell diagonally instead of letting one type hide
          // the other — pink stays pink for the event half, the other
          // half uses whatever color the meeting's date actually earns
          // (rose if it's overdue, amber if it's almost due, green
          // otherwise), same as it would render on its own.
          const hasClash = hasEditorEvent && hasMeeting;

          const status: DayStatus | null = hasClash
            ? null
            : hasEditorEvent
              ? "editorEvent"
              : hasMeeting
                ? meetingSideStatus
                : null;

          const clashStyle = hasClash
            ? {
                backgroundImage: `linear-gradient(135deg, ${STATUS_HEX.editorEvent} 50%, ${STATUS_HEX[meetingSideStatus!]} 50%)`,
              }
            : undefined;

          const titleText = hasAny
            ? [...dayMeetings.map((m) => m.title), ...dayEditorEvents.map((e) => e.title)].join(", ")
            : undefined;

          return (
            <button
              key={cell.key}
              type="button"
              disabled={!hasAny}
              title={titleText}
              onClick={() => hasAny && setSelectedDateKey(cell.key)}
              style={clashStyle}
              className={`flex aspect-square items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                hasClash
                  ? "cursor-pointer text-white hover:brightness-110"
                  : hasAny
                    ? `cursor-pointer ${STATUS_STYLES[status!]}`
                    : "cursor-default bg-muted text-foreground"
              } ${isTodayFn(cell.date) ? "ring-2 ring-offset-1 ring-navy" : ""}`}
            >
              {format(cell.date, "d")}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-600" /> Upcoming
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-amber-500" /> Almost due
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-600/90" /> Past
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-pink-500" /> Club event (editor)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundImage: `linear-gradient(135deg, ${STATUS_HEX.editorEvent} 50%, ${STATUS_HEX.upcoming} 50%)` }}
          />
          Event + meeting same day
        </span>
      </div>

      {loadError && <p className="mt-3 text-sm text-destructive">{loadError}</p>}
      {meetings === null && editorEvents === null && (
        <p className="mt-3 text-sm text-muted-foreground">Loading calendar…</p>
      )}

      <Dialog open={selectedDateKey !== null} onOpenChange={(open) => !open && setSelectedDateKey(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedDateLabel}</DialogTitle>
            <DialogDescription>
              {selectedCount > 1
                ? `${selectedCount} activities scheduled`
                : "Activity scheduled for this day"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedEditorEvents.map((e) => (
              <div key={`editor-event-${e.id}`} className="rounded-xl border border-pink-200 bg-pink-50/50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-base font-semibold text-foreground">{e.title}</h4>
                  <Badge className="border-transparent bg-pink-500 text-white">
                    <Sparkles className="mr-1 h-3 w-3" /> Club event
                  </Badge>
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {(e.start_time || e.end_time) && (
                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4 flex-none" />
                      {formatTime(e.start_time)}
                      {e.end_time ? ` – ${formatTime(e.end_time)}` : ""}
                    </p>
                  )}
                  {e.venue && (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 flex-none" />
                      {e.venue}
                    </p>
                  )}
                  {!e.is_public && (
                    <p className="text-xs italic text-muted-foreground">
                      Hidden from the public calendar (not marked public).
                    </p>
                  )}
                </div>

                {e.description && <p className="mt-3 text-sm text-foreground">{e.description}</p>}
              </div>
            ))}

            {selectedMeetings.map((m) => {
              const status = meetingStatus(m.meeting_date);
              return (
                <div key={`meeting-${m.id}`} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-base font-semibold text-foreground">{m.title}</h4>
                    <Badge className={`${STATUS_STYLES[status].split(" ")[0]} border-transparent text-white`}>
                      {STATUS_LABELS[status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gold-deep">
                    {meetingTypeLabel(m.meeting_type)}
                  </p>

                  <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4 flex-none" />
                      {formatTime(m.start_time)}
                      {m.end_time ? ` – ${formatTime(m.end_time)}` : ""}
                    </p>
                    {m.venue && (
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 flex-none" />
                        {m.venue}
                      </p>
                    )}
                    {m.is_mandatory && (
                      <p className="flex items-center gap-2">
                        <Users className="h-4 w-4 flex-none" />
                        Mandatory attendance
                      </p>
                    )}
                  </div>

                  {m.description && <p className="mt-3 text-sm text-foreground">{m.description}</p>}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
