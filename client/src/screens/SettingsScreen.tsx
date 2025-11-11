import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Clipboard,
  TextInput,
  DeviceEventEmitter,
} from 'react-native';
import { getUsername, getShortId, getModel, setModel, getApiBaseUrl, setApiBaseUrl } from '../utils/storage';

export default function SettingsScreen() {
  const [username, setUsernameState] = useState<string>('');
  const [shortId, setShortIdState] = useState<string>('');
  const [currentModel, setCurrentModelState] = useState<string>('stega_v1');
  const [serverUrl, setServerUrl] = useState<string>('http://47.101.142.85:6100');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const u = await getUsername();
    const id = await getShortId();
    const m = await getModel();
    const api = await getApiBaseUrl();
    setUsernameState(u || '');
    setShortIdState(id || '');
    setCurrentModelState(m || 'stega_v1');
    setServerUrl(api || 'http://47.101.142.85:6100');
  };

  const handleCopyShortId = () => {
    if (shortId) {
      Clipboard.setString(shortId);
      Alert.alert('已复制', `Short ID: ${shortId}`);
    }
  };

  const handleModelSelect = async (model: string) => {
    await setModel(model);
    setCurrentModelState(model);
    Alert.alert('已切换', `当前模型: ${model}`);
  };

  const normalizeUrl = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    // 允许用户仅输入 host:port
    return `http://${trimmed}`;
  };

  const handleConnect = async () => {
    const normalized = normalizeUrl(serverUrl);
    if (!normalized) {
      Alert.alert('无效地址', '请输入有效的服务器地址，例如 47.101.142.85:6100 或 http://47.101.142.85:6100');
      return;
    }
    try {
      setIsConnecting(true);
      // 先保存
      await setApiBaseUrl(normalized);
      // 简单联通性检测（可选）
      const pingUrl = `${normalized}/api/v1/ping`;
      let ok = false;
      try {
        const res = await fetch(pingUrl, { method: 'GET' });
        ok = res.ok;
      } catch {
        ok = false;
      }
      // 通知应用更新 API 配置
      DeviceEventEmitter.emit('apiBaseUrlChanged', normalized);

      if (ok) {
        Alert.alert('连接成功', `已连接到服务器：\n${normalized}`);
      } else {
        Alert.alert('已保存', `地址已更新为：\n${normalized}\n\n注意：未能确认联通性，请稍后在顶部连接状态查看。`);
      }
    } catch (e: any) {
      Alert.alert('保存失败', String(e?.message || e));
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>用户信息</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>用户名:</Text>
          <Text style={styles.value}>{username || '未设置'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Short ID:</Text>
          <View style={styles.shortIdRow}>
            <Text style={styles.value}>{shortId || '未生成'}</Text>
            {shortId && (
              <TouchableOpacity style={styles.copyButton} onPress={handleCopyShortId}>
                <Text style={styles.copyButtonText}>复制</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>模型选择</Text>
        <Text style={styles.sectionSubtitle}>当前模型: {currentModel}</Text>
        <TouchableOpacity
          style={[
            styles.modelOption,
            currentModel === 'stega_v1' && styles.modelOptionActive,
          ]}
          onPress={() => handleModelSelect('stega_v1')}
        >
          <Text
            style={[
              styles.modelOptionText,
              currentModel === 'stega_v1' && styles.modelOptionTextActive,
            ]}
          >
            Stega V1 (默认)
          </Text>
          {currentModel === 'stega_v1' && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.hint}>更多模型将在后续版本中添加</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>服务器设置</Text>
        <Text style={styles.sectionSubtitle}>请输入后端服务器地址（支持 host:port 或完整URL）</Text>
        <TextInput
          style={styles.input}
          placeholder="例如：47.101.142.85:6100 或 http://47.101.142.85:6100"
          value={serverUrl}
          onChangeText={setServerUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TouchableOpacity style={[styles.connectButton, isConnecting && styles.connectButtonDisabled]} onPress={handleConnect} disabled={isConnecting}>
          <Text style={styles.connectButtonText}>{isConnecting ? '正在连接...' : '连接并保存'}</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>默认：47.101.142.85:6100（FRP公网地址）</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  label: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: '#6b7280',
  },
  shortIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copyButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modelOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  modelOptionActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  modelOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  modelOptionTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#374151',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  connectButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  connectButtonDisabled: {
    opacity: 0.7,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

