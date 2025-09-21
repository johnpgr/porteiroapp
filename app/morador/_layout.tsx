import { Stack } from 'expo-router';

export default function MoradorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="authorize" />
      <Stack.Screen name="token-authorize" />
      <Stack.Screen name="preregister" />
      <Stack.Screen name="logs" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="emergency" />
      <Stack.Screen name="avisos" />
      <Stack.Screen name="visitantes/novo" />
      <Stack.Screen name="visitantes/nome" />
      <Stack.Screen name="visitantes/cpf" />
      <Stack.Screen name="visitantes/foto" />
      <Stack.Screen name="visitantes/periodo" />
      <Stack.Screen name="visitantes/observacoes" />
      <Stack.Screen name="visitantes/confirmacao" />
      <Stack.Screen name="cadastro/novo" />
      <Stack.Screen name="cadastro/relacionamento" />
      <Stack.Screen name="cadastro/telefone" />
      <Stack.Screen name="cadastro/placa" />
      <Stack.Screen name="cadastro/acesso" />
      <Stack.Screen name="cadastro/foto" />
      <Stack.Screen name="cadastro/dias" />
      <Stack.Screen name="cadastro/horarios" />
      <Stack.Screen name="testes" />
    </Stack>
  );
}
