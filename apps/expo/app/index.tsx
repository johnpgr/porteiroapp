import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

export default function Home() {
  const { user, loading, initialized } = useAuth();

  // Wait for auth to initialize - splash screen will remain visible
  if (!initialized || loading) {
    return null;
  }

  // Redirect authenticated users to their respective app sections
  if (user) {
    switch (user.user_type) {
      case 'admin':
        return <Redirect href="/admin" />;
      case 'porteiro':
        return <Redirect href="/porteiro" />;
      case 'morador':
        return <Redirect href="/morador" />;
      default:
        break;
    }
  }

  // If not authenticated, redirect to login
  return <Redirect href="/login" />;
}
