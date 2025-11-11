import 'react-native-get-random-values';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { TaskQueueProvider } from './src/queue/TaskQueueProvider';
import { isFirstLaunch, getApiBaseUrl } from './src/utils/storage';
import { ConnectionStatus } from './src/components/ConnectionStatus';
import LoginScreen from './src/screens/LoginScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import DecodeListScreen from './src/screens/DecodeListScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import type { ApiConfig } from './src/queue/TaskTypes';
import { DeviceEventEmitter } from 'react-native';

const Tab = createBottomTabNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [apiConfig, setApiConfig] = useState<ApiConfig>({ baseURL: 'http://47.101.142.85:6100', timeoutMs: 30000 });

  useEffect(() => {
    checkLoginStatus();
    // load API base URL
    (async () => {
      const base = await getApiBaseUrl();
      setApiConfig({ baseURL: base, timeoutMs: 30000 });
    })();

    // listen to runtime changes from Settings
    const sub = DeviceEventEmitter.addListener('apiBaseUrlChanged', (url: string) => {
      if (url && typeof url === 'string') {
        setApiConfig({ baseURL: url, timeoutMs: 30000 });
      }
    });
    return () => {
      sub.remove();
    };
  }, []);

  const checkLoginStatus = async () => {
    try {
      const firstLaunch = await isFirstLaunch();
      setIsLoggedIn(!firstLaunch);
    } catch (error) {
      console.error('Error checking login status:', error);
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginComplete = () => {
    setIsLoggedIn(true);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!isLoggedIn) {
    return <LoginScreen onLoginComplete={handleLoginComplete} />;
  }

  return (
    <TaskQueueProvider api={apiConfig}>
      <NavigationContainer>
        <StatusBar style="auto" />
        <ConnectionStatus api={apiConfig} />
        <Tab.Navigator
          screenOptions={{
            tabBarActiveTintColor: '#3b82f6',
            tabBarInactiveTintColor: '#6b7280',
            headerStyle: {
              backgroundColor: '#fff',
            },
            headerTintColor: '#1f2937',
            headerTitleStyle: {
              fontWeight: '600',
            },
          }}
        >
          <Tab.Screen
            name="拍照"
            component={CaptureScreen}
            options={{
              tabBarIcon: ({ color }) => (
                <TabIcon name="camera" color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="选择"
            component={DecodeListScreen}
            options={{
              tabBarIcon: ({ color }) => (
                <TabIcon name="image" color={color} />
              ),
              headerTitle: '选择图片解码',
            }}
          />
          <Tab.Screen
            name="设置"
            component={SettingsScreen}
            options={{
              tabBarIcon: ({ color }) => (
                <TabIcon name="settings" color={color} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </TaskQueueProvider>
  );
}

// Simple icon component (you can replace with react-native-vector-icons later)
function TabIcon({ name, color }: { name: string; color: string }) {
  const icons: Record<string, string> = {
    camera: '📷',
    image: '🖼️',
    settings: '⚙️',
  };
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24 }}>{icons[name] || '•'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

