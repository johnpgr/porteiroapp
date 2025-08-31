import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@porteiro_app:jwt_token';
const USER_DATA_KEY = '@porteiro_app:user_data';
const EXPIRY_KEY = '@porteiro_app:token_expiry';

export interface StoredUserData {
  id: string;
  email: string;
  role: 'morador' | 'porteiro' | 'admin';
  building_id?: string;
  apartment_id?: string;
}

export class TokenStorage {
  // Variável estática para armazenar o último token salvo
  private static lastSavedToken: string | null = null;
  private static lastSaveTime: number = 0;
  private static readonly SAVE_DEBOUNCE_MS = 1000; // 1 segundo de debounce

  /**
   * Salva o JWT token no AsyncStorage
   */
  static async saveToken(token: string, expiresIn?: number): Promise<void> {
    try {
      // Verifica se é o mesmo token que foi salvo recentemente
      if (this.lastSavedToken === token) {
        return; // Evita salvar o mesmo token múltiplas vezes
      }

      // Implementa debounce para evitar múltiplas gravações rápidas
      const now = Date.now();
      if (now - this.lastSaveTime < this.SAVE_DEBOUNCE_MS) {
        return;
      }

      const promises = [AsyncStorage.setItem(TOKEN_KEY, token)];

      // Se fornecido tempo de expiração, calcula e salva a data de expiração
      if (expiresIn) {
        const expiryTime = Date.now() + (expiresIn * 1000);
        promises.push(AsyncStorage.setItem(EXPIRY_KEY, expiryTime.toString()));
      }

      await Promise.all(promises);
      
      // Atualiza o controle de token salvo
      this.lastSavedToken = token;
      this.lastSaveTime = now;
      
    } catch (error) {
      console.error('[TokenStorage] Erro ao salvar token:', error);
      throw error;
    }
  }

  /**
   * Salva os dados do usuário no AsyncStorage
   */
  static async saveUserData(userData: any): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
    } catch (error) {
      console.error('[TokenStorage] Erro ao salvar dados do usuário:', error);
      throw error;
    }
  }

  /**
   * Recupera o JWT token do AsyncStorage
   */
  static async getToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      return token;
    } catch (error) {
      console.error('[TokenStorage] Erro ao recuperar token:', error);
      return null;
    }
  }

  /**
   * Recupera os dados do usuário do AsyncStorage
   */
  static async getUserData(): Promise<any | null> {
    try {
      const userData = await AsyncStorage.getItem(USER_DATA_KEY);
      const parsedData = userData ? JSON.parse(userData) : null;
      return parsedData;
    } catch (error) {
      console.error('[TokenStorage] Erro ao recuperar dados do usuário:', error);
      return null;
    }
  }

  /**
   * Verifica se o token expirou
   */
  static async isTokenExpired(): Promise<boolean> {
    try {
      const expiryTime = await AsyncStorage.getItem(EXPIRY_KEY);
      
      if (!expiryTime) {
        // Se não há tempo de expiração definido, considera como não expirado
        return false;
      }

      const expiry = parseInt(expiryTime, 10);
      const now = Date.now();
      
      return now >= expiry;
    } catch (error) {
      console.error('[TokenStorage] Erro ao verificar expiração do token:', error);
      return true; // Em caso de erro, considera como expirado por segurança
    }
  }

  /**
   * Verifica se o token é válido (não expirado)
   */
  static isTokenValid(token: string): boolean {
    if (!token) return false;
    
    try {
      // Decodificar o JWT para verificar expiração
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      
      return payload.exp > now;
    } catch (error) {
      console.error('[TokenStorage] Erro ao validar token:', error);
      return false;
    }
  }

  /**
   * Verifica se existe um token válido salvo
   */
  static async hasValidToken(): Promise<boolean> {
    try {
      const token = await this.getToken();
      return token !== null;
    } catch (error) {
      console.error('[TokenStorage] Erro ao verificar token válido:', error);
      return false;
    }
  }

  /**
   * Remove o token do AsyncStorage
   */
  static async clearToken(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, EXPIRY_KEY]);
      // Limpa também o controle de token salvo
      this.lastSavedToken = null;
      this.lastSaveTime = 0;
    } catch (error) {
      console.error('[TokenStorage] Erro ao remover token:', error);
      throw error;
    }
  }

  /**
   * Remove todos os dados salvos
   */
  static async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, EXPIRY_KEY, USER_DATA_KEY]);
      // Limpa também o controle de token salvo
      this.lastSavedToken = null;
      this.lastSaveTime = 0;
    } catch (error) {
      console.error('[TokenStorage] Erro ao remover todos os dados:', error);
      throw error;
    }
  }

  /**
   * Atualiza apenas os dados do usuário
   */
  static async updateUserData(userData: any): Promise<void> {
    try {
      const currentData = await this.getUserData();
      const updatedData = { ...currentData, ...userData };
      await this.saveUserData(updatedData);
    } catch (error) {
      console.error('[TokenStorage] Erro ao atualizar dados do usuário:', error);
      throw error;
    }
  }

  /**
   * Obtém informações sobre o estado do armazenamento (útil para debug)
   */
  static async getStorageInfo(): Promise<{
    hasToken: boolean;
    hasUserData: boolean;
    isExpired: boolean;
    userData?: StoredUserData;
  }> {
    try {
      const [token, userData, isExpired] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        this.getUserData(),
        this.isTokenExpired()
      ]);

      return {
        hasToken: !!token,
        hasUserData: !!userData,
        isExpired,
        userData: userData || undefined
      };
    } catch (error) {
      console.error('[TokenStorage] Erro ao obter informações do armazenamento:', error);
      return {
        hasToken: false,
        hasUserData: false,
        isExpired: true
      };
    }
  }
}

export default TokenStorage;