import * as FileSystem from 'expo-file-system';
import { supabase } from '../utils/supabase';
import * as Crypto from 'expo-crypto';

export interface PhotoUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface PhotoUploadOptions {
  maxRetries?: number;
  retryDelay?: number;
  maxFileSizeMB?: number;
  allowedMimeTypes?: string[];
}

const DEFAULT_OPTIONS: Required<PhotoUploadOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
  maxFileSizeMB: 5,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
};

/**
 * Validates photo file before upload
 */
const validatePhoto = async (uri: string, options: Required<PhotoUploadOptions>): Promise<{ valid: boolean; error?: string }> => {
  try {
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return { valid: false, error: 'Arquivo não encontrado' };
    }

    // Check file size
    if (fileInfo.size && fileInfo.size > options.maxFileSizeMB * 1024 * 1024) {
      return { valid: false, error: `Arquivo muito grande. Máximo ${options.maxFileSizeMB}MB` };
    }

    // For now, we'll assume the file type is valid since expo-camera provides valid images
    // In a more robust implementation, we could check the file header
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Erro ao validar arquivo' };
  }
};

/**
 * Generates a unique filename for the photo
 */
const generateUniqueFilename = (prefix: string): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}.jpg`;
};

/**
 * Uploads photo to Supabase Storage with retry logic
 */
const uploadWithRetry = async (
  filePath: string,
  fileData: string,
  options: Required<PhotoUploadOptions>
): Promise<PhotoUploadResult> => {
  let lastError: string = '';

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      console.log(`🔄 Upload attempt ${attempt}/${options.maxRetries} for ${filePath}`);
      console.log(`🔄 Base64 data size: ${fileData.length} characters`);

      // Convert base64 to blob
      console.log('🔄 Converting base64 to blob...');
      const response = await fetch(`data:image/jpeg;base64,${fileData}`);
      const blob = await response.blob();
      console.log('🔄 Blob created, size:', blob.size, 'bytes');

      // Upload to Supabase Storage
      console.log('🔄 Uploading to Supabase Storage...');
      const { data, error } = await supabase.storage
        .from('delivery-visitor-photos')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      console.log('🔄 Supabase upload response - data:', data, 'error:', error);

      if (error) {
        lastError = error.message;
        console.log(`❌ Upload attempt ${attempt} failed:`, error.message);
        
        // If it's the last attempt, return the error
        if (attempt === options.maxRetries) {
          return { success: false, error: `Falha no upload após ${options.maxRetries} tentativas: ${lastError}` };
        }
        
        // Wait before retrying
        console.log(`⏳ Waiting ${options.retryDelay * attempt}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, options.retryDelay * attempt));
        continue;
      }

      // Get public URL
      console.log('🔄 Getting public URL...');
      const { data: urlData } = supabase.storage
        .from('delivery-visitor-photos')
        .getPublicUrl(filePath);

      console.log('🔄 Public URL data:', urlData);
      console.log(`✅ Upload successful on attempt ${attempt}! URL: ${urlData.publicUrl}`);
      return { success: true, url: urlData.publicUrl };

    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Erro desconhecido';
      console.log(`Upload attempt ${attempt} failed with exception:`, lastError);
      
      if (attempt === options.maxRetries) {
        return { success: false, error: `Falha no upload após ${options.maxRetries} tentativas: ${lastError}` };
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, options.retryDelay * attempt));
    }
  }

  return { success: false, error: `Falha no upload após ${options.maxRetries} tentativas: ${lastError}` };
};

/**
 * Main function to upload a photo for deliveries
 */
export const uploadDeliveryPhoto = async (
  photoUri: string,
  deliveryId?: string,
  options: PhotoUploadOptions = {}
): Promise<PhotoUploadResult> => {
  console.log('🔧 uploadDeliveryPhoto iniciado');
  console.log('🔧 photoUri recebido:', photoUri);
  console.log('🔧 deliveryId:', deliveryId);
  
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Validate photo
    console.log('🔧 Iniciando validação da foto...');
    const validation = await validatePhoto(photoUri, finalOptions);
    console.log('🔧 Resultado da validação:', validation);
    
    if (!validation.valid) {
      console.log('❌ Validação falhou:', validation.error);
      return { success: false, error: validation.error };
    }

    // Read file as base64
    console.log('🔧 Lendo arquivo como base64...');
    const base64Data = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64
    });
    console.log('🔧 Base64 data length:', base64Data.length);

    // Generate unique filename
    const filename = generateUniqueFilename(`delivery_${deliveryId || 'temp'}`);
    const filePath = `deliveries/${filename}`;
    console.log('🔧 Filename gerado:', filename);
    console.log('🔧 FilePath:', filePath);

    // Upload with retry
    console.log('🔧 Iniciando upload com retry...');
    const result = await uploadWithRetry(filePath, base64Data, finalOptions);
    console.log('🔧 Resultado final do upload:', result);
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido no upload';
    console.error('❌ Error in uploadDeliveryPhoto:', errorMessage);
    console.error('❌ Stack trace:', error);
    return { success: false, error: errorMessage };
  }
};

/**
 * Main function to upload a photo for visitors
 */
export const uploadVisitorPhoto = async (
  photoUri: string,
  visitorId?: string,
  options: PhotoUploadOptions = {}
): Promise<PhotoUploadResult> => {
  console.log('🔧 uploadVisitorPhoto iniciado');
  console.log('🔧 photoUri recebido:', photoUri);
  console.log('🔧 visitorId:', visitorId);
  
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Validate photo
    console.log('🔧 Iniciando validação da foto...');
    const validation = await validatePhoto(photoUri, finalOptions);
    console.log('🔧 Resultado da validação:', validation);
    
    if (!validation.valid) {
      console.log('❌ Validação falhou:', validation.error);
      return { success: false, error: validation.error };
    }

    // Read file as base64
    console.log('🔧 Lendo arquivo como base64...');
    const base64Data = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64
    });
    console.log('🔧 Base64 data length:', base64Data.length);

    // Generate unique filename
    const filename = generateUniqueFilename(`visitor_${visitorId || 'temp'}`);
    const filePath = `visitors/${filename}`;
    console.log('🔧 Filename gerado:', filename);
    console.log('🔧 FilePath:', filePath);

    // Upload with retry
    console.log('🔧 Iniciando upload com retry...');
    const result = await uploadWithRetry(filePath, base64Data, finalOptions);
    console.log('🔧 Resultado final do upload:', result);
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido no upload';
    console.error('❌ Error in uploadVisitorPhoto:', errorMessage);
    console.error('❌ Stack trace:', error);
    return { success: false, error: errorMessage };
  }
};

/**
 * Deletes a photo from Supabase Storage
 */
export const deletePhoto = async (photoUrl: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Extract file path from URL
    const url = new URL(photoUrl);
    const pathParts = url.pathname.split('/');
    const bucketIndex = pathParts.findIndex(part => part === 'delivery-visitor-photos');
    
    if (bucketIndex === -1 || bucketIndex === pathParts.length - 1) {
      return { success: false, error: 'URL inválida' };
    }

    const filePath = pathParts.slice(bucketIndex + 1).join('/');

    const { error } = await supabase.storage
      .from('delivery-visitor-photos')
      .remove([filePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao deletar foto';
    return { success: false, error: errorMessage };
  }
};

// Log para confirmar que o serviço foi carregado
console.log('🔧 PhotoUploadService carregado com sucesso!');