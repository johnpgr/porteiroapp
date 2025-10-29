import { Stack } from 'expo-router';

export default function VisitanteLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="register" />
      <Stack.Screen name="help" />
      <Stack.Screen name="emergency" />
    </Stack>
  );
}
