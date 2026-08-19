import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Eye, Send } from "lucide-react";
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

export const Route = createFileRoute("/admin/invoices")({
  component: AdminInvoices,
});

type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  issued: "bg-blue-100 text-blue-800",
  partially_paid: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  void: "bg-red-100 text-red-800",
};

function AdminInvoices() {
  const { role } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("invoices")
      .select(`*,member:members(first_name,last_name)`)
      .order("invoice_date", { ascending: false });
    if (error) {
      console.error("[admin/invoices] failed to load", error);
      toast.error("Couldn't load invoices.");
      return;
    }
    setInvoices(data as any);
  }

  async function handleUpdateStatus(invoice: Invoice, status: InvoiceStatus) {
    setBusyId(invoice.id.toString());
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status })
        .eq("id", invoice.id);
      if (error) throw error;
      toast.success(`Invoice marked as ${status}.`);
      load();
    } catch (err) {
      console.error("[admin/invoices] update error", err);
      toast.error("Failed to update invoice.");
    } finally {
      setBusyId(null);
    }
  }

  if (role && !["admin", "treasurer"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to invoices.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and manage member invoices for dues and fundraisers.</p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Invoice No</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Amount Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices === null && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {invoices?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No invoices yet.
                </TableCell>
              </TableRow>
            )}
            {invoices?.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono font-semibold text-foreground">{inv.invoice_no}</TableCell>
                <TableCell className="font-semibold text-foreground">
                  {(inv as any).member?.first_name} {(inv as any).member?.last_name}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(inv.invoice_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(inv.due_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="font-semibold">—</TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[inv.status]}>
                    {inv.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      title="View"
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {inv.status === "issued" && (
                      <button
                        title="Send"
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 p-4 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-800">
        <p className="font-semibold">Full Invoice Management Coming Soon</p>
        <p className="mt-1">Create invoices with line items, track payments, and generate payment receipts.</p>
      </div>
    </div>
  );
}
