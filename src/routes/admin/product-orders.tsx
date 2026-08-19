import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, X, PackageCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/product-orders")({
  component: AdminProductOrders,
});

type ProductOrder = Database["public"]["Tables"]["product_orders"]["Row"];
type OrderStatus = Database["public"]["Enums"]["product_order_status"];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  fulfilled: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

type OrderRow = ProductOrder & {
  member?: { first_name: string; last_name: string } | null;
  inventory_item?: { name: string } | null;
};

function AdminProductOrders() {
  const { role } = useAuth();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [myMemberId, setMyMemberId] = useState<number | null>(null);

  useEffect(() => {
    load();
    loadSelf();
  }, []);

  async function loadSelf() {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) return;
    const { data } = await supabase.from("members").select("id").eq("user_id", userId).maybeSingle();
    if (data) setMyMemberId(data.id);
  }

  async function load() {
    const { data, error } = await supabase
      .from("product_orders")
      .select(`*,member:members(first_name,last_name),inventory_item:inventory_items(name)`)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[admin/product-orders] failed to load", error);
      toast.error("Couldn't load product orders.");
      return;
    }
    setOrders(data as any);
  }

  async function updateStatus(order: ProductOrder, status: OrderStatus) {
    setBusyId(order.id.toString());
    try {
      const { error } = await supabase
        .from("product_orders")
        .update({
          status,
          decided_by: myMemberId,
          decided_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      if (error) throw error;
      toast.success(`Order marked ${status}.`);
      load();
    } catch (err) {
      console.error("[admin/product-orders] update error", err);
      toast.error("Failed to update order.");
    } finally {
      setBusyId(null);
    }
  }

  if (role && !["admin", "treasurer"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to product orders.</div>;
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Product Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Purchases members have placed in the club shop, awaiting approval and fulfilment.
        </p>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Order No</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders === null && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {orders?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No product orders yet.
                </TableCell>
              </TableRow>
            )}
            {orders?.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono font-semibold text-foreground">{o.order_no}</TableCell>
                <TableCell className="font-semibold text-foreground">
                  {o.member?.first_name} {o.member?.last_name}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{o.inventory_item?.name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{o.quantity}</TableCell>
                <TableCell className="font-semibold">
                  {Number(o.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[o.status]}>{o.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    {o.status === "pending" && (
                      <>
                        <button
                          title="Approve"
                          disabled={busyId === o.id.toString()}
                          onClick={() => updateStatus(o, "approved")}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          title="Cancel"
                          disabled={busyId === o.id.toString()}
                          onClick={() => updateStatus(o, "cancelled")}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {o.status === "approved" && (
                      <button
                        title="Mark fulfilled"
                        disabled={busyId === o.id.toString()}
                        onClick={() => updateStatus(o, "fulfilled")}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        <PackageCheck className="h-4 w-4" />
                      </button>
                    )}
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
