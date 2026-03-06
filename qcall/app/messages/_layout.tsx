import { Stack } from 'expo-router';

export default function MessagesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      
      <Stack.Screen name="chat" />
      <Stack.Screen name="compose" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
    </Stack>
  );
}