-- Visitors and Email Tracking Module
-- Enables capturing visitor information at events and managing email communications

CREATE TYPE public.visitor_interest AS ENUM ('general', 'membership', 'projects', 'events', 'other');

CREATE TABLE public.visitors (
  id              bigserial PRIMARY KEY,
  first_name      varchar(80) NOT NULL,
  last_name       varchar(80) NOT NULL,
  email           varchar(160) NOT NULL,
  phone           varchar(30),
  organization    varchar(120),
  interest        public.visitor_interest NOT NULL DEFAULT 'general',
  notes           text,
  meeting_id      bigint REFERENCES public.meetings(id) ON DELETE SET NULL,
  visited_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_visitors_email ON public.visitors(email);
CREATE INDEX idx_visitors_meeting ON public.visitors(meeting_id);
CREATE INDEX idx_visitors_visited_at ON public.visitors(visited_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitors TO authenticated;
GRANT ALL ON public.visitors TO service_role;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers manage visitors" ON public.visitors
  FOR ALL TO authenticated
  USING (public.is_officer(auth.uid())) WITH CHECK (public.is_officer(auth.uid()));

CREATE POLICY "Visitors can insert own record" ON public.visitors
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

-- Email campaign and tracking
CREATE TYPE public.email_status AS ENUM ('draft', 'scheduled', 'sent', 'failed');
CREATE TYPE public.email_recipient_type AS ENUM ('member', 'visitor', 'list');

CREATE TABLE public.email_campaigns (
  id                  bigserial PRIMARY KEY,
  title               varchar(200) NOT NULL,
  subject             varchar(200) NOT NULL,
  body_html           text NOT NULL,
  recipient_type      public.email_recipient_type NOT NULL,
  status              public.email_status NOT NULL DEFAULT 'draft',
  scheduled_at        timestamptz,
  sent_at             timestamptz,
  created_by          bigint REFERENCES public.members(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaigns TO authenticated;
GRANT ALL ON public.email_campaigns TO service_role;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers manage campaigns" ON public.email_campaigns
  FOR ALL TO authenticated
  USING (public.is_officer(auth.uid())) WITH CHECK (public.is_officer(auth.uid()));

-- Track email sends and opens
CREATE TABLE public.email_logs (
  id                  bigserial PRIMARY KEY,
  campaign_id         bigint NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  recipient_email     varchar(160) NOT NULL,
  recipient_type      public.email_recipient_type NOT NULL,
  member_id           bigint REFERENCES public.members(id),
  visitor_id          bigint REFERENCES public.visitors(id),
  status              varchar(50) NOT NULL DEFAULT 'pending',
  sent_at             timestamptz,
  opened_at           timestamptz,
  clicked_at          timestamptz,
  error_message       text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_logs_campaign ON public.email_logs(campaign_id);
CREATE INDEX idx_email_logs_recipient ON public.email_logs(recipient_email);
CREATE INDEX idx_email_logs_sent_at ON public.email_logs(sent_at DESC);

GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers view email logs" ON public.email_logs
  FOR SELECT TO authenticated
  USING (public.is_officer(auth.uid()));
