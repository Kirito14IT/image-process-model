// Draft API client (Expo compatible)
// NOTE: For upload progress in Expo managed, prefer expo-file-system UploadTask.

// Use legacy API for Expo SDK 54 compatibility
import * as FileSystem from 'expo-file-system/legacy';
import type { ApiConfig } from '../queue/TaskTypes';
import { uint8ArrayToBase64 } from '../utils/base64';

type ProgressCb = (p: number) => void;

export async function apiEncode(
  api: ApiConfig,
  params: { fileUri: string; fileName?: string; shortId: string; onUploadProgress?: ProgressCb }
): Promise<string> {
  const url = `${api.baseURL}/api/v1/encode`;

  // Create FormData for React Native
  const formData = new FormData();
  
  // In React Native, FormData accepts file objects with uri, type, and name
  formData.append('image', {
    uri: params.fileUri,
    type: 'image/jpeg',
    name: params.fileName || 'image.jpg',
  } as any);
  
  formData.append('message', params.shortId);

  // Use fetch for better binary response handling
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'image/png',
      // Don't set Content-Type, let fetch set it with boundary
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`encode http ${response.status}: ${errorText}`);
  }

  // For React Native, convert arrayBuffer to base64
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const base64 = uint8ArrayToBase64(bytes);
  
  const tmp = `${FileSystem.cacheDirectory}imgproc_${Date.now()}.png`;
  
  // Use legacy API which supports EncodingType.Base64
  await FileSystem.writeAsStringAsync(tmp, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  
  return tmp;
}

export async function apiDecode(
  api: ApiConfig,
  params: { fileUri: string; fileName?: string; onUploadProgress?: ProgressCb }
): Promise<{ success: boolean; data?: { message: string; model_used?: string }; error?: string }> {
  const url = `${api.baseURL}/api/v1/decode`;
  
  // Create FormData for React Native
  const formData = new FormData();
  formData.append('image', {
    uri: params.fileUri,
    type: 'image/jpeg',
    name: params.fileName || 'image.jpg',
  } as any);

  // Use fetch for better control
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json',
      // Don't set Content-Type, let fetch set it with boundary
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`decode http ${response.status}: ${errorText}`);
  }

  try {
    const json = await response.json();
    return json;
  } catch (error) {
    throw new Error(`decode invalid json: ${error}`);
  }
}
