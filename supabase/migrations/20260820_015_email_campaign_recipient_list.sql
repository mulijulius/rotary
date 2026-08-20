-- Allow storing a hand-picked recipient list for "list" type campaigns
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS recipient_emails text[];
