import React, { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

export default function MoradorIndexRedirect() {
  useEffect(() => {
    router.replace('/morador/visitantes' as any);
  }, []);

  return <View />;
}
