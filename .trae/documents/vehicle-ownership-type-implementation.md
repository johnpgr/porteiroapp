# Implementação do Campo ownership_type na Tabela Vehicles

## 1. Visão Geral

Este documento descreve a implementação de um novo campo `ownership_type` na tabela `vehicles` do banco de dados Supabase para distinguir entre veículos de visita e veículos pessoais dos moradores.

## 2. Modificações no Banco de Dados

### 2.1 Migração SQL

Criar um novo arquivo de migração no Supabase para adicionar o campo `ownership_type`:

```sql
-- Migração: Adicionar campo ownership_type na tabela vehicles
-- Arquivo: supabase/migrations/add_ownership_type_to_vehicles.sql

-- Adicionar coluna ownership_type
ALTER TABLE vehicles 
ADD COLUMN ownership_type VARCHAR(20) NOT NULL DEFAULT 'proprietario' 
CHECK (ownership_type IN ('visita', 'proprietario'));

-- Criar índice para otimizar consultas por tipo de propriedade
CREATE INDEX idx_vehicles_ownership_type ON vehicles(ownership_type);

-- Comentário da coluna
COMMENT ON COLUMN vehicles.ownership_type IS 'Tipo de propriedade do veículo: visita ou proprietario';
```

### 2.2 Estrutura da Tabela Atualizada

Após a migração, a tabela `vehicles` terá a seguinte estrutura:

```sql
CREATE TABLE vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    license_plate VARCHAR(10) NOT NULL,
    brand VARCHAR(50),
    model VARCHAR(50),
    color VARCHAR(30),
    type VARCHAR(20) CHECK (type IN ('car', 'motorcycle', 'truck', 'van', 'bus', 'other')),
    apartment_id UUID NOT NULL REFERENCES apartments(id),
    ownership_type VARCHAR(20) NOT NULL DEFAULT 'proprietario' 
        CHECK (ownership_type IN ('visita', 'proprietario')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 3. Modificações nos Tipos TypeScript

### 3.1 Atualização da Interface Vehicle

Atualizar as interfaces `Vehicle` nos arquivos relevantes:

**Arquivo: `app/morador/visitantes/VisitantesTab.tsx`**
```typescript
interface Vehicle {
  id: string;
  license_plate: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  type?: 'car' | 'motorcycle' | 'truck' | 'van' | 'bus' | 'other' | null;
  ownership_type: 'visita' | 'proprietario'; // Novo campo
  apartment_id: string;
  created_at: string;
}
```

**Arquivo: `app/morador/cadastro/index.tsx`**
```typescript
interface Vehicle {
  id: string;
  license_plate: string;
  brand?: string;
  model?: string;
  color?: string;
  type: 'car' | 'motorcycle' | 'truck' | 'van' | 'bus' | 'other';
  ownership_type: 'visita' | 'proprietario'; // Novo campo
  apartment_id: string;
  created_at: string;
}
```

### 3.2 Atualização dos Tipos do Database

**Arquivo: `types/database.ts`**
```typescript
vehicles: {
  Row: {
    id: string;
    license_plate: string;
    brand: string | null;
    model: string | null;
    color: string | null;
    type: 'car' | 'motorcycle' | 'truck' | 'van' | 'bus' | 'other' | null;
    ownership_type: 'visita' | 'proprietario'; // Novo campo
    apartment_id: string;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    license_plate: string;
    brand?: string | null;
    model?: string | null;
    color?: string | null;
    type?: 'car' | 'motorcycle' | 'truck' | 'van' | 'bus' | 'other' | null;
    ownership_type?: 'visita' | 'proprietario'; // Novo campo com valor padrão
    apartment_id: string;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    license_plate?: string;
    brand?: string | null;
    model?: string | null;
    color?: string | null;
    type?: 'car' | 'motorcycle' | 'truck' | 'van' | 'bus' | 'other' | null;
    ownership_type?: 'visita' | 'proprietario'; // Novo campo
    apartment_id?: string;
    created_at?: string;
    updated_at?: string;
  };
}
```

## 4. Modificações nos Formulários

### 4.1 VisitantesTab.tsx - Veículos de Visita

**Localização:** `app/morador/visitantes/VisitantesTab.tsx`

**Modificações necessárias:**

1. **Atualizar a consulta de veículos para incluir o novo campo:**

```typescript
// Buscar veículos filtrados por apartment_id
const { data: vehiclesData, error: vehiclesError } = await supabase
  .from('vehicles')
  .select(`
    id,
    license_plate,
    brand,
    model,
    color,
    type,
    ownership_type,
    apartment_id,
    created_at
  `)
  .eq('apartment_id', currentApartmentId)
  .order('created_at', { ascending: false });
```

2. **Atualizar o mapeamento dos dados dos veículos:**

```typescript
const mappedVehicles: Vehicle[] = (vehiclesData || []).map(vehicle => ({
  id: vehicle.id,
  license_plate: vehicle.license_plate,
  brand: vehicle.brand,
  model: vehicle.model,
  color: vehicle.color,
  type: vehicle.type,
  ownership_type: vehicle.ownership_type || 'proprietario',
  apartment_id: vehicle.apartment_id,
  created_at: vehicle.created_at
}));
```

3. **Adicionar função para cadastrar veículos de visita (se não existir):**

```typescript
const addVisitVehicle = async (vehicleData: {
  license_plate: string;
  brand?: string;
  model?: string;
  color?: string;
  type?: string;
}) => {
  try {
    const currentApartmentId = await loadApartmentId();
    if (!currentApartmentId) {
      throw new Error('Apartment_id não encontrado');
    }

    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        ...vehicleData,
        ownership_type: 'visita', // Fixo como 'visita'
        apartment_id: currentApartmentId
      })
      .select()
      .single();

    if (error) throw error;

    // Atualizar lista local
    setVehicles(prev => [data, ...prev]);
    
    Alert.alert('Sucesso', 'Veículo de visita cadastrado com sucesso!');
  } catch (error) {
    console.error('Erro ao cadastrar veículo de visita:', error);
    Alert.alert('Erro', 'Não foi possível cadastrar o veículo de visita.');
  }
};
```

4. **Atualizar a renderização para mostrar o tipo de propriedade:**

```typescript
const renderVehicleCard = (vehicle: Vehicle) => {
  return (
    <View key={vehicle.id} style={[styles.visitorCard, styles.vehicleCard]}>
      <View style={styles.visitorHeader}>
        <View style={styles.visitorInfo}>
          <Text style={styles.visitorName}>{vehicle.license_plate}</Text>
          <View style={styles.visitorTypeContainer}>
            <Text style={styles.visitorTypeIcon}>
              {vehicle.ownership_type === 'visita' ? '🚗' : '🏠'}
            </Text>
            <Text style={styles.visitorTypeText}>
              {vehicle.ownership_type === 'visita' ? 'Veículo de Visita' : 'Veículo Pessoal'}
            </Text>
          </View>
          {/* Resto da renderização... */}
        </View>
      </View>
    </View>
  );
};
```

### 4.2 Cadastro de Moradores - Veículos Pessoais

**Localização:** `app/morador/cadastro/index.tsx`

**Modificações necessárias:**

1. **Atualizar a função de adicionar veículo:**

```typescript
const handleAddVehicle = async () => {
  try {
    // Validações existentes...
    
    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        license_plate: newVehicle.license_plate.toUpperCase(),
        brand: newVehicle.brand,
        model: newVehicle.model,
        color: newVehicle.color,
        type: newVehicle.type,
        ownership_type: 'proprietario', // Padrão para veículos pessoais
        apartment_id: apartmentId
      })
      .select()
      .single();

    if (error) throw error;

    // Atualizar lista local
    setVehicles(prev => [...prev, data]);
    
    // Reset do formulário...
    setShowAddVehicleModal(false);
    Alert.alert('Sucesso', 'Veículo cadastrado com sucesso!');
  } catch (error) {
    console.error('Erro ao adicionar veículo:', error);
    Alert.alert('Erro', 'Não foi possível adicionar o veículo.');
  }
};
```

2. **Atualizar a consulta de veículos:**

```typescript
const fetchVehicles = async () => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        id,
        license_plate,
        brand,
        model,
        color,
        type,
        ownership_type,
        apartment_id,
        created_at
      `)
      .eq('apartment_id', apartmentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setVehicles(data || []);
  } catch (error) {
    console.error('Erro ao buscar veículos:', error);
  }
};
```

### 4.3 Componente RegistrarVeiculo.tsx

**Localização:** `components/porteiro/RegistrarVeiculo.tsx`

**Modificações necessárias:**

1. **Atualizar a inserção de novos veículos:**

```typescript
const vehicleInsertData = {
  license_plate: placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
  brand: marcaSelecionada.nome,
  model: modelo,
  color: corSelecionada.nome,
  type: 'car', // ou outro tipo baseado na seleção
  ownership_type: 'proprietario', // Padrão para veículos cadastrados pelo porteiro
  apartment_id: selectedApartment.id
};
```

## 5. Consultas e Filtros

### 5.1 Filtrar Veículos por Tipo de Propriedade

```typescript
// Buscar apenas veículos de visita
const { data: visitVehicles } = await supabase
  .from('vehicles')
  .select('*')
  .eq('ownership_type', 'visita')
  .eq('apartment_id', apartmentId);

// Buscar apenas veículos pessoais
const { data: personalVehicles } = await supabase
  .from('vehicles')
  .select('*')
  .eq('ownership_type', 'proprietario')
  .eq('apartment_id', apartmentId);
```

### 5.2 Estatísticas por Tipo

```typescript
// Contar veículos por tipo de propriedade
const { data: vehicleStats } = await supabase
  .from('vehicles')
  .select('ownership_type, count(*)')
  .eq('apartment_id', apartmentId)
  .group('ownership_type');
```

## 6. Considerações de Implementação

### 6.1 Migração de Dados Existentes

Todos os veículos existentes receberão automaticamente o valor padrão `'proprietario'` devido ao `DEFAULT` definido na migração.

### 6.2 Validação de Dados

- O campo `ownership_type` é obrigatório (NOT NULL)
- Aceita apenas os valores: `'visita'` ou `'proprietario'`
- Valor padrão: `'proprietario'`

### 6.3 Índices de Performance

Foi criado um índice `idx_vehicles_ownership_type` para otimizar consultas que filtram por tipo de propriedade.

### 6.4 Compatibilidade

A implementação é retrocompatível - veículos existentes continuarão funcionando normalmente com o valor padrão `'proprietario'`.

## 7. Testes Recomendados

1. **Teste de Migração:** Verificar se a migração executa sem erros
2. **Teste de Inserção:** Cadastrar veículos com ambos os tipos
3. **Teste de Consulta:** Filtrar veículos por tipo de propriedade
4. **Teste de Interface:** Verificar se os formulários definem o tipo correto
5. **Teste de Validação:** Tentar inserir valores inválidos para `ownership_type`

## 8. Rollback

Para reverter as mudanças, execute:

```sql
-- Remover índice
DROP INDEX IF EXISTS idx_vehicles_ownership_type;

-- Remover coluna
ALTER TABLE vehicles DROP COLUMN IF EXISTS ownership_type;
```

**Atenção:** O rollback resultará na perda dos dados do campo `ownership_type`.