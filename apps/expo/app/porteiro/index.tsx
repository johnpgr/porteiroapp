import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

export default function PorteiroIndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/porteiro/(tabs)' as any);
  }, [router]);

  return <View />;
}
