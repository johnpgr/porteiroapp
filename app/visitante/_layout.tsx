import { Stack } from 'expo-router';

export default function VisitanteLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="register" />
      <Stack.Screen name="status" />
      <Stack.Screen name="help" />
    </Stack>
  );
}