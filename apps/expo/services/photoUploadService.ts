import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../utils/supabase';
import { supabaseServiceKey } from '../utils/supabase-admin';

// Create a separate client with service role for storage uploads
// WARNING: Service role should never be used on client apps. Replace with a secure backend/signed URLs in production.
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';

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
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
}

// Ensure we have a readable file:// URI. If we receive a content:// URI (Android), copy it to cache first.
const preprocessPhotoUri = async (
  uri: string,
): Promise<{ uri?: string; error?: string }> => {
  try {
    if (!uri) return { error: 'URI da foto inválida' }

    if (uri.startsWith('file://')) {
      return { uri }
    }

    // Handle content:// and other schemes by copying to cache
    const uploadsDir = `${FileSystem.cacheDirectory}uploads/`
    try {
      await FileSystem.makeDirectoryAsync(uploadsDir, { intermediates: true })
    } catch {
      // ignore if exists
    }

    const fileName = `photo_${Date.now()}.jpg`
    const dest = `${uploadsDir}${fileName}`

    await FileSystem.copyAsync({ from: uri, to: dest })
    return { uri: dest }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Falha ao preparar arquivo para upload'
    return { error: message }
  }
}

/**
 * Validates photo file before upload
 */
const validatePhoto = async (uri: string, options: Required<PhotoUploadOptions>): Promise<{ valid: boolean; error?: string }> => {
  try {
    console.log('🔧 validatePhoto: URI recebida:', uri);
    if (!uri || typeof uri !== 'string') {
      return { valid: false, error: 'URI inválida da foto' };
    }

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(uri);
    console.log('🔧 validatePhoto: fileInfo obtido:', fileInfo);
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
    console.error('❌ validatePhoto: erro ao obter informações do arquivo:', error);
    const message = error instanceof Error ? error.message : 'Erro ao validar arquivo';
    // Retorna erro detalhado para depuração (mantém mensagem genérica caso não exista message)
    return { valid: false, error: message || 'Erro ao validar arquivo' };
  }
};

/**
 * Generates a unique filename for the photo
 */
const generateUniqueFilename = (prefix: string): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}_${timestamp}_${random}.jpg`
}

/**
 * Uploads photo to Supabase Storage with retry logic using direct file upload
 */
const uploadWithRetry = async (
  filePath: string,
  photoUri: string,
  options: Required<PhotoUploadOptions>,
): Promise<PhotoUploadResult> => {
  let lastError = ''

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      console.log(`🔄 Upload attempt ${attempt}/${options.maxRetries} for ${filePath}`)
      console.log(`🔄 Photo URI: ${photoUri}`)

      // Method 1: Try direct upload using FileSystem.uploadAsync
      console.log('🔄 Trying direct upload with FileSystem.uploadAsync...')

      const uploadUrl = `${supabaseUrl}/storage/v1/object/delivery-visitor-photos/${filePath}`
      console.log('🔄 Upload URL:', uploadUrl)

      const uploadResult = await FileSystem.uploadAsync(uploadUrl, photoUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          // Do not set Content-Type manually; uploadAsync will include the correct multipart boundary
        },
      })

      console.log('🔄 FileSystem upload result:', uploadResult);

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
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
      lastError = error instanceof Error ? error.message : 'Erro desconhecido'
      console.log(`Upload attempt ${attempt} failed with exception:`, lastError)
    }

    if (attempt === options.maxRetries) {
      return { success: false, error: `Falha no upload após ${options.maxRetries} tentativas: ${lastError}` }
    }

    // Wait before retrying (exponential backoff-ish)
    const delay = options.retryDelay * attempt
    console.log(`⏳ Waiting ${delay}ms before retry...`)
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  return { success: false, error: `Falha no upload após ${options.maxRetries} tentativas: ${lastError}` }
}

/**
 * Main function to upload a photo for deliveries
 */
export const uploadDeliveryPhoto = async (
  photoUri: string,
  deliveryId?: string,
  options: PhotoUploadOptions = {},
): Promise<PhotoUploadResult> => {
  console.log('🔧 uploadDeliveryPhoto iniciado')
  console.log('🔧 photoUri recebido:', photoUri)
  console.log('🔧 deliveryId:', deliveryId)

  const finalOptions = { ...DEFAULT_OPTIONS, ...options }

  try {
    // Ensure we have a valid file:// URI
    const prep = await preprocessPhotoUri(photoUri)
    if (prep.error || !prep.uri) {
      console.log('❌ Pré-processamento da foto falhou:', prep.error)
      return { success: false, error: prep.error || 'Falha ao preparar arquivo' }
    }

    // Validate photo
    console.log('🔧 Iniciando validação da foto...')
    const validation = await validatePhoto(prep.uri, finalOptions)
    console.log('🔧 Resultado da validação:', validation)

    if (!validation.valid) {
      console.log('❌ Validação falhou:', validation.error)
      return { success: false, error: validation.error }
    }

    // Generate unique filename
    const filename = generateUniqueFilename(`delivery_${deliveryId || 'temp'}`)
    const filePath = `deliveries/${filename}`
    console.log('🔧 Filename gerado:', filename)
    console.log('🔧 FilePath:', filePath)

    // Upload with retry using direct file URI
    console.log('🔧 Iniciando upload com retry...')
    const result = await uploadWithRetry(filePath, prep.uri, finalOptions)
    console.log('🔧 Resultado final do upload:', result)
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido no upload'
    console.error('❌ Error in uploadDeliveryPhoto:', errorMessage)
    console.error('❌ Stack trace:', error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Main function to upload a photo for visitors
 */
export const uploadVisitorPhoto = async (
  photoUri: string,
  visitorId?: string,
  options: PhotoUploadOptions = {},
): Promise<PhotoUploadResult> => {
  console.log('🔧 uploadVisitorPhoto iniciado')
  console.log('🔧 photoUri recebido:', photoUri)
  console.log('🔧 visitorId:', visitorId)

  const finalOptions = { ...DEFAULT_OPTIONS, ...options }

  try {
    // Ensure we have a valid file:// URI
    const prep = await preprocessPhotoUri(photoUri)
    if (prep.error || !prep.uri) {
      console.log('❌ Pré-processamento da foto falhou:', prep.error)
      return { success: false, error: prep.error || 'Falha ao preparar arquivo' }
    }

    // Validate photo
    console.log('🔧 Iniciando validação da foto...')
    const validation = await validatePhoto(prep.uri, finalOptions)
    console.log('🔧 Resultado da validação:', validation)

    if (!validation.valid) {
      console.log('❌ Validação falhou:', validation.error)
      return { success: false, error: validation.error }
    }

    // Generate unique filename
    const filename = generateUniqueFilename(`visitor_${visitorId || 'temp'}`)
    const filePath = `visitors/${filename}`
    console.log('🔧 Filename gerado:', filename)
    console.log('🔧 FilePath:', filePath)

    // Upload with retry using direct file URI
    console.log('🔧 Iniciando upload com retry...')
    const result = await uploadWithRetry(filePath, prep.uri, finalOptions)
    console.log('🔧 Resultado final do upload:', result)
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido no upload'
    console.error('❌ Error in uploadVisitorPhoto:', errorMessage)
    console.error('❌ Stack trace:', error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Main function to upload a photo for residents (first login)
 */
export const uploadResidentPhoto = async (
  photoUri: string,
  userId: string,
  options: PhotoUploadOptions = {},
): Promise<PhotoUploadResult> => {
  console.log('🔧 uploadResidentPhoto iniciado')
  console.log('🔧 photoUri recebido:', photoUri)
  console.log('🔧 userId:', userId)

  const finalOptions = { ...DEFAULT_OPTIONS, ...options }

  try {
    // Ensure we have a valid file:// URI
    const prep = await preprocessPhotoUri(photoUri)
    if (prep.error || !prep.uri) {
      console.log('❌ Pré-processamento da foto (resident) falhou:', prep.error)
      return { success: false, error: prep.error || 'Falha ao preparar arquivo' }
    }

    // Validate photo
    console.log('🔧 Iniciando validação da foto...')
    const validation = await validatePhoto(prep.uri, finalOptions)
    console.log('🔧 Resultado da validação:', validation)

    if (!validation.valid) {
      console.log('❌ Validação falhou:', validation.error)
      return { success: false, error: validation.error }
    }

    // Generate unique filename for resident
    const filename = generateUniqueFilename(`resident_${userId}`)
    const filePath = `${userId}/${filename}`
    console.log('🔧 Filename gerado:', filename)
    console.log('🔧 FilePath:', filePath)

    // Upload with retry using resident-photos bucket
    console.log('🔧 Iniciando upload com retry para bucket resident-photos...')
    const result = await uploadResidentWithRetry(filePath, prep.uri, finalOptions)
    console.log('🔧 Resultado final do upload:', result)
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido no upload'
    console.error('❌ Error in uploadResidentPhoto:', errorMessage)
    console.error('❌ Stack trace:', error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Upload function specifically for resident-photos bucket
 */
const uploadResidentWithRetry = async (
  filePath: string,
  photoUri: string,
  options: Required<PhotoUploadOptions>,
): Promise<PhotoUploadResult> => {
  let lastError = ''

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      console.log(`🔄 Resident upload attempt ${attempt}/${options.maxRetries} for ${filePath}`)
      console.log(`🔄 Photo URI: ${photoUri}`)

      // Method 1: Try direct upload using FileSystem.uploadAsync
      console.log('🔄 Trying direct upload with FileSystem.uploadAsync...')

      const uploadUrl = `${supabaseUrl}/storage/v1/object/resident-photos/${filePath}`
      console.log('🔄 Upload URL:', uploadUrl)

      const uploadResult = await FileSystem.uploadAsync(uploadUrl, photoUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          // Do not set Content-Type manually; uploadAsync will include the correct multipart boundary
        },
      })

      console.log('🔄 FileSystem upload result:', uploadResult);

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
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
      lastError = error instanceof Error ? error.message : 'Erro desconhecido'
      console.log(`Resident upload attempt ${attempt} failed with exception:`, lastError)
    }

    if (attempt === options.maxRetries) {
      return { success: false, error: `Falha no upload após ${options.maxRetries} tentativas: ${lastError}` }
    }

    // Wait before retrying
    const delay = options.retryDelay * attempt
    console.log(`⏳ Waiting ${delay}ms before retry...`)
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  return { success: false, error: `Falha no upload após ${options.maxRetries} tentativas: ${lastError}` }
}

/**
 * Deletes a photo from Supabase Storage
 */
export const deletePhoto = async (photoUrl: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Extract file path from URL
    const url = new URL(photoUrl)
    const pathParts = url.pathname.split('/')
    const bucketIndex = pathParts.findIndex((part) => part === 'delivery-visitor-photos')

    if (bucketIndex === -1 || bucketIndex === pathParts.length - 1) {
      return { success: false, error: 'URL inválida' }
    }

    const filePath = pathParts.slice(bucketIndex + 1).join('/')

    const { error } = await supabase.storage.from('delivery-visitor-photos').remove([filePath])

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao deletar foto'
    return { success: false, error: errorMessage }
  }
}