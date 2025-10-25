-- Criar tabela deliveries para gerenciamento de entregas
-- Data: 2025-01-28

-- Criar tabela deliveries
CREATE TABLE IF NOT EXISTS public.deliveries (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    apartment_id UUID NOT NULL,
    building_id UUID NOT NULL,
    recipient_name TEXT NOT NULL,
    sender_company TEXT NULL,
    tracking_code TEXT NULL,
    delivery_code VARCHAR(50) NULL, -- Código/palavra-chave fornecido pelo morador ao aceitar entrega
    delivery_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    received_by UUID NULL,
    status TEXT NULL DEFAULT 'pending'::text,
    notes TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    delivery_company CHARACTER VARYING(100) NULL,
    received_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
    description TEXT NULL,
    is_active BOOLEAN NULL DEFAULT true,
    notification_status CHARACTER VARYING(20) NULL DEFAULT 'delivered'::character varying,
    photo_url TEXT NULL,
    entregue BOOLEAN NULL DEFAULT false,
    
    -- Constraints
    CONSTRAINT deliveries_pkey PRIMARY KEY (id),
    CONSTRAINT deliveries_apartment_id_fkey FOREIGN KEY (apartment_id) REFERENCES apartments (id) ON DELETE CASCADE,
    CONSTRAINT deliveries_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings (id) ON DELETE CASCADE,
    CONSTRAINT deliveries_notification_status_check CHECK (
        (notification_status)::text = ANY (
            (ARRAY[
                'pending'::character varying,
                'delivered'::character varying,
                'returned'::character varying
            ])::text[]
        )
    )
) TABLESPACE pg_default;

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_deliveries_building_id 
ON public.deliveries USING btree (building_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_deliveries_apartment_id 
ON public.deliveries USING btree (apartment_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_deliveries_status 
ON public.deliveries USING btree (status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_deliveries_notification_status 
ON public.deliveries USING btree (notification_status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_deliveries_photo_url 
ON public.deliveries USING btree (photo_url) TABLESPACE pg_default
WHERE (photo_url IS NOT NULL);

-- Índice adicional para delivery_code para facilitar buscas
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_code 
ON public.deliveries USING btree (delivery_code) TABLESPACE pg_default
WHERE (delivery_code IS NOT NULL);