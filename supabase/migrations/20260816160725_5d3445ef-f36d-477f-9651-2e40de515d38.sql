CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.app_role AS ENUM ('admin','treasurer','secretary','editor','member');

CREATE TABLE public.user_roles (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_officer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','treasurer','secretary','editor')
  )
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TYPE public.member_status AS ENUM ('active','leave_of_absence','honorary','alumni','terminated');

CREATE TABLE public.members (
  id              bigserial PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ri_number       varchar(20) UNIQUE NOT NULL,
  first_name      varchar(80) NOT NULL,
  last_name       varchar(80) NOT NULL,
  email           varchar(160) UNIQUE NOT NULL,
  phone           varchar(30) NOT NULL,
  classification  varchar(120),
  photo_url       text,
  joined_date     date NOT NULL DEFAULT CURRENT_DATE,
  status          public.member_status NOT NULL DEFAULT 'active',
  qr_token        uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  qr_issued_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_members_status ON public.members(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read roster" ON public.members
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_officer(auth.uid()));
CREATE POLICY "Officers manage members" ON public.members
  FOR ALL TO authenticated
  USING (public.is_officer(auth.uid())) WITH CHECK (public.is_officer(auth.uid()));

CREATE TABLE public.fiscal_years (
  id          serial PRIMARY KEY,
  name        varchar(20) UNIQUE NOT NULL,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  is_closed   boolean NOT NULL DEFAULT false,
  CHECK (end_date > start_date)
);
GRANT SELECT ON public.fiscal_years TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_years TO authenticated;
GRANT ALL ON public.fiscal_years TO service_role;
ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fiscal years are public" ON public.fiscal_years FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Finance manages fiscal years" ON public.fiscal_years
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'treasurer'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'treasurer'));

CREATE TABLE public.board_positions (
  id              serial PRIMARY KEY,
  fiscal_year_id  int NOT NULL REFERENCES public.fiscal_years(id),
  member_id       bigint NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  title           varchar(80) NOT NULL,
  bio             text,
  sort_order      int NOT NULL DEFAULT 0,
  UNIQUE (fiscal_year_id, member_id, title)
);
GRANT SELECT ON public.board_positions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_positions TO authenticated;
GRANT ALL ON public.board_positions TO service_role;
ALTER TABLE public.board_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Board is public" ON public.board_positions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Officers manage board" ON public.board_positions
  FOR ALL TO authenticated
  USING (public.is_officer(auth.uid())) WITH CHECK (public.is_officer(auth.uid()));

CREATE TYPE public.meeting_type AS ENUM ('weekly','board','event','project','fellowship');

CREATE TABLE public.meetings (
  id                bigserial PRIMARY KEY,
  title             varchar(160) NOT NULL,
  meeting_type      public.meeting_type NOT NULL DEFAULT 'weekly',
  meeting_date      date NOT NULL,
  start_time        time NOT NULL,
  end_time          time,
  venue             varchar(200),
  description       text,
  is_mandatory      boolean NOT NULL DEFAULT true,
  is_public         boolean NOT NULL DEFAULT false,
  checkin_opens_at  timestamptz,
  checkin_closes_at timestamptz,
  is_closed         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_meetings_date ON public.meetings(meeting_date);
GRANT SELECT ON public.meetings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public meetings are readable" ON public.meetings FOR SELECT TO anon USING (is_public = true);
CREATE POLICY "Members read all meetings" ON public.meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Officers manage meetings" ON public.meetings
  FOR ALL TO authenticated
  USING (public.is_officer(auth.uid())) WITH CHECK (public.is_officer(auth.uid()));

CREATE TYPE public.attendance_status AS ENUM ('present','late','absent','excused');
CREATE TYPE public.checkin_method AS ENUM ('qr_scan','manual');

CREATE TABLE public.attendance (
  id               bigserial PRIMARY KEY,
  meeting_id       bigint NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  member_id        bigint NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status           public.attendance_status NOT NULL DEFAULT 'absent',
  check_in_time    timestamptz,
  check_in_method  public.checkin_method,
  recorded_by      bigint REFERENCES public.members(id),
  notes            varchar(200),
  UNIQUE (meeting_id, member_id)
);
CREATE INDEX idx_attendance_member ON public.attendance(member_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    public.is_officer(auth.uid())
    OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = attendance.member_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Officers manage attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (public.is_officer(auth.uid())) WITH CHECK (public.is_officer(auth.uid()));

CREATE TYPE public.account_type AS ENUM ('asset','liability','equity','income','expense');
CREATE TYPE public.normal_side  AS ENUM ('debit','credit');

CREATE TABLE public.funds (
  id serial PRIMARY KEY,
  code varchar(10) UNIQUE NOT NULL,
  name varchar(80) NOT NULL
);

CREATE TABLE public.accounts (
  id                 serial PRIMARY KEY,
  code               varchar(10) UNIQUE NOT NULL,
  name               varchar(120) NOT NULL,
  type               public.account_type NOT NULL,
  normal_balance     public.normal_side NOT NULL,
  parent_account_id  int REFERENCES public.accounts(id),
  is_control_account boolean NOT NULL DEFAULT false,
  is_active          boolean NOT NULL DEFAULT true,
  description        text
);

CREATE SEQUENCE public.je_no_seq START 1;
CREATE SEQUENCE public.invoice_no_seq START 1;
CREATE SEQUENCE public.payment_no_seq START 1;
CREATE SEQUENCE public.bill_no_seq START 1;

CREATE TYPE public.je_source AS ENUM ('manual','invoice','payment','bill','payroll','adjustment','opening_balance');

CREATE TABLE public.journal_entries (
  id             bigserial PRIMARY KEY,
  entry_no       varchar(20) UNIQUE NOT NULL,
  fiscal_year_id int NOT NULL REFERENCES public.fiscal_years(id),
  fund_id        int NOT NULL REFERENCES public.funds(id),
  entry_date     date NOT NULL DEFAULT CURRENT_DATE,
  memo           text,
  source_type    public.je_source NOT NULL DEFAULT 'manual',
  source_id      bigint,
  created_by     bigint REFERENCES public.members(id),
  is_posted      boolean NOT NULL DEFAULT false,
  posted_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.journal_lines (
  id               bigserial PRIMARY KEY,
  journal_entry_id bigint NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  line_no          int NOT NULL,
  account_id       int NOT NULL REFERENCES public.accounts(id),
  member_id        bigint REFERENCES public.members(id),
  debit            numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit  >= 0),
  credit           numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description      varchar(200),
  CHECK (NOT (debit > 0 AND credit > 0)),
  UNIQUE (journal_entry_id, line_no)
);
CREATE INDEX idx_jl_account ON public.journal_lines(account_id);
CREATE INDEX idx_jl_member  ON public.journal_lines(member_id);

CREATE OR REPLACE FUNCTION public.fn_check_journal_balanced()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_entry_id bigint;
  v_diff numeric(14,2);
  v_posted boolean;
BEGIN
  v_entry_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  SELECT is_posted INTO v_posted FROM public.journal_entries WHERE id = v_entry_id;
  IF v_posted THEN
    SELECT COALESCE(SUM(debit),0) - COALESCE(SUM(credit),0) INTO v_diff
    FROM public.journal_lines WHERE journal_entry_id = v_entry_id;
    IF v_diff <> 0 THEN
      RAISE EXCEPTION 'Journal entry % is not balanced (debits-credits = %)', v_entry_id, v_diff;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_journal_balanced
AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.fn_check_journal_balanced();

CREATE TYPE public.invoice_status AS ENUM ('draft','issued','partially_paid','paid','void');

CREATE TABLE public.invoices (
  id               bigserial PRIMARY KEY,
  invoice_no       varchar(20) UNIQUE NOT NULL,
  member_id        bigint NOT NULL REFERENCES public.members(id),
  fiscal_year_id   int NOT NULL REFERENCES public.fiscal_years(id),
  invoice_date     date NOT NULL DEFAULT CURRENT_DATE,
  due_date         date NOT NULL,
  memo             varchar(200),
  status           public.invoice_status NOT NULL DEFAULT 'draft',
  journal_entry_id bigint REFERENCES public.journal_entries(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.invoice_lines (
  id          bigserial PRIMARY KEY,
  invoice_id  bigint NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description varchar(200) NOT NULL,
  account_id  int NOT NULL REFERENCES public.accounts(id),
  quantity    numeric(10,2) NOT NULL DEFAULT 1,
  unit_price  numeric(14,2) NOT NULL,
  amount      numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE TYPE public.payment_method AS ENUM ('cash','mpesa','bank_transfer','cheque','card');

CREATE TABLE public.payments (
  id                 bigserial PRIMARY KEY,
  payment_no         varchar(20) UNIQUE NOT NULL,
  member_id          bigint REFERENCES public.members(id),
  payer_name         varchar(120),
  payment_date       date NOT NULL DEFAULT CURRENT_DATE,
  method             public.payment_method NOT NULL,
  reference          varchar(80),
  amount             numeric(14,2) NOT NULL CHECK (amount > 0),
  deposit_account_id int NOT NULL REFERENCES public.accounts(id),
  journal_entry_id   bigint REFERENCES public.journal_entries(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payment_allocations (
  id             bigserial PRIMARY KEY,
  payment_id     bigint NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id     bigint NOT NULL REFERENCES public.invoices(id),
  amount_applied numeric(14,2) NOT NULL CHECK (amount_applied > 0)
);

CREATE TYPE public.bill_status AS ENUM ('draft','received','partially_paid','paid','void');

CREATE TABLE public.vendors (
  id serial PRIMARY KEY,
  name varchar(120) NOT NULL,
  email varchar(160),
  phone varchar(30)
);

CREATE TABLE public.bills (
  id               bigserial PRIMARY KEY,
  bill_no          varchar(20) UNIQUE NOT NULL,
  vendor_id        int REFERENCES public.vendors(id),
  fiscal_year_id   int NOT NULL REFERENCES public.fiscal_years(id),
  bill_date        date NOT NULL DEFAULT CURRENT_DATE,
  due_date         date NOT NULL,
  memo             varchar(200),
  status           public.bill_status NOT NULL DEFAULT 'draft',
  journal_entry_id bigint REFERENCES public.journal_entries(id)
);

CREATE TABLE public.bill_lines (
  id          bigserial PRIMARY KEY,
  bill_id     bigint NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  description varchar(200) NOT NULL,
  account_id  int NOT NULL REFERENCES public.accounts(id),
  amount      numeric(14,2) NOT NULL CHECK (amount > 0)
);

DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'funds','accounts','journal_entries','journal_lines','invoices','invoice_lines',
    'payments','payment_allocations','vendors','bills','bill_lines'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Finance staff read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''treasurer''))', t);
    EXECUTE format('CREATE POLICY "Finance staff write %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''treasurer'')) WITH CHECK (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''treasurer''))', t);
  END LOOP;
END $do$;

GRANT USAGE, SELECT ON SEQUENCE public.je_no_seq, public.invoice_no_seq, public.payment_no_seq, public.bill_no_seq TO authenticated, service_role;

CREATE TYPE public.project_status AS ENUM ('planned','ongoing','completed');

CREATE TABLE public.projects (
  id              bigserial PRIMARY KEY,
  title           varchar(160) NOT NULL,
  slug            varchar(160) UNIQUE NOT NULL,
  area_of_focus   varchar(80) NOT NULL,
  summary         varchar(280),
  story           text,
  status          public.project_status NOT NULL DEFAULT 'planned',
  start_date      date,
  end_date        date,
  budget_amount   numeric(14,2),
  fund_id         int REFERENCES public.funds(id),
  cover_image_url text,
  published       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_photos (
  id         bigserial PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  image_url  text NOT NULL,
  caption    varchar(200),
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE public.gallery_albums (
  id              bigserial PRIMARY KEY,
  title           varchar(160) NOT NULL,
  event_date      date,
  cover_image_url text,
  published       boolean NOT NULL DEFAULT true
);

CREATE TABLE public.gallery_photos (
  id        bigserial PRIMARY KEY,
  album_id  bigint NOT NULL REFERENCES public.gallery_albums(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption   varchar(200)
);

CREATE TABLE public.news_articles (
  id               bigserial PRIMARY KEY,
  title            varchar(200) NOT NULL,
  slug             varchar(200) UNIQUE NOT NULL,
  excerpt          varchar(280),
  body             text NOT NULL,
  author_member_id bigint REFERENCES public.members(id),
  cover_image_url  text,
  published        boolean NOT NULL DEFAULT false,
  published_at     timestamptz
);

DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','news_articles','gallery_albums'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Published %1$s are public" ON public.%1$I FOR SELECT TO anon, authenticated USING (published = true)', t);
    EXECUTE format('CREATE POLICY "Editors read all %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.is_officer(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "Editors manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_officer(auth.uid())) WITH CHECK (public.is_officer(auth.uid()))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['project_photos','gallery_photos'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Photos are public %1$s" ON public.%1$I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Editors manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_officer(auth.uid())) WITH CHECK (public.is_officer(auth.uid()))', t);
  END LOOP;
END $do$;

CREATE TABLE public.contact_messages (
  id           bigserial PRIMARY KEY,
  name         varchar(120) NOT NULL,
  email        varchar(160) NOT NULL,
  phone        varchar(30),
  subject      varchar(160),
  message      text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  is_read      boolean NOT NULL DEFAULT false
);
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.contact_messages_id_seq TO anon, authenticated, service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can send a message" ON public.contact_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Officers read messages" ON public.contact_messages FOR SELECT TO authenticated USING (public.is_officer(auth.uid()));
CREATE POLICY "Officers update messages" ON public.contact_messages FOR UPDATE TO authenticated USING (public.is_officer(auth.uid())) WITH CHECK (public.is_officer(auth.uid()));

CREATE VIEW public.v_public_board WITH (security_invoker = true) AS
SELECT bp.id, bp.title, bp.sort_order, bp.bio, m.first_name, m.last_name, m.photo_url, fy.name AS fiscal_year
FROM public.board_positions bp
JOIN public.members m ON m.id = bp.member_id
JOIN public.fiscal_years fy ON fy.id = bp.fiscal_year_id;

CREATE VIEW public.v_member_balances WITH (security_invoker = true) AS
SELECT m.id AS member_id, m.first_name || ' ' || m.last_name AS member_name, m.ri_number,
       COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS balance_due
FROM public.members m
LEFT JOIN public.journal_lines jl ON jl.member_id = m.id
LEFT JOIN public.accounts a ON a.id = jl.account_id AND a.code = '1200'
GROUP BY m.id, m.first_name, m.last_name, m.ri_number;

CREATE VIEW public.v_trial_balance WITH (security_invoker = true) AS
SELECT a.code, a.name, a.type,
  COALESCE(SUM(jl.debit),0)  AS total_debit,
  COALESCE(SUM(jl.credit),0) AS total_credit,
  CASE a.normal_balance WHEN 'debit' THEN COALESCE(SUM(jl.debit),0) - COALESCE(SUM(jl.credit),0)
       ELSE COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0) END AS balance
FROM public.accounts a
LEFT JOIN public.journal_lines jl ON jl.account_id = a.id
LEFT JOIN public.journal_entries je ON je.id = jl.journal_entry_id AND je.is_posted = true
GROUP BY a.id, a.code, a.name, a.type, a.normal_balance;

CREATE VIEW public.v_attendance_summary WITH (security_invoker = true) AS
SELECT m.id AS member_id, m.first_name || ' ' || m.last_name AS member_name,
  COUNT(mt.id) FILTER (WHERE mt.is_mandatory) AS meetings_required,
  COUNT(att.id) FILTER (WHERE mt.is_mandatory AND att.status IN ('present','late')) AS meetings_attended,
  ROUND(100.0 * COUNT(att.id) FILTER (WHERE mt.is_mandatory AND att.status IN ('present','late'))
        / NULLIF(COUNT(mt.id) FILTER (WHERE mt.is_mandatory), 0), 1) AS attendance_pct
FROM public.members m
CROSS JOIN public.meetings mt
LEFT JOIN public.attendance att ON att.meeting_id = mt.id AND att.member_id = m.id
WHERE m.status = 'active'
GROUP BY m.id, m.first_name, m.last_name;

GRANT SELECT ON public.v_public_board TO anon, authenticated;
GRANT SELECT ON public.v_member_balances, public.v_trial_balance, public.v_attendance_summary TO authenticated, service_role;