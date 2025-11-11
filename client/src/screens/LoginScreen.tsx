import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { generateShortId, setUsername, setPassword, setShortId, setFirstLaunchComplete } from '../utils/storage';

interface LoginScreenProps {
  onLoginComplete: () => void;
}

export default function LoginScreen({ onLoginComplete }: LoginScreenProps) {
  const [username, setUsernameState] = useState('');
  const [password, setPasswordState] = useState('');
  const [confirmPassword, setConfirmPasswordState] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim()) {
      Alert.alert('错误', '请输入用户名');
      return;
    }
    if (!password.trim()) {
      Alert.alert('错误', '请输入密码');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('错误', '两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      // Generate Short ID
      const shortId = generateShortId();
      
      // Save to secure storage
      await setUsername(username.trim());
      await setPassword(password);
      await setShortId(shortId);
      await setFirstLaunchComplete();

      Alert.alert('注册成功', `您的Short ID: ${shortId}\n请妥善保管！`, [
        { text: '确定', onPress: onLoginComplete },
      ]);
    } catch (error) {
      Alert.alert('错误', '保存失败，请重试');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>欢迎使用 StegaCam</Text>
        <Text style={styles.subtitle}>首次使用，请设置用户名和密码</Text>

        <TextInput
          style={styles.input}
          placeholder="用户名"
          value={username}
          onChangeText={setUsernameState}
          autoCapitalize="none"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="密码"
          value={password}
          onChangeText={setPasswordState}
          secureTextEntry
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="确认密码"
          value={confirmPassword}
          onChangeText={setConfirmPasswordState}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>注册并开始使用</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

