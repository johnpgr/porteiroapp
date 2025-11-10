// Root entry: register background task early
import { AppRegistry } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { BACKGROUND_NOTIFICATION_TASK } from './services/backgroundNotificationTask';

// Ensure Expo background notification task is defined at bundle load
import './services/backgroundNotificationTask';

// Boot the app via Expo Router
import 'expo-router/entry';
