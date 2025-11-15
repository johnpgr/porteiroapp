// Setup Android notification channel for CallKeep foreground service
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

if (Platform.OS === 'android') {
  // Create notification channel for CallKeep foreground service
  // Must happen at app load (before background task may fire)
  Notifications.setNotificationChannelAsync('com.porteiroapp.callkeep', {
    name: 'Incoming Call Service',
    importance: Notifications.AndroidImportance.HIGH,
    sound: null, // CallKeep handles sound
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2196F3',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  }).catch(err => {
    console.error('[index.js] Failed to create CallKeep notification channel:', err);
  });
}

// Ensure Expo background notification task is defined at bundle load
import './services/backgroundNotificationTask';
// Early call stack init (captures CallKeep events pre-auth)
import './services/calling/earlyInit';

// Boot the app via Expo Router
import 'expo-router/entry';
