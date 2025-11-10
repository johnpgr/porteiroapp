import AsyncStorage from '@react-native-async-storage/async-storage';

const CALL_DATA_PREFIX = 'call_data_';
const CURRENT_CALL_KEY = 'current_call_id';

interface CallData {
  channelName: string;
  rtcToken: string;
  callerName: string;
  apartmentNumber?: string;
  from: string;
  callId: string;
}

export const MyCallDataManager = {
  async storeCallData(callId: string, data: CallData): Promise<void> {
    await AsyncStorage.setItem(CALL_DATA_PREFIX + callId, JSON.stringify(data));
  },

  async getCallData(callId: string): Promise<CallData | null> {
    const json = await AsyncStorage.getItem(CALL_DATA_PREFIX + callId);
    return json ? JSON.parse(json) : null;
  },

  async clearCallData(callId: string): Promise<void> {
    await AsyncStorage.removeItem(CALL_DATA_PREFIX + callId);
  },

  async setCurrentCallId(callId: string): Promise<void> {
    await AsyncStorage.setItem(CURRENT_CALL_KEY, callId);
  },

  async getCurrentCallId(): Promise<string | null> {
    return await AsyncStorage.getItem(CURRENT_CALL_KEY);
  },

  async clearCurrentCallId(): Promise<void> {
    await AsyncStorage.removeItem(CURRENT_CALL_KEY);
  },
};

