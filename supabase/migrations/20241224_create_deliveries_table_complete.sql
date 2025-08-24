-- Create the deliveries table with complete structure
CREATE TABLE public.deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    apartment_id UUID NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    recipient_name TEXT NOT NULL,
    sender_company TEXT,
    tracking_code TEXT,
    delivery_date TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
    received_by UUID REFERENCES public.profiles(id),
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
    delivery_company VARCHAR(100),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
    description TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS deliveries_building_id_idx ON public.deliveries (building_id);
CREATE INDEX IF NOT EXISTS deliveries_apartment_id_idx ON public.deliveries (apartment_id);
CREATE INDEX IF NOT EXISTS deliveries_status_idx ON public.deliveries (status);
CREATE INDEX IF NOT EXISTS deliveries_delivery_date_idx ON public.deliveries (delivery_date);
CREATE INDEX IF NOT EXISTS deliveries_created_at_idx ON public.deliveries (created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deliveries table

-- Policy for authenticated users to view deliveries in their building/apartment
CREATE POLICY "Users can view deliveries in their building" ON public.deliveries
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND (
            -- Building admins can see all deliveries in their buildings
            (p.profile_type = 'admin' AND p.building_id = deliveries.building_id)
            -- Porters can see all deliveries
            OR p.profile_type = 'porteiro'
            -- Residents can see deliveries for their apartment
            OR (p.profile_type = 'morador' AND p.apartment_id = deliveries.apartment_id)
        )
    )
);

-- Policy for porters and admins to insert deliveries
CREATE POLICY "Porters and admins can insert deliveries" ON public.deliveries
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND (
            p.profile_type = 'porteiro'
            OR (p.profile_type = 'admin' AND p.building_id = deliveries.building_id)
        )
    )
);

-- Policy for porters and admins to update deliveries
CREATE POLICY "Porters and admins can update deliveries" ON public.deliveries
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND (
            p.profile_type = 'porteiro'
            OR (p.profile_type = 'admin' AND p.building_id = deliveries.building_id)
        )
    )
);

-- Policy for admins to delete deliveries in their building
CREATE POLICY "Admins can delete deliveries in their building" ON public.deliveries
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.profile_type = 'admin'
        AND p.building_id = deliveries.building_id
    )
);

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.deliveries TO authenticated;
GRANT DELETE ON public.deliveries TO authenticated;

-- Add comments to the table and columns for documentation
COMMENT ON TABLE public.deliveries IS 'Table to store delivery information for apartments';
COMMENT ON COLUMN public.deliveries.id IS 'Unique identifier for the delivery';
COMMENT ON COLUMN public.deliveries.apartment_id IS 'Reference to the apartment receiving the delivery';
COMMENT ON COLUMN public.deliveries.building_id IS 'Reference to the building where the delivery is made';
COMMENT ON COLUMN public.deliveries.recipient_name IS 'Name of the person receiving the delivery';
COMMENT ON COLUMN public.deliveries.sender_company IS 'Company or person sending the delivery';
COMMENT ON COLUMN public.deliveries.tracking_code IS 'Tracking code for the delivery';
COMMENT ON COLUMN public.deliveries.delivery_date IS 'Date and time when the delivery was made';
COMMENT ON COLUMN public.deliveries.received_by IS 'Profile ID of the person who received the delivery';
COMMENT ON COLUMN public.deliveries.status IS 'Current status of the delivery (pending, delivered, etc.)';
COMMENT ON COLUMN public.deliveries.notes IS 'Additional notes about the delivery';
COMMENT ON COLUMN public.deliveries.delivery_company IS 'Name of the delivery company';
COMMENT ON COLUMN public.deliveries.description IS 'Description of the delivery contents';