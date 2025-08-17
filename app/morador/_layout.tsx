import { Stack } from 'expo-router';

export default function MoradorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="authorize" />
      <Stack.Screen name="preregister" />
      <Stack.Screen name="logs" />
    </Stack>
  );
}
