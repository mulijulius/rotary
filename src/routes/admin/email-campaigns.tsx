import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Trash2, Send, Users, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CLUB } from "@/lib/club-content";
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
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/admin/email-campaigns")({
  component: AdminEmailCampaigns,
});

type EmailCampaign = Database["public"]["Tables"]["email_campaigns"]["Row"];
type EmailStatus = Database["public"]["Enums"]["email_status"];
type EmailRecipientType = Database["public"]["Enums"]["email_recipient_type"];

type Recipient = {
  key: string;
  name: string;
  email: string;
  source: "member" | "visitor";
};

const statusVariant: Record<EmailStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  scheduled: "secondary",
  sent: "default",
  failed: "destructive",
};

type CampaignFormData = Omit<EmailCampaign, "id" | "created_by" | "created_at" | "updated_at">;

const emptyForm: CampaignFormData = {
  title: "",
  subject: "",
  body_html: "",
  recipient_type: "member",
  status: "draft",
  scheduled_at: null,
  sent_at: null,
  recipient_emails: null,
};

/** Strip HTML tags down to readable plain text for the Gmail compose body. */
function htmlToPlainText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ");
  const stripped = withBreaks.replace(/<[^>]+>/g, "");
  const decoded = stripped
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return decoded.replace(/\n{3,}/g, "\n\n").trim();
}

/** Opens Gmail's web compose window pre-filled with subject/body/bcc, in the club's account context. */
function openGmailCompose(params: { to?: string; bcc: string[]; subject: string; body: string }) {
  const url = new URL("https://mail.google.com/mail/");
  url.searchParams.set("view", "cm");
  url.searchParams.set("fs", "1");
  url.searchParams.set("tf", "1");
  url.searchParams.set("authuser", CLUB.email);
  if (params.to) url.searchParams.set("to", params.to);
  if (params.bcc.length > 0) url.searchParams.set("bcc", params.bcc.join(","));
  url.searchParams.set("su", params.subject);
  url.searchParams.set("body", params.body);
  window.open(url.toString(), "_blank", "noopener,noreferrer");
}

function AdminEmailCampaigns() {
  const { role } = useAuth();
  const [campaigns, setCampaigns] = useState<EmailCampaign[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<EmailCampaign | null>(null);
  const [formData, setFormData] = useState<CampaignFormData>(emptyForm);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Custom recipient picker state
  const [allRecipients, setAllRecipients] = useState<Recipient[] | null>(null);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("email_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[admin/email-campaigns] failed to load", error);
      toast.error("Couldn't load campaigns.");
      return;
    }
    setCampaigns(data);
  }

  async function loadRecipientDirectory() {
    if (allRecipients) return allRecipients;
    const [membersRes, visitorsRes] = await Promise.all([
      supabase.from("members").select("id, first_name, last_name, email, status"),
      supabase.from("visitors").select("id, first_name, last_name, email"),
    ]);
    if (membersRes.error) console.error("[admin/email-campaigns] members load error", membersRes.error);
    if (visitorsRes.error) console.error("[admin/email-campaigns] visitors load error", visitorsRes.error);

    const members: Recipient[] = (membersRes.data ?? [])
      .filter((m) => m.email)
      .map((m) => ({
        key: `member-${m.id}`,
        name: `${m.first_name} ${m.last_name}`,
        email: m.email,
        source: "member" as const,
      }));
    const visitors: Recipient[] = (visitorsRes.data ?? [])
      .filter((v) => v.email)
      .map((v) => ({
        key: `visitor-${v.id}`,
        name: `${v.first_name} ${v.last_name}`,
        email: v.email,
        source: "visitor" as const,
      }));

    const combined = [...members, ...visitors].sort((a, b) => a.name.localeCompare(b.name));
    setAllRecipients(combined);
    return combined;
  }

  function handleOpenDialog(campaign?: EmailCampaign) {
    setRecipientSearch("");
    if (campaign) {
      setEditingCampaign(campaign);
      setFormData({
        title: campaign.title,
        subject: campaign.subject,
        body_html: campaign.body_html,
        recipient_type: campaign.recipient_type,
        status: campaign.status,
        scheduled_at: campaign.scheduled_at,
        sent_at: campaign.sent_at,
        recipient_emails: campaign.recipient_emails,
      });
      setSelectedEmails(new Set(campaign.recipient_emails ?? []));
    } else {
      setEditingCampaign(null);
      setFormData(emptyForm);
      setSelectedEmails(new Set());
    }
    if (campaign?.recipient_type === "list" || !campaign) {
      loadRecipientDirectory();
    }
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingCampaign(null);
  }

  function handleRecipientTypeChange(value: EmailRecipientType) {
    setFormData((prev) => ({ ...prev, recipient_type: value }));
    if (value === "list") {
      loadRecipientDirectory();
    }
  }

  function toggleRecipient(email: string) {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  const filteredRecipients = useMemo(() => {
    const list = allRecipients ?? [];
    const q = recipientSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [allRecipients, recipientSearch]);

  async function handleSaveCampaign() {
    if (!formData.title || !formData.subject || !formData.body_html) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (formData.recipient_type === "list" && selectedEmails.size === 0) {
      toast.error("Select at least one recipient for a custom list.");
      return;
    }

    setBusyId("save");
    try {
      const recipientEmails = formData.recipient_type === "list" ? Array.from(selectedEmails) : null;

      if (editingCampaign) {
        const { error } = await supabase
          .from("email_campaigns")
          .update({
            title: formData.title,
            subject: formData.subject,
            body_html: formData.body_html,
            recipient_type: formData.recipient_type,
            status: formData.status,
            scheduled_at: formData.scheduled_at,
            recipient_emails: recipientEmails,
          })
          .eq("id", editingCampaign.id);
        if (error) throw error;
        toast.success("Campaign updated successfully.");
      } else {
        const { error } = await supabase.from("email_campaigns").insert({
          title: formData.title,
          subject: formData.subject,
          body_html: formData.body_html,
          recipient_type: formData.recipient_type,
          status: formData.status,
          scheduled_at: formData.scheduled_at,
          recipient_emails: recipientEmails,
        });
        if (error) throw error;
        toast.success("Campaign created successfully.");
      }
      handleCloseDialog();
      load();
    } catch (error: any) {
      console.error("[admin/email-campaigns] save error", error);
      toast.error(error.message || "Failed to save campaign.");
    } finally {
      setBusyId(null);
    }
  }

  async function resolveRecipientEmails(campaign: EmailCampaign): Promise<string[]> {
    if (campaign.recipient_type === "list") {
      return campaign.recipient_emails ?? [];
    }
    if (campaign.recipient_type === "member") {
      const { data, error } = await supabase
        .from("members")
        .select("email, status")
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []).map((m) => m.email).filter(Boolean);
    }
    // visitor
    const { data, error } = await supabase.from("visitors").select("email");
    if (error) throw error;
    return (data ?? []).map((v) => v.email).filter(Boolean);
  }

  async function handleSendCampaign(campaign: EmailCampaign) {
    setBusyId(`send-${campaign.id}`);
    try {
      const emails = await resolveRecipientEmails(campaign);
      if (emails.length === 0) {
        toast.error("No recipient email addresses were found for this campaign.");
        return;
      }
      if (!confirm(`This will open Gmail with ${emails.length} recipient(s) BCC'd. Continue?`)) {
        return;
      }

      openGmailCompose({
        bcc: emails,
        subject: campaign.subject,
        body: htmlToPlainText(campaign.body_html),
      });

      const { error } = await supabase
        .from("email_campaigns")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);
      if (error) throw error;
      toast.success(`Gmail opened for "${campaign.title}". Review and hit send in Gmail.`);
      load();
    } catch (error: any) {
      console.error("[admin/email-campaigns] send error", error);
      toast.error(error.message || "Failed to prepare campaign email.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteCampaign(id: number) {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    try {
      const { error } = await supabase.from("email_campaigns").delete().eq("id", id);
      if (error) throw error;
      toast.success("Campaign deleted.");
      load();
    } catch (error: any) {
      console.error("[admin/email-campaigns] delete error", error);
      toast.error("Failed to delete campaign.");
    }
  }

  if (role && !["admin", "secretary"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to email campaigns.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Email Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage email communications with members and visitors. Sending opens Gmail
            ({CLUB.email}) with the recipients BCC'd so you can review before hitting send.
          </p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCampaign ? "Edit Campaign" : "Create New Campaign"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="title">Campaign Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Monthly Newsletter"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="subject">Email Subject *</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Subject line for the email"
                />
              </div>
              <div>
                <Label htmlFor="recipient_type">Recipients *</Label>
                <Select
                  value={formData.recipient_type}
                  onValueChange={(value: EmailRecipientType) => handleRecipientTypeChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Members</SelectItem>
                    <SelectItem value="visitor">Visitors</SelectItem>
                    <SelectItem value="list">Custom List</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.recipient_type === "list" && (
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-1.5 text-sm">
                      <Users className="h-3.5 w-3.5" />
                      Select Recipients ({selectedEmails.size} selected)
                    </Label>
                  </div>
                  <div className="relative mt-2">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="pl-8 h-9"
                    />
                  </div>
                  <ScrollArea className="mt-2 h-56 rounded-md border border-border">
                    <div className="p-2">
                      {allRecipients === null ? (
                        <p className="p-2 text-sm text-muted-foreground">Loading recipients...</p>
                      ) : filteredRecipients.length === 0 ? (
                        <p className="p-2 text-sm text-muted-foreground">No matches found.</p>
                      ) : (
                        filteredRecipients.map((r) => (
                          <label
                            key={r.key}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                          >
                            <Checkbox
                              checked={selectedEmails.has(r.email)}
                              onCheckedChange={() => toggleRecipient(r.email)}
                            />
                            <span className="flex-1 truncate text-sm">{r.name}</span>
                            <span className="truncate text-xs text-muted-foreground">{r.email}</span>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {r.source}
                            </Badge>
                          </label>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <div>
                <Label htmlFor="body_html">Email Body (HTML) *</Label>
                <Textarea
                  id="body_html"
                  value={formData.body_html}
                  onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                  placeholder="<p>Email content here...</p>"
                  className="font-mono text-sm h-48"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="scheduled_at">Schedule For (Optional)</Label>
                  <Input
                    id="scheduled_at"
                    type="datetime-local"
                    value={formData.scheduled_at ? new Date(formData.scheduled_at).toISOString().slice(0, 16) : ""}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button onClick={handleSaveCampaign} disabled={busyId === "save"}>
                  {editingCampaign ? "Update" : "Create"} Campaign
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
              <TableHead>Subject</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns && campaigns.length > 0 ? (
              campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{campaign.subject}</TableCell>
                  <TableCell className="text-sm capitalize">
                    {campaign.recipient_type === "list"
                      ? `Custom list (${campaign.recipient_emails?.length ?? 0})`
                      : campaign.recipient_type}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[campaign.status]}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(campaign.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {campaign.status === "draft" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDialog(campaign)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-600 hover:text-green-700"
                            onClick={() => handleSendCampaign(campaign)}
                            disabled={busyId === `send-${campaign.id}`}
                            title="Open in Gmail and send"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteCampaign(campaign.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No campaigns yet. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
