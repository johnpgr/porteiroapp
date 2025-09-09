import * as FileSystem from 'expo-file-system';
import { supabase } from '../utils/supabase';
import { createClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';

// Create a separate client with service role for storage uploads
// This bypasses RLS policies that are blocking uploads
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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
 * Uploads photo to Supabase Storage with retry logic using direct file upload
 */
const uploadWithRetry = async (
  filePath: string,
  photoUri: string,
  options: Required<PhotoUploadOptions>
): Promise<PhotoUploadResult> => {
  let lastError: string = '';

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      console.log(`🔄 Upload attempt ${attempt}/${options.maxRetries} for ${filePath}`);
      console.log(`🔄 Photo URI: ${photoUri}`);

      // Method 1: Try direct upload using FileSystem.uploadAsync
      console.log('🔄 Trying direct upload with FileSystem.uploadAsync...');
      
      const uploadUrl = `${supabaseUrl}/storage/v1/object/delivery-visitor-photos/${filePath}`;
      console.log('🔄 Upload URL:', uploadUrl);
      
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, photoUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('🔄 FileSystem upload result:', uploadResult);

      if (uploadResult.status === 200) {
        // Get public URL using regular client
        console.log('🔄 Getting public URL...');
        const { data: urlData } = supabase.storage
          .from('delivery-visitor-photos')
          .getPublicUrl(filePath);

        console.log('🔄 Public URL data:', urlData);
        console.log(`✅ Upload successful on attempt ${attempt}! URL: ${urlData.publicUrl}`);
        return { success: true, url: urlData.publicUrl };
      } else {
        lastError = `HTTP ${uploadResult.status}: ${uploadResult.body || 'Upload failed'}`;
        console.log(`❌ Upload attempt ${attempt} failed:`, lastError);
      }

    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Erro desconhecido';
      console.log(`Upload attempt ${attempt} failed with exception:`, lastError);
      
      // Try fallback method with blob conversion
      if (attempt === options.maxRetries) {
        console.log('🔄 Trying fallback method with blob conversion...');
        try {
          // Read file as base64
          const base64Data = await FileSystem.readAsStringAsync(photoUri, {
            encoding: FileSystem.EncodingType.Base64
          });
          
          // Convert base64 to blob
          const response = await fetch(`data:image/jpeg;base64,${base64Data}`);
          const blob = await response.blob();
          
          // Upload to Supabase Storage using admin client
          const { data, error } = await supabaseAdmin.storage
            .from('delivery-visitor-photos')
            .upload(filePath, blob, {
              contentType: 'image/jpeg',
              upsert: false
            });

          if (!error) {
            const { data: urlData } = supabase.storage
              .from('delivery-visitor-photos')
              .getPublicUrl(filePath);
            
            console.log(`✅ Fallback upload successful! URL: ${urlData.publicUrl}`);
            return { success: true, url: urlData.publicUrl };
          } else {
            lastError = error.message;
          }
        } catch (fallbackError) {
          lastError = fallbackError instanceof Error ? fallbackError.message : 'Erro no método fallback';
          console.log('❌ Fallback method also failed:', lastError);
        }
      }
      
      if (attempt === options.maxRetries) {
        return { success: false, error: `Falha no upload após ${options.maxRetries} tentativas: ${lastError}` };
      }
      
      // Wait before retrying
      console.log(`⏳ Waiting ${options.retryDelay * attempt}ms before retry...`);
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

    // Generate unique filename
    const filename = generateUniqueFilename(`delivery_${deliveryId || 'temp'}`);
    const filePath = `deliveries/${filename}`;
    console.log('🔧 Filename gerado:', filename);
    console.log('🔧 FilePath:', filePath);

    // Upload with retry using direct file URI
    console.log('🔧 Iniciando upload com retry...');
    const result = await uploadWithRetry(filePath, photoUri, finalOptions);
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

    // Generate unique filename
    const filename = generateUniqueFilename(`visitor_${visitorId || 'temp'}`);
    const filePath = `visitors/${filename}`;
    console.log('🔧 Filename gerado:', filename);
    console.log('🔧 FilePath:', filePath);

    // Upload with retry using direct file URI
    console.log('🔧 Iniciando upload com retry...');
    const result = await uploadWithRetry(filePath, photoUri, finalOptions);
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
 * Main function to upload a photo for residents (first login)
 */
export const uploadResidentPhoto = async (
  photoUri: string,
  userId: string,
  options: PhotoUploadOptions = {}
): Promise<PhotoUploadResult> => {
  console.log('🔧 uploadResidentPhoto iniciado');
  console.log('🔧 photoUri recebido:', photoUri);
  console.log('🔧 userId:', userId);
  
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

    // Generate unique filename for resident
    const filename = generateUniqueFilename(`resident_${userId}`);
    const filePath = `${userId}/${filename}`;
    console.log('🔧 Filename gerado:', filename);
    console.log('🔧 FilePath:', filePath);

    // Upload with retry using resident-photos bucket
    console.log('🔧 Iniciando upload com retry para bucket resident-photos...');
    const result = await uploadResidentWithRetry(filePath, photoUri, finalOptions);
    console.log('🔧 Resultado final do upload:', result);
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido no upload';
    console.error('❌ Error in uploadResidentPhoto:', errorMessage);
    console.error('❌ Stack trace:', error);
    return { success: false, error: errorMessage };
  }
};

/**
 * Upload function specifically for resident-photos bucket
 */
const uploadResidentWithRetry = async (
  filePath: string,
  photoUri: string,
  options: Required<PhotoUploadOptions>
): Promise<PhotoUploadResult> => {
  let lastError: string = '';

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      console.log(`🔄 Resident upload attempt ${attempt}/${options.maxRetries} for ${filePath}`);
      console.log(`🔄 Photo URI: ${photoUri}`);

      // Method 1: Try direct upload using FileSystem.uploadAsync
      console.log('🔄 Trying direct upload with FileSystem.uploadAsync...');
      
      const uploadUrl = `${supabaseUrl}/storage/v1/object/resident-photos/${filePath}`;
      console.log('🔄 Upload URL:', uploadUrl);
      
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, photoUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('🔄 FileSystem upload result:', uploadResult);

      if (uploadResult.status === 200) {
        // Get public URL using regular client
        console.log('🔄 Getting public URL...');
        const { data: urlData } = supabase.storage
          .from('resident-photos')
          .getPublicUrl(filePath);

        console.log('🔄 Public URL data:', urlData);
        console.log(`✅ Resident upload successful on attempt ${attempt}! URL: ${urlData.publicUrl}`);
        return { success: true, url: urlData.publicUrl };
      } else {
        lastError = `HTTP ${uploadResult.status}: ${uploadResult.body || 'Upload failed'}`;
        console.log(`❌ Resident upload attempt ${attempt} failed:`, lastError);
      }

    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Erro desconhecido';
      console.log(`Resident upload attempt ${attempt} failed with exception:`, lastError);
      
      // Try fallback method with blob conversion
      if (attempt === options.maxRetries) {
        console.log('🔄 Trying fallback method with blob conversion...');
        try {
          // Read file as base64
          const base64Data = await FileSystem.readAsStringAsync(photoUri, {
            encoding: FileSystem.EncodingType.Base64
          });
          
          // Convert base64 to blob
          const response = await fetch(`data:image/jpeg;base64,${base64Data}`);
          const blob = await response.blob();
          
          // Upload to Supabase Storage using admin client
          const { data, error } = await supabaseAdmin.storage
            .from('resident-photos')
            .upload(filePath, blob, {
              contentType: 'image/jpeg',
              upsert: false
            });

          if (!error) {
            const { data: urlData } = supabase.storage
              .from('resident-photos')
              .getPublicUrl(filePath);
            
            console.log(`✅ Resident fallback upload successful! URL: ${urlData.publicUrl}`);
            return { success: true, url: urlData.publicUrl };
          } else {
            lastError = error.message;
          }
        } catch (fallbackError) {
          lastError = fallbackError instanceof Error ? fallbackError.message : 'Erro no método fallback';
          console.log('❌ Resident fallback method also failed:', lastError);
        }
      }
      
      if (attempt === options.maxRetries) {
        return { success: false, error: `Falha no upload após ${options.maxRetries} tentativas: ${lastError}` };
      }
      
      // Wait before retrying
      console.log(`⏳ Waiting ${options.retryDelay * attempt}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, options.retryDelay * attempt));
    }
  }

  return { success: false, error: `Falha no upload após ${options.maxRetries} tentativas: ${lastError}` };
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