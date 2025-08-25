-- Adicionar campo apartment_id à tabela visitors
-- Esta migração permite filtrar visitantes por apartamento específico

-- Adicionar a coluna apartment_id à tabela visitors
ALTER TABLE visitors 
ADD COLUMN apartment_id UUID REFERENCES apartments(id);

-- Criar índice para melhor performance nas consultas
CREATE INDEX idx_visitors_apartment_id ON visitors(apartment_id);

-- Adicionar comentário à coluna
COMMENT ON COLUMN visitors.apartment_id IS 'Referência ao apartamento do visitante para filtragem específica';

-- Atualizar políticas RLS para incluir apartment_id
-- Política para moradores verem apenas visitantes do seu apartamento
CREATE POLICY "Moradores podem ver visitantes do seu apartamento" ON visitors
    FOR SELECT USING (
        apartment_id IN (
            SELECT ar.apartment_id 
            FROM apartment_residents ar
            JOIN profiles p ON ar.profile_id = p.id
            WHERE p.user_id = auth.uid()
        )
    );

-- Política para moradores inserirem visitantes apenas no seu apartamento
CREATE POLICY "Moradores podem inserir visitantes no seu apartamento" ON visitors
    FOR INSERT WITH CHECK (
        apartment_id IN (
            SELECT ar.apartment_id 
            FROM apartment_residents ar
            JOIN profiles p ON ar.profile_id = p.id
            WHERE p.user_id = auth.uid()
        )
    );

-- Política para moradores atualizarem visitantes do seu apartamento
CREATE POLICY "Moradores podem atualizar visitantes do seu apartamento" ON visitors
    FOR UPDATE USING (
        apartment_id IN (
            SELECT ar.apartment_id 
            FROM apartment_residents ar
            JOIN profiles p ON ar.profile_id = p.id
            WHERE p.user_id = auth.uid()
        )
    );

-- Conceder permissões necessárias
GRANT SELECT, INSERT, UPDATE ON visitors TO authenticated;
GRANT SELECT ON visitors TO anon;

-- Verificar se RLS está habilitado
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;