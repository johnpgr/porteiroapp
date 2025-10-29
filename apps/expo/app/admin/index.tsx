import React, { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

export default function AdminIndexRedirect() {
  useEffect(() => {
    // Redirect into the Admin tabs (Usuarios tab) to ensure tabs are active
    router.replace('/admin/usuarios' as any);
  }, []);

  return <View />;
}
