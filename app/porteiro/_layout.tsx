import { Stack } from 'expo-router';

export default function PorteiroLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="visitor" />
      <Stack.Screen name="delivery" />
      <Stack.Screen name="logs" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="emergency" />

    </Stack>
  );
}
