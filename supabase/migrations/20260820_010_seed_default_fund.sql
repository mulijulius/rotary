-- The funds table had no rows and no admin UI to manage it, so the "Default
-- Fund" dropdown in GL Settings was empty and could never be set - which in
-- turn blocked bills/invoices/payments from posting (fn_sync_bill_journal_entry
-- etc. require gl_settings.default_fund_id to be set).
--
-- Seed a starter fund so the dropdown isn't empty. Clubs that use fund
-- accounting for more than one fund can add more via the new /admin/funds
-- page and simply pick a different default in GL Settings.
INSERT INTO public.funds (code, name)
SELECT 'GEN', 'General Fund'
WHERE NOT EXISTS (SELECT 1 FROM public.funds);
