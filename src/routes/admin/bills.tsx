import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Eye } from "lucide-react";
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

export const Route = createFileRoute("/admin/bills")({
  component: AdminBills,
});

type Bill = Database["public"]["Tables"]["bills"]["Row"];
type BillStatus = Database["public"]["Enums"]["bill_status"];

const STATUS_COLORS: Record<BillStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  received: "bg-blue-100 text-blue-800",
  partially_paid: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  void: "bg-red-100 text-red-800",
};

function AdminBills() {
  const { role } = useAuth();
  const [bills, setBills] = useState<Bill[] | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("bills")
      .select(`*,vendor:vendors(name)`)
      .order("bill_date", { ascending: false });
    if (error) {
      console.error("[admin/bills] failed to load", error);
      toast.error("Couldn't load bills.");
      return;
    }
    setBills(data as any);
  }

  if (role && !["admin", "treasurer"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to bills.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bills (Accounts Payable)</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track vendor invoices and payments.</p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Record Bill
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill No</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills === null && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {bills?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No bills recorded yet.
                </TableCell>
              </TableRow>
            )}
            {bills?.map((bill) => (
              <TableRow key={bill.id}>
                <TableCell className="font-mono font-semibold text-foreground">{bill.bill_no}</TableCell>
                <TableCell className="font-semibold text-foreground">
                  {(bill as any).vendor?.name || "Unknown"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(bill.bill_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(bill.due_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="font-semibold">—</TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[bill.status]}>
                    {bill.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <button
                    title="View"
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 p-4 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-800">
        <p className="font-semibold">Full Bill Management Coming Soon</p>
        <p className="mt-1">Record and track vendor bills, manage payments, and reconcile accounts payable.</p>
      </div>
    </div>
  );
}
