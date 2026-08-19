import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown } from "lucide-react";
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
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/admin/inventory")({
  component: AdminInventory,
});

type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];
type InventoryCategory = Database["public"]["Enums"]["inventory_category"];
type InventoryStatus = Database["public"]["Enums"]["inventory_status"];

const statusVariant: Record<InventoryStatus, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  damaged: "secondary",
  lost: "destructive",
  sold: "outline",
  disposed: "outline",
};

const categoryColors: Record<InventoryCategory, string> = {
  equipment: "bg-blue-100 text-blue-800",
  furniture: "bg-amber-100 text-amber-800",
  technology: "bg-purple-100 text-purple-800",
  supplies: "bg-green-100 text-green-800",
  vehicle: "bg-orange-100 text-orange-800",
  building: "bg-red-100 text-red-800",
  other: "bg-gray-100 text-gray-800",
};

type ItemFormData = Omit<InventoryItem, "id" | "total_value" | "book_value" | "created_by" | "created_at" | "updated_at">;

function AdminInventory() {
  const { role } = useAuth();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showMovement, setShowMovement] = useState(false);
  const [selectedItemForMovement, setSelectedItemForMovement] = useState<InventoryItem | null>(null);
  const [movementData, setMovementData] = useState({
    quantity_changed: 0,
    movement_type: "transfer" as "purchase" | "transfer" | "usage" | "loss" | "repair" | "depreciation" | "disposal",
    to_location: "",
    notes: "",
  });
  const [formData, setFormData] = useState<ItemFormData>({
    name: "",
    category: "equipment",
    description: null,
    serial_number: null,
    barcode: null,
    quantity: 1,
    unit_of_measure: "unit",
    unit_cost: 0,
    status: "active",
    location: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    warranty_expiry: null,
    responsible_member_id: null,
    depreciation_account_id: null,
    accumulated_depreciation: 0,
    is_depreciable: false,
    depreciation_years: null,
    is_for_sale: false,
    sale_price: null,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      console.error("[admin/inventory] failed to load", error);
      toast.error("Couldn't load inventory items.");
      return;
    }
    setItems(data);
  }

  function handleOpenDialog(item?: InventoryItem) {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category,
        description: item.description,
        serial_number: item.serial_number,
        barcode: item.barcode,
        quantity: item.quantity,
        unit_of_measure: item.unit_of_measure,
        unit_cost: item.unit_cost,
        status: item.status,
        location: item.location,
        purchase_date: item.purchase_date,
        warranty_expiry: item.warranty_expiry,
        responsible_member_id: item.responsible_member_id,
        depreciation_account_id: item.depreciation_account_id,
        accumulated_depreciation: item.accumulated_depreciation,
        is_depreciable: item.is_depreciable,
        depreciation_years: item.depreciation_years,
        is_for_sale: (item as any).is_for_sale ?? false,
        sale_price: (item as any).sale_price ?? null,
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: "",
        category: "equipment",
        description: null,
        serial_number: null,
        barcode: null,
        quantity: 1,
        unit_of_measure: "unit",
        unit_cost: 0,
        status: "active",
        location: "",
        purchase_date: new Date().toISOString().slice(0, 10),
        warranty_expiry: null,
        responsible_member_id: null,
        depreciation_account_id: null,
        accumulated_depreciation: 0,
        is_depreciable: false,
        depreciation_years: null,
        is_for_sale: false,
        sale_price: null,
      });
    }
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingItem(null);
  }

  async function handleSaveItem() {
    if (!formData.name || !formData.location || formData.unit_cost <= 0) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (formData.is_for_sale && (!formData.sale_price || formData.sale_price <= 0)) {
      toast.error("Set a sale price before listing this item in the member shop.");
      return;
    }

    setBusyId("save");
    try {
      if (editingItem) {
        const { error } = await supabase
          .from("inventory_items")
          .update({
            name: formData.name,
            category: formData.category,
            description: formData.description,
            serial_number: formData.serial_number,
            barcode: formData.barcode,
            quantity: formData.quantity,
            unit_of_measure: formData.unit_of_measure,
            unit_cost: formData.unit_cost,
            status: formData.status,
            location: formData.location,
            purchase_date: formData.purchase_date,
            warranty_expiry: formData.warranty_expiry,
            responsible_member_id: formData.responsible_member_id,
            is_depreciable: formData.is_depreciable,
            depreciation_years: formData.depreciation_years,
            is_for_sale: formData.is_for_sale,
            sale_price: formData.is_for_sale ? formData.sale_price : null,
          })
          .eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Item updated successfully.");
      } else {
        const { error } = await supabase.from("inventory_items").insert({
          name: formData.name,
          category: formData.category,
          description: formData.description,
          serial_number: formData.serial_number,
          barcode: formData.barcode,
          quantity: formData.quantity,
          unit_of_measure: formData.unit_of_measure,
          unit_cost: formData.unit_cost,
          status: formData.status,
          location: formData.location,
          purchase_date: formData.purchase_date,
          warranty_expiry: formData.warranty_expiry,
          responsible_member_id: formData.responsible_member_id,
          is_depreciable: formData.is_depreciable,
          depreciation_years: formData.depreciation_years,
          is_for_sale: formData.is_for_sale,
          sale_price: formData.is_for_sale ? formData.sale_price : null,
        });
        if (error) throw error;
        toast.success("Item added successfully.");
      }
      handleCloseDialog();
      load();
    } catch (error: any) {
      console.error("[admin/inventory] save error", error);
      toast.error(error.message || "Failed to save item.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRecordMovement() {
    if (!selectedItemForMovement || movementData.quantity_changed === 0) {
      toast.error("Please enter a valid quantity.");
      return;
    }

    setBusyId(`movement-${selectedItemForMovement.id}`);
    try {
      const newQuantity = selectedItemForMovement.quantity + movementData.quantity_changed;
      if (newQuantity < 0) {
        toast.error("Quantity cannot be negative.");
        setBusyId(null);
        return;
      }

      // Record movement
      const { error: movementError } = await supabase
        .from("inventory_movements")
        .insert({
          inventory_item_id: selectedItemForMovement.id,
          movement_type: movementData.movement_type,
          quantity_changed: movementData.quantity_changed,
          old_quantity: selectedItemForMovement.quantity,
          new_quantity: newQuantity,
          to_location: movementData.to_location,
          notes: movementData.notes,
          recorded_by: 1, // Would be actual user ID in production
          movement_date: new Date().toISOString().slice(0, 10),
        });

      if (movementError) throw movementError;

      // Update item quantity
      const { error: updateError } = await supabase
        .from("inventory_items")
        .update({ quantity: newQuantity, location: movementData.to_location || selectedItemForMovement.location })
        .eq("id", selectedItemForMovement.id);

      if (updateError) throw updateError;

      toast.success("Movement recorded successfully.");
      setShowMovement(false);
      setSelectedItemForMovement(null);
      setMovementData({
        quantity_changed: 0,
        movement_type: "transfer",
        to_location: "",
        notes: "",
      });
      load();
    } catch (error: any) {
      console.error("[admin/inventory] movement error", error);
      toast.error("Failed to record movement.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteItem(id: number) {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
      toast.success("Item deleted.");
      load();
    } catch (error: any) {
      console.error("[admin/inventory] delete error", error);
      toast.error("Failed to delete item.");
    }
  }

  if (role && !["admin", "treasurer"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to inventory management.</div>;
  }

  const totalValue = items?.reduce((sum, item) => sum + (item.total_value || 0), 0) || 0;
  const activeItems = items?.filter((i) => i.status === "active").length || 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track assets, equipment, and inventory items.</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Item" : "Add New Item"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Item Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Projector XYZ"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value: any) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equipment">Equipment</SelectItem>
                      <SelectItem value="furniture">Furniture</SelectItem>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="supplies">Supplies</SelectItem>
                      <SelectItem value="vehicle">Vehicle</SelectItem>
                      <SelectItem value="building">Building</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="damaged">Damaged</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="disposed">Disposed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
                  placeholder="Item details..."
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="serial_number">Serial Number</Label>
                  <Input
                    id="serial_number"
                    value={formData.serial_number || ""}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode || ""}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    value={formData.location ?? ""}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Room/Building"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={formData.unit_of_measure ?? ""}
                    onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                    placeholder="unit"
                  />
                </div>
                <div>
                  <Label htmlFor="unit_cost">Unit Cost *</Label>
                  <Input
                    id="unit_cost"
                    type="number"
                    step="0.01"
                    value={formData.unit_cost}
                    onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="purchase_date">Purchase Date</Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    value={formData.purchase_date || ""}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value || null })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="warranty_expiry">Warranty Expiry</Label>
                  <Input
                    id="warranty_expiry"
                    type="date"
                    value={formData.warranty_expiry || ""}
                    onChange={(e) => setFormData({ ...formData, warranty_expiry: e.target.value || null })}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_depreciable}
                      onChange={(e) => setFormData({ ...formData, is_depreciable: e.target.checked })}
                      className="rounded border-input"
                    />
                    <span className="text-sm">Depreciable Asset</span>
                  </label>
                </div>
              </div>
              {formData.is_depreciable && (
                <div>
                  <Label htmlFor="depreciation_years">Depreciation Years</Label>
                  <Input
                    id="depreciation_years"
                    type="number"
                    value={formData.depreciation_years || ""}
                    onChange={(e) => setFormData({ ...formData, depreciation_years: e.target.value ? parseInt(e.target.value) : null })}
                  />
                </div>
              )}

              <div className="rounded-lg border border-border p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_for_sale}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_for_sale: e.target.checked,
                        sale_price: e.target.checked ? formData.sale_price : null,
                      })
                    }
                    className="rounded border-input"
                  />
                  <span className="text-sm font-medium">List in Member Shop</span>
                </label>
                {formData.is_for_sale && (
                  <div className="mt-3">
                    <Label htmlFor="sale_price">Sale Price (per unit) *</Label>
                    <Input
                      id="sale_price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.sale_price ?? ""}
                      onChange={(e) =>
                        setFormData({ ...formData, sale_price: e.target.value ? parseFloat(e.target.value) : null })
                      }
                      placeholder="e.g. 500"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Members will see this item in the shop and can place an order once it's listed with a price.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button onClick={handleSaveItem} disabled={busyId === "save"}>
                  {editingItem ? "Update" : "Add"} Item
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Items</p>
          <p className="text-2xl font-bold mt-1">{items?.length || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Active Items</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{activeItems}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Value</p>
          <p className="text-2xl font-bold mt-1 text-blue-600">
            {parseFloat(totalValue.toString()).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
      </div>

      {/* Movement Dialog */}
      <Dialog open={showMovement} onOpenChange={setShowMovement}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Stock Movement</DialogTitle>
          </DialogHeader>
          {selectedItemForMovement && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded">
                <p className="font-semibold">{selectedItemForMovement.name}</p>
                <p className="text-sm text-muted-foreground">Current: {selectedItemForMovement.quantity} {selectedItemForMovement.unit_of_measure}</p>
              </div>
              <div>
                <Label htmlFor="movement_type">Movement Type</Label>
                <Select value={movementData.movement_type} onValueChange={(value: any) => setMovementData({ ...movementData, movement_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase">Purchase</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="usage">Usage</SelectItem>
                    <SelectItem value="loss">Loss</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quantity_changed">Quantity Change (+ or -)</Label>
                <Input
                  id="quantity_changed"
                  type="number"
                  value={movementData.quantity_changed}
                  onChange={(e) => setMovementData({ ...movementData, quantity_changed: parseFloat(e.target.value) })}
                  placeholder="Enter quantity change"
                />
              </div>
              <div>
                <Label htmlFor="to_location">New Location</Label>
                <Input
                  id="to_location"
                  value={movementData.to_location}
                  onChange={(e) => setMovementData({ ...movementData, to_location: e.target.value })}
                  placeholder="Location after movement"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={movementData.notes}
                  onChange={(e) => setMovementData({ ...movementData, notes: e.target.value })}
                  placeholder="Additional details..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowMovement(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRecordMovement} disabled={busyId?.startsWith("movement")}>
                  Record Movement
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Inventory Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Serial #</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items && items.length > 0 ? (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${categoryColors[item.category]}`}>
                      {item.category}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.serial_number || "—"}</TableCell>
                  <TableCell className="text-right font-mono">
                    {item.quantity} {item.unit_of_measure}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {parseFloat(item.unit_cost.toString()).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {parseFloat((item.total_value || 0).toString()).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm">{item.location}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedItemForMovement(item);
                          setShowMovement(true);
                        }}
                        title="Record movement"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenDialog(item)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No inventory items. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
