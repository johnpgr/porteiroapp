import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import NetInfo from '@react-native-community/netinfo';
import type { FileOptions } from '@porteiroapp/supabase';

export interface PhotoUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export class PhotoUploadService {
  private static readonly BUCKET_NAME = 'user-photos';
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  /**
   * Solicita permissão para acessar a galeria de fotos
   */
  static async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'É necessário permitir acesso à galeria para alterar a foto do perfil.'
        );
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ [PhotoUpload] Erro ao solicitar permissões:', error);
      return false;
    }
  }

  /**
   * Abre o seletor de imagens
   */
  static async pickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return null;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (result.canceled || !result.assets || !result.assets[0]) {
        return null;
      }

      return result.assets[0];
    } catch (error) {
      console.error('❌ [PhotoUpload] Erro ao selecionar imagem:', error);
      Alert.alert('Erro', 'Falha ao selecionar imagem');
      return null;
    }
  }

  /**
   * Valida o arquivo de imagem
   */
  private static validateImage(asset: ImagePicker.ImagePickerAsset): boolean {
    // Verificar tamanho do arquivo
    if (asset.fileSize && asset.fileSize > this.MAX_FILE_SIZE) {
      Alert.alert(
        'Arquivo muito grande',
        'A imagem deve ter no máximo 5MB. Tente selecionar uma imagem menor.'
      );
      return false;
    }

    // Verificar tipo do arquivo
    if (asset.mimeType && !this.ALLOWED_TYPES.includes(asset.mimeType)) {
      Alert.alert(
        'Formato não suportado',
        'Apenas imagens JPEG, PNG e WebP são aceitas.'
      );
      return false;
    }

    return true;
  }

  /**
   * Gera um nome único para o arquivo
   */
  private static generateFileName(userId: string, originalName?: string): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = originalName ? originalName.split('.').pop() : 'jpg';
    return `${userId}/${timestamp}_${randomId}.${extension}`;
  }

  /**
   * Converte URI local para Blob com retry e timeout
   */
  private static async uriToBlob(uri: string): Promise<Blob> {
    const maxRetries = 3;
    const timeout = 10000; // 10 segundos
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [PhotoUpload] Convertendo URI para blob (tentativa ${attempt}/${maxRetries})`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(uri, {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        console.log('✅ [PhotoUpload] Conversão para blob bem-sucedida');
        return blob;
        
      } catch (error: any) {
        console.error(`❌ [PhotoUpload] Erro na conversão (tentativa ${attempt}):`, error.message);
        
        if (attempt === maxRetries) {
          throw new Error('Falha ao processar a imagem. Verifique sua conexão e tente novamente.');
        }
        
        // Aguardar antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    throw new Error('Falha ao processar a imagem após múltiplas tentativas.');
  }

  /**
   * Verifica conectividade de rede
   */
  private static async checkNetworkConnectivity(): Promise<boolean> {
    try {
      const netInfo = await NetInfo.fetch();
      const isConnected = netInfo.isConnected === true && netInfo.isInternetReachable !== false;
      
      console.log('📶 [PhotoUpload] Status da rede:', {
        isConnected: netInfo.isConnected,
        isInternetReachable: netInfo.isInternetReachable,
        type: netInfo.type
      });
      
      return isConnected;
    } catch (error) {
      console.warn('⚠️ [PhotoUpload] Erro ao verificar conectividade:', error);
      return true; // Assumir conectividade se não conseguir verificar
    }
  }

  /**
   * Faz upload da imagem para o Supabase Storage com retry e melhor tratamento de erros
   */
  static async uploadPhoto(
    userId: string,
    imageAsset: ImagePicker.ImagePickerAsset
  ): Promise<PhotoUploadResult> {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 segundos
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📤 [PhotoUpload] Iniciando upload para usuário: ${userId} (tentativa ${attempt}/${maxRetries})`);
        
        // Verificar conectividade antes do upload
        const isConnected = await this.checkNetworkConnectivity();
        if (!isConnected) {
          throw new Error('Sem conexão com a internet. Verifique sua rede e tente novamente.');
        }
        
        // Validar imagem
        if (!this.validateImage(imageAsset)) {
          return { success: false, error: 'Imagem inválida' };
        }

        // Gerar nome do arquivo
        const fileName = this.generateFileName(userId, imageAsset.fileName ?? undefined);
        console.log('📝 [PhotoUpload] Nome do arquivo gerado:', fileName);

        // Converter URI para Blob
        const blob = await this.uriToBlob(imageAsset.uri);
        console.log('🔄 [PhotoUpload] Imagem convertida para blob, tamanho:', blob.size);

        // Configurações de upload mais robustas
        const uploadOptions: FileOptions = {
          cacheControl: '3600',
          upsert: false,
          contentType: imageAsset.mimeType || 'image/jpeg',
          duplex: 'half'
        };

        // Fazer upload para o Supabase Storage
        console.log('☁️ [PhotoUpload] Enviando para Supabase Storage...');
        const { data, error } = await supabase.storage
          .from(this.BUCKET_NAME)
          .upload(fileName, blob, uploadOptions);

        if (error) {
          console.error('❌ [PhotoUpload] Erro no upload:', error);
          
          // Tratar erro de arquivo já existente
          if (error.message.includes('already exists')) {
            console.log('🔄 [PhotoUpload] Arquivo já existe, tentando com novo nome...');
            const newFileName = this.generateFileName(userId, imageAsset.fileName ?? undefined);
            const retryResult = await supabase.storage
              .from(this.BUCKET_NAME)
              .upload(newFileName, blob, uploadOptions);

            if (retryResult.error) {
              throw retryResult.error;
            }

            if (!retryResult.data) {
              throw new Error('Upload retornado sem dados');
            }

            // Obter URL pública da imagem com o novo caminho
            const { data: urlData } = supabase.storage
              .from(this.BUCKET_NAME)
              .getPublicUrl(retryResult.data.path);

            console.log('✅ [PhotoUpload] Upload concluído com sucesso:', urlData.publicUrl);
            
            return {
              success: true,
              url: urlData.publicUrl
            };
          } else {
            throw error;
          }
        }

        if (!data) {
          throw new Error('Upload retornado sem dados');
        }

        // Obter URL pública da imagem
        const { data: urlData } = supabase.storage
          .from(this.BUCKET_NAME)
          .getPublicUrl(data.path);

        console.log('✅ [PhotoUpload] Upload concluído com sucesso:', urlData.publicUrl);
        
        return {
          success: true,
          url: urlData.publicUrl
        };

      } catch (error: any) {
        console.error(`❌ [PhotoUpload] Erro na tentativa ${attempt}:`, error);
        
        // Se é a última tentativa, retornar erro
        if (attempt === maxRetries) {
          let errorMessage = 'Falha ao fazer upload da imagem';
          
          if (error.message?.toLowerCase().includes('network') || 
              error.message?.toLowerCase().includes('fetch') ||
              error.message?.toLowerCase().includes('connection') ||
              error.message?.toLowerCase().includes('timeout')) {
            errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
          } else if (error.message?.toLowerCase().includes('storage')) {
            errorMessage = 'Erro no armazenamento. Tente novamente em alguns instantes.';
          } else if (error.message?.toLowerCase().includes('permission') ||
                     error.message?.toLowerCase().includes('unauthorized')) {
            errorMessage = 'Sem permissão para fazer upload. Contate o suporte.';
          } else if (error.message?.toLowerCase().includes('size') ||
                     error.message?.toLowerCase().includes('large')) {
            errorMessage = 'Arquivo muito grande. Tente com uma imagem menor.';
          }
          
          return {
            success: false,
            error: errorMessage
          };
        }
        
        // Aguardar antes da próxima tentativa (delay exponencial)
        const delay = baseDelay * attempt;
        console.log(`⏳ [PhotoUpload] Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return {
      success: false,
      error: 'Falha no upload após múltiplas tentativas. Tente novamente mais tarde.'
    };
  }

  /**
   * Remove uma foto do storage
   */
  static async deletePhoto(photoUrl: string): Promise<boolean> {
    try {
      // Extrair o path da URL
      const url = new URL(photoUrl);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/user-photos\/(.+)/);
      
      if (!pathMatch || !pathMatch[1]) {
        console.warn('⚠️ [PhotoUpload] URL inválida para exclusão:', photoUrl);
        return false;
      }

      const filePath = pathMatch[1];
      console.log('🗑️ [PhotoUpload] Removendo arquivo:', filePath);

      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([filePath]);

      if (error) {
        console.error('❌ [PhotoUpload] Erro ao remover arquivo:', error);
        return false;
      }

      console.log('✅ [PhotoUpload] Arquivo removido com sucesso');
      return true;
    } catch (error) {
      console.error('❌ [PhotoUpload] Erro geral na remoção:', error);
      return false;
    }
  }

  /**
   * Fluxo completo: selecionar e fazer upload da imagem
   */
  static async selectAndUploadPhoto(userId: string): Promise<PhotoUploadResult> {
    try {
      console.log('🎯 [PhotoUpload] Iniciando fluxo completo para usuário:', userId);
      
      // Selecionar imagem
      const imageAsset = await this.pickImage();
      if (!imageAsset) {
        return { success: false, error: 'Nenhuma imagem selecionada' };
      }

      // Fazer upload
      return await this.uploadPhoto(userId, imageAsset);
    } catch (error: any) {
      console.error('❌ [PhotoUpload] Erro no fluxo completo:', error);
      return {
        success: false,
        error: error.message || 'Erro inesperado'
      };
    }
  }
}