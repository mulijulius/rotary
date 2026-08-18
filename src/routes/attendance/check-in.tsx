import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Scan, MapPin, Calendar, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import jsQR from "jsqr";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/attendance/check-in")({
  component: AttendanceCheckIn,
  head: () => ({
    meta: [
      { title: "Meeting Check-In | Rotary Club" },
      {
        name: "description",
        content:
          "Scan your Rotary member QR code to record attendance at today's club meeting.",
      },
      { property: "og:title", content: "Meeting Check-In | Rotary Club" },
      {
        property: "og:description",
        content: "Scan your member QR code to record meeting attendance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Member = Database["public"]["Tables"]["members"]["Row"];
type Meeting = Database["public"]["Tables"]["meetings"]["Row"];

function AttendanceCheckIn() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [scannedMember, setScannedMember] = useState<Member | null>(null);
  const [checkedInTime, setCheckedInTime] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // Guards against the decode loop firing the same token dozens of times a
  // second while the code stays in frame.
  const inFlightRef = useRef(false);
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    loadMeetings();
  }, []);

  useEffect(() => {
    if (selectedMeeting && isScanning) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isScanning, selectedMeeting]);


  async function loadMeetings() {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("is_closed", false)
      .gte("checkin_opens_at", new Date().toISOString())
      .order("meeting_date", { ascending: true });

    if (error) {
      console.error("Failed to load meetings", error);
      toast.error("Failed to load available meetings");
      return;
    }
    setMeetings(data);
    if (data.length > 0) {
      setSelectedMeeting(data[0]!);
    }
  }

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
      setError(null);
      startDecodeLoop();
    } catch (err: any) {
      setError("Unable to access camera. Please check permissions.");
      console.error("Camera error:", err);
    }
  }

  // Grabs frames off the live video into an offscreen canvas and hands the
  // pixels to jsQR. Runs on requestAnimationFrame so it stops with the tab.
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
      const result = jsQR(image.data, image.width, image.height, {
        inversionAttempts: "dontInvert",
      });

      const token = result?.data?.trim();
      if (token && token !== lastTokenRef.current && !inFlightRef.current) {
        lastTokenRef.current = token;
        inFlightRef.current = true;
        void handleQRCodeScanned(token).finally(() => {
          inFlightRef.current = false;
          // Allow the same badge again after the success card clears.
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


  async function handleQRCodeScanned(qrToken: string) {
    if (!selectedMeeting) {
      toast.error("Please select a meeting first.");
      return;
    }

    try {
      // Look up member by QR token
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("*")
        .eq("qr_token", qrToken)
        .single();

      if (memberError || !memberData) {
        toast.error("QR code not recognized. Please try again.");
        return;
      }

      // Check if already checked in
      const { data: existingAttendance } = await supabase
        .from("attendance")
        .select("*")
        .eq("meeting_id", selectedMeeting.id)
        .eq("member_id", memberData.id)
        .single();

      if (existingAttendance) {
        toast.warning(`${memberData.first_name} is already checked in.`);
        return;
      }

      // Record attendance
      const now = new Date();
      const { error: insertError } = await supabase
        .from("attendance")
        .insert({
          meeting_id: selectedMeeting.id,
          member_id: memberData.id,
          status: "present",
          check_in_time: now.toISOString(),
          check_in_method: "qr_scan",
        });

      if (insertError) throw insertError;

      // Show success feedback
      setScannedMember(memberData);
      setCheckedInTime(now.toLocaleTimeString());
      toast.success(`Welcome ${memberData.first_name}!`);

      // Reset after 3 seconds
      setTimeout(() => {
        setScannedMember(null);
        setCheckedInTime(null);
      }, 3000);
    } catch (err: any) {
      console.error("Check-in error:", err);
      toast.error("Failed to record attendance");
    }
  }

  // Simulated QR code handling - in production, use a library like jsQR or html5-qrcode
  const handleManualQREntry = async (qrToken: string) => {
    await handleQRCodeScanned(qrToken);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2">
            <Scan className="h-8 w-8 text-primary" />
            Check In
          </h1>
          <p className="text-muted-foreground mt-1">Scan your QR code to record attendance</p>
        </div>

        {/* Meeting Selection */}
        <Card className="p-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Select Meeting</label>
            <select
              value={selectedMeeting?.id || ""}
              onChange={(e) => {
                const meeting = meetings.find((m) => m.id === parseInt(e.target.value));
                setSelectedMeeting(meeting || null);
                setScannedMember(null);
              }}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
            >
              {meetings.length === 0 ? (
                <option>No active meetings</option>
              ) : (
                meetings.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.title} - {new Date(meeting.meeting_date).toLocaleDateString()}
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedMeeting && (
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(selectedMeeting.meeting_date).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {selectedMeeting.start_time}
              </div>
              {selectedMeeting.venue && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {selectedMeeting.venue}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Camera Section */}
        {selectedMeeting && (
          <>
            <Button
              size="lg"
              className="w-full"
              onClick={() => setIsScanning(!isScanning)}
              variant={isScanning ? "destructive" : "default"}
            >
              {isScanning ? "Stop Scanning" : "Start Scanning"}
            </Button>

            {isScanning && (
              <div className="space-y-3">
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {error && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <p className="text-white text-center px-4">{error}</p>
                    </div>
                  )}
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Position QR code in front of camera
                </p>
              </div>
            )}

            {/* Success Feedback */}
            {scannedMember && (
              <Card className="p-4 bg-green-50 border-green-200">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-green-900">
                      {scannedMember.first_name} {scannedMember.last_name}
                    </p>
                    <p className="text-sm text-green-700">Checked in at {checkedInTime}</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Manual QR Entry */}
            <Card className="p-4">
              <label className="text-sm font-semibold text-foreground">Manual QR Entry</label>
              <input
                type="text"
                placeholder="Paste QR token here"
                onPaste={(e) => {
                  const token = e.clipboardData?.getData("text");
                  if (token) {
                    handleManualQREntry(token);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
                className="w-full mt-2 px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
              />
            </Card>
          </>
        )}

        {!selectedMeeting && meetings.length === 0 && (
          <Card className="p-4 bg-yellow-50 border-yellow-200">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-yellow-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-yellow-900">No Active Meetings</p>
                <p className="text-sm text-yellow-700">There are no meetings currently accepting check-ins.</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
