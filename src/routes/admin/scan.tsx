import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Scan, CheckCircle2, XCircle, Camera, Calendar, Clock, MapPin } from "lucide-react";
import { toast } from "sonner";
import jsQR from "jsqr";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchOwnProfile, type MemberProfile } from "@/lib/member-profile";
import type { Database } from "@/integrations/supabase/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/scan")({
  component: ScanAttendance,
});

type Meeting = Database["public"]["Tables"]["meetings"]["Row"];

type CheckInResult = {
  meeting: Meeting;
  profile: MemberProfile;
  checkInTime: string;
  alreadyCheckedIn: boolean;
};

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";
}

// Pulls { meetingId, token } out of whatever the QR/camera or a manual
// paste gave us. Accepts the full check-in URL (what the admin Meetings
// page's QR encodes: /admin/scan?m=<id>&t=<token>) or a bare "m:t" pair
// for manual entry.
function parseScannedValue(raw: string): { meetingId: number; token: string } | null {
  const text = raw.trim();
  try {
    const url = new URL(text);
    const m = url.searchParams.get("m");
    const t = url.searchParams.get("t");
    if (m && t) return { meetingId: parseInt(m, 10), token: t };
  } catch {
    // not a URL — fall through to the "id:token" shorthand
  }
  const parts = text.split(":");
  if (parts.length === 2) {
    const meetingId = parseInt(parts[0]!, 10);
    if (!Number.isNaN(meetingId) && parts[1]) return { meetingId, token: parts[1]! };
  }
  return null;
}

function ScanAttendance() {
  const { session } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const lastTokenRef = useRef<string | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processCheckIn = useCallback(
    async (meetingId: number, token: string) => {
      if (!session) return;
      setProcessing(true);
      setError(null);
      try {
        const profile = await fetchOwnProfile(session.user.id);
        if (!profile) {
          setError("Your account isn't linked to a member profile yet. Contact a club officer.");
          return;
        }

        const { data: meeting, error: meetingErr } = await supabase
          .from("meetings")
          .select("*")
          .eq("id", meetingId)
          .maybeSingle();
        if (meetingErr) throw meetingErr;
        if (!meeting) {
          setError("This QR code doesn't match any meeting.");
          return;
        }
        if (meeting.qr_token !== token) {
          setError("This QR code is outdated. Ask an officer for the current check-in code.");
          return;
        }

        const now = new Date();
        const windowOpen =
          !meeting.is_closed &&
          meeting.checkin_opens_at &&
          meeting.checkin_closes_at &&
          now >= new Date(meeting.checkin_opens_at) &&
          now <= new Date(meeting.checkin_closes_at);

        // Already checked in? Show that instead of erroring.
        const { data: existing } = await supabase
          .from("attendance")
          .select("*")
          .eq("meeting_id", meeting.id)
          .eq("member_id", profile.id)
          .maybeSingle();

        if (existing) {
          setResult({
            meeting,
            profile,
            checkInTime: existing.check_in_time ?? now.toISOString(),
            alreadyCheckedIn: true,
          });
          return;
        }

        if (!windowOpen) {
          setError(
            "Check-in for this meeting isn't open right now. Ask an officer to open the QR check-in window.",
          );
          return;
        }

        const { error: insertErr } = await supabase.from("attendance").insert({
          meeting_id: meeting.id,
          member_id: profile.id,
          status: "present",
          check_in_time: now.toISOString(),
          check_in_method: "qr_scan",
        });
        if (insertErr) throw insertErr;

        setResult({ meeting, profile, checkInTime: now.toISOString(), alreadyCheckedIn: false });
        toast.success(`Checked in for ${meeting.title}!`);
      } catch (err) {
        console.error("[admin/scan] check-in error", err);
        setError(err instanceof Error ? err.message : "Failed to record attendance.");
      } finally {
        setProcessing(false);
      }
    },
    [session],
  );

  // Support opening this page with ?m=<id>&t=<token> directly — e.g. a
  // member's phone camera app scanned the QR and opened this URL, or an
  // officer shared a direct link.
  useEffect(() => {
    if (typeof window === "undefined" || !session) return;
    const params = new URLSearchParams(window.location.search);
    const m = params.get("m");
    const t = params.get("t");
    if (m && t) {
      void processCheckIn(parseInt(m, 10), t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (isScanning) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraError(null);
      startDecodeLoop();
    } catch (err) {
      setCameraError(
        "Unable to access camera. Please check permissions, or paste the code below instead.",
      );
      console.error("[admin/scan] camera error:", err);
    }
  }

  function startDecodeLoop() {
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      const video = videoRef.current;
      if (!video || !ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(image.data, image.width, image.height, {
        inversionAttempts: "dontInvert",
      });

      const token = decoded?.data?.trim();
      if (token && token !== lastTokenRef.current && !inFlightRef.current) {
        lastTokenRef.current = token;
        inFlightRef.current = true;
        const parsed = parseScannedValue(token);
        const run = parsed
          ? processCheckIn(parsed.meetingId, parsed.token)
          : Promise.resolve(setError("Unrecognized QR code."));
        void run.finally(() => {
          inFlightRef.current = false;
          setTimeout(() => {
            lastTokenRef.current = null;
          }, 3000);
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  function stopCamera() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTokenRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function handleManualSubmit() {
    const parsed = parseScannedValue(manualInput);
    if (!parsed) {
      toast.error("That doesn't look like a valid check-in code.");
      return;
    }
    void processCheckIn(parsed.meetingId, parsed.token);
    setManualInput("");
  }

  function reset() {
    setResult(null);
    setError(null);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Scan className="h-6 w-6 text-primary" /> Scan Attendance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Point your camera at the meeting's check-in QR code to record your own attendance.
        </p>
      </div>

      <div className="max-w-md space-y-4">
        {result && (
          <Card
            className={`p-5 ${result.alreadyCheckedIn ? "border-blue-200 bg-blue-50" : "border-green-200 bg-green-50"}`}
          >
            <div className="flex items-start gap-3">
              <CheckCircle2
                className={`mt-0.5 h-6 w-6 flex-shrink-0 ${result.alreadyCheckedIn ? "text-blue-600" : "text-green-600"}`}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`font-semibold ${result.alreadyCheckedIn ? "text-blue-900" : "text-green-900"}`}
                >
                  {result.alreadyCheckedIn ? "Already checked in" : "Attendance recorded!"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(result.checkInTime).toLocaleString()}
                </p>

                <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <Avatar className="h-12 w-12 border border-border">
                    <AvatarImage
                      src={result.profile.photo_url ?? undefined}
                      alt={result.profile.first_name}
                    />
                    <AvatarFallback>
                      {initials(result.profile.first_name, result.profile.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {result.profile.first_name} {result.profile.last_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      RI #{result.profile.ri_number} · {result.profile.classification || "Member"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {result.profile.email} · {result.profile.phone}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> {result.meeting.title} —{" "}
                    {new Date(result.meeting.meeting_date).toLocaleDateString()}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> {result.meeting.start_time}
                  </p>
                  {result.meeting.venue && (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> {result.meeting.venue}
                    </p>
                  )}
                </div>

                <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
                  Scan another code
                </Button>
              </div>
            </div>
          </Card>
        )}

        {error && !result && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">Couldn't check you in</p>
                <p className="text-sm text-red-700">{error}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
                  Try again
                </Button>
              </div>
            </div>
          </Card>
        )}

        {!result && !error && (
          <>
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={() => setIsScanning((v) => !v)}
              variant={isScanning ? "destructive" : "default"}
              disabled={processing}
            >
              <Camera className="h-4 w-4" />
              {isScanning ? "Stop Scanning" : "Start Scanning"}
            </Button>

            {isScanning && (
              <div className="space-y-2">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  {cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 px-4">
                      <p className="text-center text-sm text-white">{cameraError}</p>
                    </div>
                  )}
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  {processing ? "Checking you in…" : "Position the meeting's QR code in frame"}
                </p>
              </div>
            )}

            <Card className="p-4">
              <Label htmlFor="manual" className="text-sm font-semibold text-foreground">
                Or paste the check-in code
              </Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="manual"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="https://.../admin/scan?m=..&t=.."
                  className="text-sm"
                />
                <Button onClick={handleManualSubmit} disabled={processing || !manualInput}>
                  Go
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
