import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingCart, Package } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/shop")({
  component: MemberShop,
});

type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];
type ProductOrder = Database["public"]["Tables"]["product_orders"]["Row"];
type OrderStatus = Database["public"]["Enums"]["product_order_status"];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  fulfilled: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

// Stock below this many units (but still > 0) is flagged as "Low Stock".
const LOW_STOCK_THRESHOLD = 3;

function stockBadge(quantity: number): { label: string; className: string } | null {
  if (quantity <= 0) {
    return { label: "Out of Stock", className: "bg-red-100 text-red-800" };
  }
  if (quantity <= LOW_STOCK_THRESHOLD) {
    return { label: "Low Stock", className: "bg-amber-100 text-amber-800" };
  }
  return null;
}

function errorMessage(err: unknown, fallback: string): string {
  // Supabase/Postgres errors (including RAISE EXCEPTION text from the
  // stock-deduction trigger) are plain objects with a `message` string,
  // not real Error instances, so surface that text when present instead of
  // always falling back to a generic message.
  if (err && typeof err === "object" && "message" in err && typeof (err as any).message === "string" && (err as any).message) {
    return (err as any).message;
  }
  return fallback;
}

function makeOrderNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  const rand = Math.floor(Math.random() * 900 + 100);
  return `ORD-${y}${m}${d}-${rand}`;
}

function MemberShop() {
  const [memberId, setMemberId] = useState<number | null>(null);
  const [memberLoading, setMemberLoading] = useState(true);

  const [products, setProducts] = useState<InventoryItem[] | null>(null);
  const [myOrders, setMyOrders] = useState<ProductOrder[] | null>(null);

  const [buyItem, setBuyItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMember();
    loadProducts();
  }, []);

  async function loadMember() {
    setMemberLoading(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) {
      setMemberLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[admin/shop] failed to resolve member", error);
      toast.error("Couldn't confirm your member profile.");
    }
    if (data) {
      setMemberId(data.id);
      loadMyOrders(data.id);
    }
    setMemberLoading(false);
  }

  async function loadProducts() {
    // Include out-of-stock items too (rather than hiding them) so members
    // can see "Out of Stock" instead of the product silently disappearing.
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("is_for_sale", true)
      .order("name", { ascending: true });
    if (error) {
      console.error("[admin/shop] failed to load products", error);
      toast.error("Couldn't load products.");
      return;
    }
    setProducts(data);
  }

  async function loadMyOrders(mId: number) {
    const { data, error } = await supabase
      .from("product_orders")
      .select("*")
      .eq("member_id", mId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[admin/shop] failed to load orders", error);
      return;
    }
    setMyOrders(data);
  }

  function openBuyDialog(item: InventoryItem) {
    if (item.quantity <= 0) {
      toast.error("This item is out of stock.");
      return;
    }
    setBuyItem(item);
    setQuantity(1);
    setNotes("");
  }

  async function handlePlaceOrder() {
    if (!buyItem || !memberId) return;
    if (quantity <= 0) {
      toast.error("Enter a quantity of at least 1.");
      return;
    }
    if (quantity > buyItem.quantity) {
      toast.error(`Only ${buyItem.quantity} left in stock.`);
      return;
    }
    if (!buyItem.sale_price || buyItem.sale_price <= 0) {
      toast.error("This item doesn't have a price set yet — check with an officer.");
      return;
    }

    setSaving(true);
    try {
      // Stock is deducted immediately (by a database trigger) the moment
      // this insert succeeds — it also rejects the order outright if
      // another member beat us to the last units in the meantime.
      const { error } = await supabase.from("product_orders").insert({
        order_no: makeOrderNo(),
        member_id: memberId,
        inventory_item_id: buyItem.id,
        quantity,
        unit_price: buyItem.sale_price,
        notes: notes || null,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Order placed. Stock has been updated and the treasurer will confirm it shortly.");
      setBuyItem(null);
      loadMyOrders(memberId);
      loadProducts(); // refresh remaining stock / out-of-stock state
    } catch (err) {
      console.error("[admin/shop] order error", err);
      toast.error(errorMessage(err, "Failed to place order."));
    } finally {
      setSaving(false);
    }
  }

  if (memberLoading) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  if (!memberId) {
    return (
      <div className="text-muted-foreground">
        Your account isn't linked to a member profile yet, so you can't place orders. Contact a club officer.
      </div>
    );
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Club Shop</h1>
        <p className="mt-1 text-sm text-muted-foreground">Browse and purchase club merchandise and fundraiser items.</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products === null && <p className="text-muted-foreground">Loading products…</p>}
        {products?.length === 0 && (
          <p className="text-muted-foreground">No products are listed for sale right now.</p>
        )}
        {products?.map((item) => {
          const badge = stockBadge(item.quantity);
          const outOfStock = item.quantity <= 0;
          return (
          <Card key={item.id} className="overflow-hidden p-0">
            <div className="relative flex h-36 w-full items-center justify-center bg-muted">
              {(item as any).photo_url ? (
                <img
                  src={(item as any).photo_url}
                  alt={item.name}
                  className={`h-full w-full object-cover ${outOfStock ? "opacity-50 grayscale" : ""}`}
                />
              ) : (
                <Package className="h-8 w-8 text-muted-foreground" />
              )}
              {badge && (
                <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
              )}
            </div>
            <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{item.name}</p>
                {item.description && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-lg font-bold text-foreground">
                {item.sale_price
                  ? Number(item.sale_price).toLocaleString(undefined, { minimumFractionDigits: 2 })
                  : "Price TBC"}
              </span>
              <span className={`text-xs ${outOfStock ? "font-semibold text-red-600" : badge ? "font-semibold text-amber-600" : "text-muted-foreground"}`}>
                {outOfStock ? "Out of stock" : `${item.quantity} in stock`}
              </span>
            </div>
            <Button
              size="sm"
              className="mt-3 w-full gap-2"
              onClick={() => openBuyDialog(item)}
              disabled={!item.sale_price || outOfStock}
            >
              <ShoppingCart className="h-4 w-4" />
              {outOfStock ? "Out of Stock" : "Buy"}
            </Button>
            </div>
          </Card>
          );
        })}
      </div>

      <Dialog open={!!buyItem} onOpenChange={(open) => !open && setBuyItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buy {buyItem?.name}</DialogTitle>
          </DialogHeader>
          {buyItem && (
            <div className="space-y-4">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  max={buyItem.quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input
                  placeholder="e.g. size, color, pickup preference"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold text-foreground">
                    {((buyItem.sale_price || 0) * quantity).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setBuyItem(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handlePlaceOrder} disabled={saving}>
                  {saving ? "Placing…" : "Place Order"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="mt-10">
        <h2 className="text-lg font-bold text-foreground">My Orders</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Order No</th>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Qty</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {myOrders === null && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {myOrders?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    You haven't placed any orders yet.
                  </td>
                </tr>
              )}
              {myOrders?.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono">{o.order_no}</td>
                  <td className="px-4 py-2">
                    {products?.find((p) => p.id === o.inventory_item_id)?.name || `Item #${o.inventory_item_id}`}
                  </td>
                  <td className="px-4 py-2">{o.quantity}</td>
                  <td className="px-4 py-2">{Number(o.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2">
                    <Badge className={STATUS_COLORS[o.status]}>{o.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
