import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/visitor-registration")({
  component: VisitorRegistration,
});

function VisitorRegistration() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    organization: "",
    interest: "general" as "general" | "membership" | "projects" | "events" | "other",
    notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.first_name || !formData.last_name || !formData.email) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("visitors").insert({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone || null,
        organization: formData.organization || null,
        interest: formData.interest,
        notes: formData.notes || null,
        meeting_id: null,
        visited_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Thank you for registering! We'll be in touch soon.");
      setSubmitted(true);
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        organization: "",
        interest: "general",
        notes: "",
      });

      // Reset form after 5 seconds
      setTimeout(() => setSubmitted(false), 5000);
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error("Failed to submit registration. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Thank You!</h2>
          <p className="text-muted-foreground">
            We've received your information and will get in touch with you soon. Welcome to our community!
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4">
      <div className="max-w-md w-full mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Join Our Community</h1>
          <p className="text-muted-foreground mt-2">
            Register as a visitor and stay connected with us
          </p>
        </div>

        {/* Form */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="John"
                  required
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+254 712 345 678"
              />
            </div>

            <div>
              <Label htmlFor="organization">Organization / Company</Label>
              <Input
                id="organization"
                value={formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                placeholder="Your organization (optional)"
              />
            </div>

            <div>
              <Label htmlFor="interest">What are you interested in? *</Label>
              <Select value={formData.interest} onValueChange={(value: any) => setFormData({ ...formData, interest: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Information</SelectItem>
                  <SelectItem value="membership">Membership</SelectItem>
                  <SelectItem value="projects">Community Projects</SelectItem>
                  <SelectItem value="events">Events & Activities</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">How did you hear about us?</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Tell us how you found out about us..."
                className="resize-none"
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              <Send className="h-4 w-4" />
              {loading ? "Registering..." : "Register as Visitor"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              We'll use your information to keep you updated on our activities and events.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
