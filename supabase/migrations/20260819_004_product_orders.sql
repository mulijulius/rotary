-- Members purchasing club merchandise / fundraiser items.
--
-- Reuses inventory_items as the product catalog: officers flag which items
-- are listed for sale and set a sale price. Members can then "buy" a
-- listed item, which creates a product_orders row that treasurers/admins
-- review, approve, and fulfil (fulfilment decrements stock via the
-- existing inventory_movements trail).

ALTER TABLE public.inventory_items
  ADD COLUMN is_for_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN sale_price  numeric(14,2);

COMMENT ON COLUMN public.inventory_items.is_for_sale IS
  'Whether this item is listed in the member shop for purchase.';
COMMENT ON COLUMN public.inventory_items.sale_price IS
  'Price members pay per unit. Independent of unit_cost (what the club paid).';

CREATE TYPE public.product_order_status AS ENUM ('pending', 'approved', 'fulfilled', 'cancelled');

CREATE SEQUENCE public.product_order_no_seq START 1;

CREATE TABLE public.product_orders (
  id                 bigserial PRIMARY KEY,
  order_no           varchar(20) UNIQUE NOT NULL,
  member_id          bigint NOT NULL REFERENCES public.members(id),
  inventory_item_id  bigint NOT NULL REFERENCES public.inventory_items(id),
  quantity           numeric(10,2) NOT NULL CHECK (quantity > 0),
  unit_price         numeric(14,2) NOT NULL CHECK (unit_price >= 0),
  total_amount       numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  status             public.product_order_status NOT NULL DEFAULT 'pending',
  notes              varchar(200),
  invoice_id         bigint REFERENCES public.invoices(id),
  decided_by         bigint REFERENCES public.members(id),
  decided_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_orders_member ON public.product_orders(member_id);
CREATE INDEX idx_product_orders_status ON public.product_orders(status);
CREATE INDEX idx_product_orders_item   ON public.product_orders(inventory_item_id);

GRANT SELECT, INSERT, UPDATE ON public.product_orders TO authenticated;
GRANT ALL ON public.product_orders TO service_role;
ALTER TABLE public.product_orders ENABLE ROW LEVEL SECURITY;

-- Members can see and place their own orders.
CREATE POLICY "Members view own orders" ON public.product_orders
  FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'treasurer')
  );

CREATE POLICY "Members place own orders" ON public.product_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
    AND status = 'pending'
  );

-- Only finance staff can change order status (approve/fulfil/cancel).
CREATE POLICY "Finance staff manage orders" ON public.product_orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'treasurer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'treasurer'));

-- Keep inventory quantity in sync once an order is marked fulfilled, and
-- record the movement for the existing inventory audit trail.
CREATE OR REPLACE FUNCTION public.fn_fulfil_product_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_qty numeric(10,2);
  v_new_qty numeric(10,2);
BEGIN
  IF NEW.status = 'fulfilled' AND OLD.status <> 'fulfilled' THEN
    SELECT quantity INTO v_old_qty FROM public.inventory_items WHERE id = NEW.inventory_item_id FOR UPDATE;
    v_new_qty := v_old_qty - NEW.quantity;

    UPDATE public.inventory_items SET quantity = v_new_qty, updated_at = now()
    WHERE id = NEW.inventory_item_id;

    INSERT INTO public.inventory_movements (
      inventory_item_id, movement_type, quantity_changed, old_quantity, new_quantity,
      notes, recorded_by, movement_date
    ) VALUES (
      NEW.inventory_item_id, 'usage', -NEW.quantity, v_old_qty, v_new_qty,
      'Member purchase, order ' || NEW.order_no, COALESCE(NEW.decided_by, NEW.member_id), CURRENT_DATE
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fulfil_product_order ON public.product_orders;
CREATE TRIGGER trg_fulfil_product_order
AFTER UPDATE ON public.product_orders
FOR EACH ROW EXECUTE FUNCTION public.fn_fulfil_product_order();

GRANT EXECUTE ON FUNCTION public.fn_fulfil_product_order() TO authenticated;
