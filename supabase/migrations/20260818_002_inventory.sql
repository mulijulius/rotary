-- Inventory Management Module
-- Tracks assets, inventory items, and their movements over time

CREATE TYPE public.inventory_category AS ENUM ('equipment', 'furniture', 'technology', 'supplies', 'vehicle', 'building', 'other');
CREATE TYPE public.inventory_status AS ENUM ('active', 'damaged', 'lost', 'sold', 'disposed');
CREATE TYPE public.stock_movement_type AS ENUM ('purchase', 'transfer', 'usage', 'loss', 'repair', 'depreciation', 'disposal');

-- Main inventory items table
CREATE TABLE public.inventory_items (
  id                      bigserial PRIMARY KEY,
  name                    varchar(200) NOT NULL,
  category                public.inventory_category NOT NULL,
  description             text,
  serial_number           varchar(100),
  barcode                 varchar(100),
  quantity                numeric(10,2) NOT NULL DEFAULT 1,
  unit_of_measure         varchar(20) DEFAULT 'unit',
  unit_cost               numeric(14,2) NOT NULL,
  total_value             numeric(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  status                  public.inventory_status NOT NULL DEFAULT 'active',
  location                varchar(200),
  purchase_date           date,
  warranty_expiry         date,
  responsible_member_id   bigint REFERENCES public.members(id) ON DELETE SET NULL,
  depreciation_account_id int REFERENCES public.accounts(id),
  accumulated_depreciation numeric(14,2) NOT NULL DEFAULT 0,
  book_value              numeric(14,2) GENERATED ALWAYS AS (total_value - accumulated_depreciation) STORED,
  is_depreciable          boolean NOT NULL DEFAULT false,
  depreciation_years      int,
  created_by              bigint REFERENCES public.members(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX idx_inventory_items_status ON public.inventory_items(status);
CREATE INDEX idx_inventory_items_location ON public.inventory_items(location);
CREATE INDEX idx_inventory_items_responsible ON public.inventory_items(responsible_member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers manage inventory" ON public.inventory_items
  FOR ALL TO authenticated
  USING (public.is_officer(auth.uid())) WITH CHECK (public.is_officer(auth.uid()));

CREATE POLICY "Members read inventory" ON public.inventory_items
  FOR SELECT TO authenticated
  USING (true);

-- Track all inventory movements and changes
CREATE TABLE public.inventory_movements (
  id                  bigserial PRIMARY KEY,
  inventory_item_id   bigint NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type       public.stock_movement_type NOT NULL,
  quantity_changed    numeric(10,2) NOT NULL,
  old_quantity        numeric(10,2) NOT NULL,
  new_quantity        numeric(10,2) NOT NULL,
  from_location       varchar(200),
  to_location         varchar(200),
  notes               text,
  recorded_by         bigint NOT NULL REFERENCES public.members(id),
  journal_entry_id    bigint REFERENCES public.journal_entries(id),
  movement_date       date NOT NULL DEFAULT CURRENT_DATE,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_item ON public.inventory_movements(inventory_item_id);
CREATE INDEX idx_movements_type ON public.inventory_movements(movement_type);
CREATE INDEX idx_movements_date ON public.inventory_movements(movement_date DESC);
CREATE INDEX idx_movements_recorded_by ON public.inventory_movements(recorded_by);

GRANT SELECT, INSERT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers manage movements" ON public.inventory_movements
  FOR ALL TO authenticated
  USING (public.is_officer(auth.uid())) WITH CHECK (public.is_officer(auth.uid()));

CREATE POLICY "Members read movements" ON public.inventory_movements
  FOR SELECT TO authenticated
  USING (true);

-- Physical inventory counts for auditing
CREATE TABLE public.inventory_counts (
  id                  bigserial PRIMARY KEY,
  count_date          date NOT NULL DEFAULT CURRENT_DATE,
  inventory_item_id   bigint NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  counted_quantity    numeric(10,2) NOT NULL,
  recorded_quantity   numeric(10,2) NOT NULL,
  variance            numeric(10,2) GENERATED ALWAYS AS (counted_quantity - recorded_quantity) STORED,
  notes               varchar(200),
  counted_by          bigint NOT NULL REFERENCES public.members(id),
  verified_by         bigint REFERENCES public.members(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_counts_item ON public.inventory_counts(inventory_item_id);
CREATE INDEX idx_counts_date ON public.inventory_counts(count_date DESC);

GRANT SELECT, INSERT ON public.inventory_counts TO authenticated;
GRANT ALL ON public.inventory_counts TO service_role;
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers manage counts" ON public.inventory_counts
  FOR ALL TO authenticated
  USING (public.is_officer(auth.uid())) WITH CHECK (public.is_officer(auth.uid()));

-- Depreciation schedule
CREATE TABLE public.depreciation_schedules (
  id                  bigserial PRIMARY KEY,
  inventory_item_id   bigint NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  fiscal_year_id      int NOT NULL REFERENCES public.fiscal_years(id),
  depreciation_amount numeric(14,2) NOT NULL,
  accumulated_to_date numeric(14,2) NOT NULL,
  book_value_at_end   numeric(14,2) NOT NULL,
  journal_entry_id    bigint REFERENCES public.journal_entries(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_depreciation_item ON public.depreciation_schedules(inventory_item_id);
CREATE INDEX idx_depreciation_fiscal_year ON public.depreciation_schedules(fiscal_year_id);

GRANT SELECT ON public.depreciation_schedules TO authenticated;
GRANT ALL ON public.depreciation_schedules TO service_role;
ALTER TABLE public.depreciation_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers view depreciation" ON public.depreciation_schedules
  FOR SELECT TO authenticated
  USING (public.is_officer(auth.uid()));

-- Function to calculate book value
CREATE OR REPLACE FUNCTION public.fn_calculate_depreciation()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item record;
  v_annual_depreciation numeric(14,2);
  v_months_used integer;
BEGIN
  FOR v_item IN
    SELECT id, unit_cost, purchase_date, depreciation_years
    FROM public.inventory_items
    WHERE is_depreciable = true AND depreciation_years > 0 AND status = 'active'
  LOOP
    IF v_item.purchase_date IS NOT NULL THEN
      v_months_used := DATE_PART('month', CURRENT_DATE - v_item.purchase_date);
      v_annual_depreciation := v_item.unit_cost / v_item.depreciation_years;
      UPDATE public.inventory_items
      SET accumulated_depreciation = (v_annual_depreciation * v_months_used / 12)
      WHERE id = v_item.id;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_calculate_depreciation() TO authenticated;
