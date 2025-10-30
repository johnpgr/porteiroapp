import { useCallback, useMemo, useState } from 'react';
import type {
  PorteiroResidentProfile,
  PorteiroVehicleProfile,
} from '~/services/porteiro/visitorSearch.service';
import { searchResidentByCPF, searchVehicleByPlate } from '~/services/porteiro/visitorSearch.service';

export type PorteiroSearchType = 'cpf' | 'placa';

export interface UseVisitorSearchResult {
  searchType: PorteiroSearchType;
  setSearchType: (type: PorteiroSearchType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchError: string | null;
  isSearching: boolean;
  profileResult: PorteiroResidentProfile | null;
  vehicleResult: PorteiroVehicleProfile | null;
  handleInputChange: (value: string) => void;
  performSearch: () => Promise<void>;
  resetResults: () => void;
}

const CPF_REGEX = /^\d{11}$/;
const PLATE_REGEX = /^[A-Za-z]{3}\d[A-Za-z]\d{2}$/; // Mercosul
const OLD_PLATE_REGEX = /^[A-Za-z]{3}\d{4}$/;

export const formatCPFValue = (cpf: string) => {
  const cleanCPF = cpf.replace(/[^0-9]/g, '');
  if (cleanCPF.length <= 3) return cleanCPF;
  if (cleanCPF.length <= 6) return `${cleanCPF.slice(0, 3)}.${cleanCPF.slice(3)}`;
  if (cleanCPF.length <= 9) {
    return `${cleanCPF.slice(0, 3)}.${cleanCPF.slice(3, 6)}.${cleanCPF.slice(6)}`;
  }
  return `${cleanCPF.slice(0, 3)}.${cleanCPF.slice(3, 6)}.${cleanCPF.slice(6, 9)}-${cleanCPF.slice(
    9,
    11
  )}`;
};

export const formatPlateValue = (plate: string) => {
  const cleanPlate = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleanPlate.length <= 3) {
    return cleanPlate;
  }
  if (cleanPlate.length === 7) {
    return `${cleanPlate.slice(0, 3)}-${cleanPlate.slice(3)}`;
  }
  return `${cleanPlate.slice(0, 3)}-${cleanPlate.slice(3)}`;
};

const isValidCPF = (cpf: string) => {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (!CPF_REGEX.test(cleanCPF)) {
    return false;
  }

  let sum = 0;
  let remainder;

  if (cleanCPF === '00000000000') {
    return false;
  }

  for (let i = 1; i <= 9; i += 1) {
    sum = sum + parseInt(cleanCPF.substring(i - 1, i), 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;

  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(cleanCPF.substring(9, 10), 10)) {
    return false;
  }

  sum = 0;
  for (let i = 1; i <= 10; i += 1) {
    sum = sum + parseInt(cleanCPF.substring(i - 1, i), 10) * (12 - i);
  }
  remainder = (sum * 10) % 11;

  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(cleanCPF.substring(10, 11), 10)) {
    return false;
  }
  return true;
};

const isValidPlate = (plate: string) => {
  const cleanPlate = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleanPlate.length !== 7) {
    return false;
  }
  return OLD_PLATE_REGEX.test(cleanPlate) || PLATE_REGEX.test(cleanPlate);
};

export function useVisitorSearch(): UseVisitorSearchResult {
  const [searchType, setSearchType] = useState<PorteiroSearchType>('cpf');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [profileResult, setProfileResult] = useState<PorteiroResidentProfile | null>(null);
  const [vehicleResult, setVehicleResult] = useState<PorteiroVehicleProfile | null>(null);

  const validators = useMemo(
    () => ({
      cpf: {
        isValid: isValidCPF,
        errorMessage: 'CPF inválido. Verifique se possui 11 dígitos e é um CPF válido.',
      },
      placa: {
        isValid: isValidPlate,
        errorMessage: 'Placa inválida. Use formato ABC1234 (antigo) ou ABC1D23 (Mercosul).',
      },
    }),
    []
  );

  const errorMessages = useMemo(
    () => ({
      cpf: 'CPF não encontrado no sistema',
      placa: 'Placa não encontrada no sistema',
    }),
    []
  );

  const handleInputChange = useCallback(
    (value: string) => {
      const formatter = searchType === 'cpf' ? formatCPFValue : formatPlateValue;
      setSearchQuery(formatter(value));
      setSearchError(null);
    },
    [searchType]
  );

  const resetResults = useCallback(() => {
    setProfileResult(null);
    setVehicleResult(null);
    setSearchError(null);
  }, []);

  const performSearch = useCallback(async () => {
    const query = searchQuery.trim();

    if (!query) {
      setSearchError(
        `Digite ${searchType === 'cpf' ? 'um CPF' : 'uma placa'} para consultar`
      );
      return;
    }

    const validator = validators[searchType];
    if (!validator.isValid(query)) {
      setSearchError(validator.errorMessage);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    resetResults();

    try {
      if (searchType === 'cpf') {
        const result = await searchResidentByCPF(query);
        if (result) {
          setProfileResult(result);
        } else {
          setSearchError(errorMessages.cpf);
        }
      } else {
        const result = await searchVehicleByPlate(query);
        if (result) {
          setVehicleResult(result);
        } else {
          setSearchError(errorMessages.placa);
        }
      }
    } catch (error: any) {
      if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
        setSearchError('Erro de conexão. Verifique sua internet e tente novamente.');
      } else {
        setSearchError(
          `Erro ao consultar ${searchType === 'cpf' ? 'CPF' : 'placa'}. Tente novamente.`
        );
      }
    } finally {
      setIsSearching(false);
    }
  }, [errorMessages, resetResults, searchQuery, searchType, validators]);

  return {
    searchType,
    setSearchType,
    searchQuery,
    setSearchQuery,
    searchError,
    isSearching,
    profileResult,
    vehicleResult,
    handleInputChange,
    performSearch,
    resetResults,
  };
}
