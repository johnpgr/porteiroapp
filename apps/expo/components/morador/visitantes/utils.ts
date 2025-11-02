export const formatDate = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  const limitedNumbers = numbers.slice(0, 8);

  if (limitedNumbers.length === 0) {
    return '';
  }

  if (limitedNumbers.length <= 2) {
    return limitedNumbers;
  }

  if (limitedNumbers.length <= 4) {
    return `${limitedNumbers.slice(0, 2)}/${limitedNumbers.slice(2)}`;
  }

  return `${limitedNumbers.slice(0, 2)}/${limitedNumbers.slice(2, 4)}/${limitedNumbers.slice(
    4
  )}`;
};

export const formatTime = (value: string): string => {
  const numbers = value.replace(/\D/g, '');

  if (numbers.length <= 2) {
    return numbers;
  }

  return `${numbers.slice(0, 2)}:${numbers.slice(2, 4)}`;
};
