import { Stack } from 'expo-router';
import { PlatformAuthProvider } from '../../context/PlatformAuthContext';

export default function PlatformLayout() {
  return (
    <PlatformAuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="dashboard" />
      </Stack>
    </PlatformAuthProvider>
  );
}
