-- 1. Create the trigger function safely and idempotently
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Create the rental_payments table securely
-- Replaced uuid_generate_v4() with gen_random_uuid() as it is natively embedded in Postgres 13+
CREATE TABLE IF NOT EXISTS public.rental_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id UUID REFERENCES public.rentals(id) ON DELETE CASCADE NOT NULL,
    created_by UUID DEFAULT auth.uid() NOT NULL,
    month_index INTEGER NOT NULL CHECK (month_index > 0),
    expected_amount DECIMAL NOT NULL CHECK (expected_amount >= 0),
    paid_amount DECIMAL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= expected_amount),
    month_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Uniqueness Constraints to prevent duplicating schedules
    UNIQUE (rental_id, month_index),
    UNIQUE (rental_id, month_date)
);

-- 3. Add Performance Indexes
CREATE INDEX IF NOT EXISTS idx_rental_payments_rental_id ON public.rental_payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_payments_created_by ON public.rental_payments(created_by);

-- 4. Attach the updated_at trigger idempotently
DROP TRIGGER IF EXISTS update_rental_payments_updated_at ON public.rental_payments;
CREATE TRIGGER update_rental_payments_updated_at
    BEFORE UPDATE ON public.rental_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.rental_payments ENABLE ROW LEVEL SECURITY;

-- 6. Apply Exact RLS Policies (Idempotent)
-- Clean up any previous policies to ensure idempotency if run multiple times
DROP POLICY IF EXISTS "Admins have full access to rental_payments" ON public.rental_payments;

-- Create the policy tailored explicitly to the shared-admin PMS workflow
CREATE POLICY "Admins have full access to rental_payments"
    ON public.rental_payments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.app_users
            WHERE app_users.id = auth.uid()
            AND app_users.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.app_users
            WHERE app_users.id = auth.uid()
            AND app_users.role = 'admin'
        )
    );
