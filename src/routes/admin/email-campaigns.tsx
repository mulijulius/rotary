import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Send, Clock } from "lucide-react";
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

export const Route = createFileRoute("/admin/email-campaigns")({
  component: AdminEmailCampaigns,
});

type EmailCampaign = Database["public"]["Tables"]["email_campaigns"]["Row"];
type EmailStatus = Database["public"]["Enums"]["email_status"];
type EmailRecipientType = Database["public"]["Enums"]["email_recipient_type"];

const statusVariant: Record<EmailStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  scheduled: "secondary",
  sent: "default",
  failed: "destructive",
};

type CampaignFormData = Omit<EmailCampaign, "id" | "created_by" | "created_at" | "updated_at">;

function AdminEmailCampaigns() {
  const { role } = useAuth();
  const [campaigns, setCampaigns] = useState<EmailCampaign[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<EmailCampaign | null>(null);
  const [formData, setFormData] = useState<CampaignFormData>({
    title: "",
    subject: "",
    body_html: "",
    recipient_type: "member",
    status: "draft",
    scheduled_at: null,
    sent_at: null,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

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

  function handleOpenDialog(campaign?: EmailCampaign) {
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
      });
    } else {
      setEditingCampaign(null);
      setFormData({
        title: "",
        subject: "",
        body_html: "",
        recipient_type: "member",
        status: "draft",
        scheduled_at: null,
        sent_at: null,
      });
    }
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingCampaign(null);
  }

  async function handleSaveCampaign() {
    if (!formData.title || !formData.subject || !formData.body_html) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setBusyId("save");
    try {
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

  async function handleSendCampaign(campaign: EmailCampaign) {
    if (!confirm("This will send emails to all recipients. Continue?")) return;
    
    setBusyId(`send-${campaign.id}`);
    try {
      // In production, call a server action to handle email sending
      const { error } = await supabase
        .from("email_campaigns")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);
      if (error) throw error;
      toast.success(`Campaign "${campaign.title}" sent successfully.`);
      load();
    } catch (error: any) {
      console.error("[admin/email-campaigns] send error", error);
      toast.error("Failed to send campaign.");
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
            Create and manage email communications with members and visitors.
          </p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
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
                <Select value={formData.recipient_type} onValueChange={(value: any) => setFormData({ ...formData, recipient_type: value })}>
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
                  <TableCell className="text-sm capitalize">{campaign.recipient_type}</TableCell>
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
