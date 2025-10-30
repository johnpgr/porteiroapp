import React, { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

export default function AdminIndexRedirect() {
  useEffect(() => {
    // Redirect into the Admin tabs layout so the tab navigator initializes
    router.replace('/admin/(tabs)' as any);
  }, []);

  return <View />;
}
