import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { roleLabel, useAuth } from "@/lib/auth";
import {
  fetchOwnProfile,
  subscribeToOwnProfile,
  updateOwnProfile,
  uploadAvatar,
  type MemberProfile,
} from "@/lib/member-profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/profile")({
  component: MyProfile,
});

const STATUS_LABEL: Record<MemberProfile["status"], string> = {
  active: "Active",
  leave_of_absence: "Leave of Absence",
  honorary: "Honorary",
  alumni: "Alumni",
  terminated: "Terminated",
};

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";
}

function MyProfile() {
  const { session, role } = useAuth();
  const userId = session?.user.id ?? null;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial fetch of the profile linked to the signed-in account.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    fetchOwnProfile(userId)
      .then((row) => {
        if (cancelled) return;
        setProfile(row);
        if (row) {
          setFirstName(row.first_name);
          setLastName(row.last_name);
          setPhone(row.phone);
        }
      })
      .catch((error: unknown) => {
        console.error("[profile] failed to load", error);
        toast.error("Couldn't load your profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Live updates — if an officer edits this row elsewhere while the page
  // is open, reflect it immediately (but don't clobber a field the member
  // is actively typing into right now).
  useEffect(() => {
    if (!profile?.id) return;
    const unsubscribe = subscribeToOwnProfile(profile.id, (row) => {
      setProfile(row);
      setFirstName((prev) => (prev === profile.first_name ? row.first_name : prev));
      setLastName((prev) => (prev === profile.last_name ? row.last_name : prev));
      setPhone((prev) => (prev === profile.phone ? row.phone : prev));
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  function handleAvatarSelected(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB.");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!profile || !userId) return;
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      toast.error("First name, last name, and phone are required.");
      return;
    }

    setSaving(true);
    try {
      let photoUrl: string | undefined;
      if (avatarFile) {
        photoUrl = await uploadAvatar(userId, avatarFile);
      }
      const updated = await updateOwnProfile(profile.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        ...(photoUrl ? { photo_url: photoUrl } : {}),
      });
      setProfile(updated);
      setAvatarFile(null);
      setAvatarPreview(null);
      toast.success("Profile updated.");
    } catch (error: unknown) {
      console.error("[profile] save failed", error);
      toast.error(error instanceof Error ? error.message : "Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <Card className="max-w-lg p-6">
        <h1 className="text-lg font-bold text-foreground">My Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account isn't linked to a member profile yet. Contact a club officer to get
          linked, then this page will let you keep your details up to date.
        </p>
      </Card>
    );
  }

  const displayPhoto = avatarPreview ?? profile.photo_url ?? undefined;
  const dirty =
    firstName.trim() !== profile.first_name ||
    lastName.trim() !== profile.last_name ||
    phone.trim() !== profile.phone ||
    avatarFile !== null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your name, phone number, and photo. Changes save immediately.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative"
              aria-label="Change profile photo"
            >
              <Avatar className="h-24 w-24 border border-border">
                <AvatarImage src={displayPhoto} alt={`${profile.first_name} ${profile.last_name}`} />
                <AvatarFallback className="text-lg font-semibold">
                  {initials(profile.first_name, profile.last_name)}
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-transparent transition-colors group-hover:bg-black/40 group-hover:text-white">
                <Camera size={20} />
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleAvatarSelected(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={14} className="mr-1.5" /> Change photo
            </Button>
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{STATUS_LABEL[profile.status]}</Badge>
              {role && <Badge>{roleLabel(role)}</Badge>}
              <span className="text-xs text-muted-foreground">RI #{profile.ri_number}</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="first_name">First name</Label>
                <Input
                  id="first_name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">Last name</Label>
                <Input
                  id="last_name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  maxLength={80}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
                placeholder="+254 7XX XXX XXX"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={profile.email} disabled />
              <p className="text-xs text-muted-foreground">
                Email is tied to your login — ask an officer to change it.
              </p>
            </div>

            {profile.classification && (
              <div className="space-y-1.5">
                <Label>Classification</Label>
                <Input value={profile.classification} disabled />
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={!dirty || saving}>
                {saving ? (
                  <Loader2 size={16} className="mr-1.5 animate-spin" />
                ) : (
                  <Save size={16} className="mr-1.5" />
                )}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
