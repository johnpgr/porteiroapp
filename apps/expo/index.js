// Ensure Expo background notification task is defined at bundle load
import './services/backgroundNotificationTask';
// Early call stack init (captures CallKeep events pre-auth)
import './services/calling/earlyInit';

// Boot the app via Expo Router
import 'expo-router/entry';
