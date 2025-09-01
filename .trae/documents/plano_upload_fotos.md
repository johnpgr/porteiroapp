# Plano Técnico Detalhado - Upload de Fotos para Encomendas e Visitantes

## 1. Visão Geral do Projeto

Implementar funcionalidade completa de upload de fotos nos componentes `RegistrarEncomenda.tsx` e `RegistrarVisitante.tsx`, permitindo que porteiros capturem e armazenem fotos como comprovante de entregas e registro de visitantes.

## 2. Análise da Estrutura Atual

### 2.1 Componentes Existentes
- **RegistrarEncomenda.tsx**: Já possui interface de câmera implementada, mas sem funcionalidade de upload
- **RegistrarVisitante.tsx**: Também possui interface de câmera básica
- **Dependências disponíveis**: `expo-camera`, `expo-image-picker`, `@supabase/supabase-js`

### 2.2 Buckets Existentes
- `profiles-images`: Para fotos de perfil de usuários
- `profiles-fotos`: Para fotos de perfil (duplicado)
- **Necessidade**: Criar novo bucket específico para fotos de encomendas e visitantes

## 3. Criação do Bucket no Supabase Storage

### 3.1 Estrutura do Bucket
```sql
-- Criar bucket para fotos de encomendas e visitantes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-visitor-photos',
  'delivery-visitor-photos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Políticas RLS para o bucket
CREATE POLICY "Authenticated users can upload photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'delivery-visitor-photos' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Public can view photos" ON storage.objects
FOR SELECT USING (bucket_id = 'delivery-visitor-photos');

CREATE POLICY "Users can update their own photos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'delivery-visitor-photos' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own photos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'delivery-visitor-photos' AND
  auth.role() = 'authenticated'
);
```

### 3.2 Estrutura de Pastas
```
delivery-visitor-photos/
├── deliveries/
│   ├── 2024/
│   │   ├── 01/
│   │   │   └── delivery_[delivery_id]_[timestamp].jpg
│   │   └── 02/
│   └── 2025/
└── visitors/
    ├── 2024/
    │   ├── 01/
    │   │   └── visitor_[visitor_id]_[timestamp].jpg
    │   └── 02/
    └── 2025/
```

## 4. Serviço de Upload de Fotos

### 4.1 Criar arquivo `services/photoUploadService.ts`
```typescript
import { supabase } from '../utils/supabase';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export interface PhotoUploadOptions {
  type: 'delivery' | 'visitor';
  entityId: string;
  imageUri: string;
  quality?: number;
}

export interface PhotoUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

class PhotoUploadService {
  private readonly BUCKET_NAME = 'delivery-visitor-photos';
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  /**
   * Gera nome único para o arquivo
   */
  private generateFileName(type: 'delivery' | 'visitor', entityId: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = now.getTime();
    
    return `${type === 'delivery' ? 'deliveries' : 'visitors'}/${year}/${month}/${type}_${entityId}_${timestamp}.jpg`;
  }

  /**
   * Converte URI da imagem para base64
   */
  private async convertImageToBase64(imageUri: string): Promise<string> {
    try {
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    } catch (error) {
      throw new Error('Erro ao converter imagem para base64');
    }
  }

  /**
   * Valida o arquivo antes do upload
   */
  private async validateFile(imageUri: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      
      if (!fileInfo.exists) {
        throw new Error('Arquivo não encontrado');
      }

      if (fileInfo.size && fileInfo.size > this.MAX_FILE_SIZE) {
        throw new Error('Arquivo muito grande. Máximo permitido: 5MB');
      }
    } catch (error) {
      throw new Error(`Erro na validação do arquivo: ${error}`);
    }
  }

  /**
   * Faz upload da foto para o Supabase Storage
   */
  async uploadPhoto(options: PhotoUploadOptions): Promise<PhotoUploadResult> {
    try {
      const { type, entityId, imageUri, quality = 0.8 } = options;

      // Validar arquivo
      await this.validateFile(imageUri);

      // Gerar nome do arquivo
      const fileName = this.generateFileName(type, entityId);

      // Converter para base64
      const base64 = await this.convertImageToBase64(imageUri);
      const arrayBuffer = decode(base64);

      // Upload para Supabase
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) {
        console.error('Erro no upload:', error);
        return {
          success: false,
          error: 'Erro ao fazer upload da foto'
        };
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(fileName);

      return {
        success: true,
        url: urlData.publicUrl
      };

    } catch (error) {
      console.error('Erro no serviço de upload:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Upload com retry automático
   */
  async uploadPhotoWithRetry(options: PhotoUploadOptions, maxRetries: number = 3): Promise<PhotoUploadResult> {
    let lastError: string = '';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.uploadPhoto(options);
      
      if (result.success) {
        return result;
      }
      
      lastError = result.error || 'Erro desconhecido';
      
      if (attempt < maxRetries) {
        // Aguardar antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    return {
      success: false,
      error: `Falha após ${maxRetries} tentativas: ${lastError}`
    };
  }
}

export const photoUploadService = new PhotoUploadService();
```

## 5. Atualização do Banco de Dados

### 5.1 Migração para adicionar campos de foto
```sql
-- Adicionar campo photo_url na tabela deliveries
ALTER TABLE deliveries ADD COLUMN photo_url TEXT;

-- Adicionar campo photo_url na tabela visitor_logs
ALTER TABLE visitor_logs ADD COLUMN photo_url TEXT;

-- Adicionar índices para performance
CREATE INDEX idx_deliveries_photo_url ON deliveries(photo_url) WHERE photo_url IS NOT NULL;
CREATE INDEX idx_visitor_logs_photo_url ON visitor_logs(photo_url) WHERE photo_url IS NOT NULL;
```

## 6. Integração com RegistrarEncomenda.tsx

### 6.1 Modificações necessárias

#### 6.1.1 Imports adicionais
```typescript
import { photoUploadService } from '../../services/photoUploadService';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
```

#### 6.1.2 Estados adicionais
```typescript
const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
```

#### 6.1.3 Função para capturar foto
```typescript
const handleTakePhoto = async (cameraRef: any) => {
  try {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: false,
      });
      
      setCapturedPhotoUri(photo.uri);
      setFotoTirada(true);
    }
  } catch (error) {
    console.error('Erro ao capturar foto:', error);
    Alert.alert('Erro', 'Não foi possível capturar a foto');
  }
};
```

#### 6.1.4 Modificação na função handleConfirm
```typescript
const handleConfirm = async () => {
  try {
    // ... código existente até inserção da entrega ...
    
    let photoUrl: string | null = null;
    
    // Upload da foto se foi capturada
    if (capturedPhotoUri && deliveryData?.id) {
      setIsUploadingPhoto(true);
      
      const uploadResult = await photoUploadService.uploadPhotoWithRetry({
        type: 'delivery',
        entityId: deliveryData.id,
        imageUri: capturedPhotoUri,
        quality: 0.8
      });
      
      if (uploadResult.success) {
        photoUrl = uploadResult.url!;
        
        // Atualizar registro da entrega com URL da foto
        const { error: updateError } = await supabase
          .from('deliveries')
          .update({ photo_url: photoUrl })
          .eq('id', deliveryData.id);
          
        if (updateError) {
          console.error('Erro ao atualizar URL da foto:', updateError);
        }
      } else {
        console.error('Erro no upload da foto:', uploadResult.error);
        Alert.alert('Aviso', 'Entrega registrada, mas houve problema ao salvar a foto.');
      }
      
      setIsUploadingPhoto(false);
    }
    
    // ... resto do código existente ...
  } catch (error) {
    // ... tratamento de erro ...
  }
};
```

## 7. Integração com RegistrarVisitante.tsx

### 7.1 Modificações similares ao RegistrarEncomenda

#### 7.1.1 Estados e imports (similares ao item 6.1.1 e 6.1.2)

#### 7.1.2 Modificação na função handleConfirm
```typescript
const handleConfirm = async () => {
  try {
    // ... código existente até inserção do log ...
    
    let photoUrl: string | null = null;
    
    // Upload da foto se foi capturada
    if (capturedPhotoUri && logData?.id) {
      setIsUploadingPhoto(true);
      
      const uploadResult = await photoUploadService.uploadPhotoWithRetry({
        type: 'visitor',
        entityId: logData.id,
        imageUri: capturedPhotoUri,
        quality: 0.8
      });
      
      if (uploadResult.success) {
        photoUrl = uploadResult.url!;
        
        // Atualizar registro do visitor_log com URL da foto
        const { error: updateError } = await supabase
          .from('visitor_logs')
          .update({ photo_url: photoUrl })
          .eq('id', logData.id);
          
        if (updateError) {
          console.error('Erro ao atualizar URL da foto:', updateError);
        }
      } else {
        console.error('Erro no upload da foto:', uploadResult.error);
        Alert.alert('Aviso', 'Visitante registrado, mas houve problema ao salvar a foto.');
      }
      
      setIsUploadingPhoto(false);
    }
    
    // ... resto do código existente ...
  } catch (error) {
    // ... tratamento de erro ...
  }
};
```

## 8. Melhorias na Interface do Usuário

### 8.1 Indicador de upload
```typescript
// Adicionar no renderConfirmacaoStep
{isUploadingPhoto && (
  <View style={styles.uploadingContainer}>
    <ActivityIndicator size="small" color="#2196F3" />
    <Text style={styles.uploadingText}>Salvando foto...</Text>
  </View>
)}
```

### 8.2 Preview da foto capturada
```typescript
// Adicionar componente para mostrar preview
{capturedPhotoUri && (
  <View style={styles.photoPreviewContainer}>
    <Image source={{ uri: capturedPhotoUri }} style={styles.photoPreview} />
    <TouchableOpacity 
      style={styles.retakeButton}
      onPress={() => {
        setCapturedPhotoUri(null);
        setFotoTirada(false);
      }}
    >
      <Text style={styles.retakeButtonText}>Tirar nova foto</Text>
    </TouchableOpacity>
  </View>
)}
```

## 9. Tratamento de Erros e Validações

### 9.1 Validações implementadas
- Tamanho máximo do arquivo (5MB)
- Tipos de arquivo permitidos (JPEG, PNG, WebP)
- Verificação de existência do arquivo
- Retry automático em caso de falha

### 9.2 Mensagens de erro amigáveis
- "Arquivo muito grande. Máximo permitido: 5MB"
- "Formato de arquivo não suportado"
- "Erro de conexão. Tentando novamente..."
- "Foto salva com sucesso!"

## 10. Cronograma de Implementação

### Fase 1 (1-2 dias)
1. Criar migração do banco de dados
2. Configurar bucket no Supabase Storage
3. Implementar serviço de upload

### Fase 2 (2-3 dias)
4. Integrar upload no RegistrarEncomenda.tsx
5. Integrar upload no RegistrarVisitante.tsx
6. Implementar preview e retry

### Fase 3 (1 dia)
7. Testes e ajustes finais
8. Documentação e deploy

## 11. Considerações de Performance

### 11.1 Otimizações
- Compressão automática das imagens (quality: 0.8)
- Upload assíncrono para não bloquear a UI
- Retry automático com backoff exponencial
- Limpeza de arquivos temporários

### 11.2 Monitoramento
- Logs de upload para debugging
- Métricas de sucesso/falha
- Tempo médio de upload

## 12. Segurança

### 12.1 Políticas RLS implementadas
- Apenas usuários autenticados podem fazer upload
- Fotos são públicas para visualização
- Controle de acesso por função do usuário

### 12.2 Validações de segurança
- Verificação de tipo MIME
- Limite de tamanho de arquivo
- Sanitização de nomes de arquivo

Este plano garante uma implementação robusta e segura do upload de fotos, seguindo as melhores práticas já estabelecidas no projeto e mantendo a consistência com a arquitetura existente.