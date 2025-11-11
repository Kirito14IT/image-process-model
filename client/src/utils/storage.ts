import * as SecureStore from 'expo-secure-store';

const KEYS = {
  USERNAME: 'stegacam_username',
  PASSWORD: 'stegacam_password',
  SHORT_ID: 'stegacam_short_id',
  MODEL: 'stegacam_model',
  IS_FIRST_LAUNCH: 'stegacam_first_launch',
  API_BASE_URL: 'stegacam_api_base_url',
};

export async function getUsername(): Promise<string | null> {
  return await SecureStore.getItemAsync(KEYS.USERNAME);
}

export async function setUsername(username: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.USERNAME, username);
}

export async function getPassword(): Promise<string | null> {
  return await SecureStore.getItemAsync(KEYS.PASSWORD);
}

export async function setPassword(password: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.PASSWORD, password);
}

export async function getShortId(): Promise<string | null> {
  return await SecureStore.getItemAsync(KEYS.SHORT_ID);
}

export async function setShortId(shortId: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.SHORT_ID, shortId);
}

export async function getModel(): Promise<string | null> {
  return await SecureStore.getItemAsync(KEYS.MODEL) || 'stega_v1';
}

export async function setModel(model: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.MODEL, model);
}

/**
 * API Base URL
 */
export async function getApiBaseUrl(): Promise<string> {
  const saved = await SecureStore.getItemAsync(KEYS.API_BASE_URL);
  return saved || 'http://47.101.142.85:6100';
}

export async function setApiBaseUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.API_BASE_URL, url);
}

export async function isFirstLaunch(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(KEYS.IS_FIRST_LAUNCH);
  return value !== 'false';
}

export async function setFirstLaunchComplete(): Promise<void> {
  await SecureStore.setItemAsync(KEYS.IS_FIRST_LAUNCH, 'false');
}

/**
 * Generate a random 7-character alphanumeric Short ID
 */
export function generateShortId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

