export interface CPFValidationResult {
  isValid: boolean;
  error?: string;
  formatted?: string;
}

export class CPFValidationService {
  /**
   * Valida CPF completo com todas as verificações
   */
  static validate(cpf: string): CPFValidationResult {
    try {
      // Remove caracteres não numéricos
      const cleanCPF = this.clean(cpf);

      // Verifica se tem 11 dígitos
      if (cleanCPF.length !== 11) {
        return {
          isValid: false,
          error: 'CPF deve conter 11 dígitos'
        };
      }

      // Verifica se todos os dígitos são iguais
      if (/^(\d)\1{10}$/.test(cleanCPF)) {
        return {
          isValid: false,
          error: 'CPF não pode ter todos os dígitos iguais'
        };
      }

      // Validação dos dígitos verificadores
      if (!this.validateDigits(cleanCPF)) {
        return {
          isValid: false,
          error: 'CPF inválido'
        };
      }

      return {
        isValid: true,
        formatted: this.format(cleanCPF)
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Erro na validação do CPF'
      };
    }
  }

  /**
   * Valida apenas se é um CPF válido (boolean)
   */
  static isValid(cpf: string): boolean {
    return this.validate(cpf).isValid;
  }

  /**
   * Remove formatação do CPF
   */
  static clean(cpf: string): string {
    return cpf.replace(/[^\d]/g, '');
  }

  /**
   * Formata CPF para exibição (xxx.xxx.xxx-xx)
   */
  static format(cpf: string): string {
    const cleanCPF = this.clean(cpf);
    if (cleanCPF.length !== 11) {
      return cpf; // Retorna original se não tiver 11 dígitos
    }
    return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /**
   * Formata CPF durante a digitação
   */
  static formatAsTyping(cpf: string): string {
    const cleanCPF = this.clean(cpf);
    
    if (cleanCPF.length <= 3) {
      return cleanCPF;
    } else if (cleanCPF.length <= 6) {
      return cleanCPF.replace(/(\d{3})(\d+)/, '$1.$2');
    } else if (cleanCPF.length <= 9) {
      return cleanCPF.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
    } else {
      return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4');
    }
  }

  /**
   * Valida os dígitos verificadores do CPF
   */
  private static validateDigits(cpf: string): boolean {
    // Validação do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;

    // Validação do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(10))) return false;

    return true;
  }

  /**
   * Gera um CPF válido para testes (apenas para desenvolvimento)
   */
  static generateValidCPF(): string {
    // Gera os 9 primeiros dígitos
    const digits = [];
    for (let i = 0; i < 9; i++) {
      digits.push(Math.floor(Math.random() * 10));
    }

    // Calcula o primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += digits[i] * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    digits.push(remainder);

    // Calcula o segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += digits[i] * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    digits.push(remainder);

    return digits.join('');
  }

  /**
   * Mascara CPF para exibição segura (xxx.xxx.xxx-xx -> xxx.xxx.***-**)
   */
  static mask(cpf: string): string {
    const formatted = this.format(cpf);
    if (formatted.length === 14) {
      return formatted.substring(0, 7) + '***-**';
    }
    return cpf; // Retorna original se não conseguir formatar
  }
}