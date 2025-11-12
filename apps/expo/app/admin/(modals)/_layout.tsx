import { Stack } from 'expo-router';

export default function ModalLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'fullScreenModal',
        headerShown: false,
      }}
    />
  );
}
