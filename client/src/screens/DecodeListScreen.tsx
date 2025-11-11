import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Clipboard } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTaskQueue } from '../queue/TaskQueueProvider';
import { TaskCard } from '../components/TaskCard';

export default function DecodeListScreen() {
  const { state, startAll, pauseAll, clearCompleted, retry, cancel, dispatch, enqueueDecode } = useTaskQueue();
  const [selecting, setSelecting] = useState(false);

  // Filter decode tasks only
  const decodeTasks = state.tasks.filter(t => t.type === 'DECODE');

  const handleSelectImages = async () => {
    if (selecting) return;
    
    setSelecting(true);
    try {
      // Request ImagePicker permissions
      const { status: imagePickerStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (imagePickerStatus !== 'granted') {
        Alert.alert('权限被拒绝', '需要相册权限以选择图片');
        return;
      }

      // Pick images (multiple selection if supported)
      // Use MediaType.Images if available, otherwise fallback to string
      const mediaType = ImagePicker.MediaType?.Images || 'images';
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        // ImagePicker already provides all the metadata we need
        const files = result.assets.map((asset, index) => ({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}_${index}.jpg`,
          size: asset.fileSize || 0,
          w: asset.width,
          h: asset.height,
        }));
        
        enqueueDecode(files);
        Alert.alert('成功', `已添加 ${files.length} 张图片到队列`);
      }
    } catch (error) {
      Alert.alert('错误', '选择图片失败，请重试');
      console.error('Image picker error:', error);
    } finally {
      setSelecting(false);
    }
  };

  const handleCopy = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('已复制', `Short ID: ${text}`);
  };

  const handleStart = (id: string) => {
    dispatch({ type: 'UPDATE', id, patch: { status: 'QUEUED' } });
  };

  const handleDelete = (id: string) => {
    dispatch({ type: 'REMOVE', id });
  };

  return (
    <View style={styles.container}>
      {/* Select Images Button */}
      <TouchableOpacity
        style={[styles.selectButton, selecting && styles.selectButtonDisabled]}
        onPress={handleSelectImages}
        disabled={selecting}
      >
        <Text style={styles.selectButtonText}>
          {selecting ? '选择中...' : '选择图片'}
        </Text>
      </TouchableOpacity>

      {/* Toolbar */}
      {decodeTasks.length > 0 && (
        <Toolbar
          onStartAll={startAll}
          onPauseAll={pauseAll}
          onClear={clearCompleted}
        />
      )}

      {/* Task List */}
      {decodeTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>暂无任务</Text>
          <Text style={styles.emptySubtext}>点击上方"选择图片"按钮添加图片</Text>
        </View>
      ) : (
        <FlatList
          data={decodeTasks}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onStart={handleStart}
              onRetry={retry}
              onCancel={cancel}
              onDelete={handleDelete}
              onCopy={handleCopy}
              onDetails={(id) => {
                const task = decodeTasks.find(t => t.id === id);
                if (task) {
                  Alert.alert(
                    '任务详情',
                    `状态: ${task.status}\n文件名: ${task.fileName || '未知'}\n大小: ${task.fileSize ? (task.fileSize / 1024).toFixed(1) + 'KB' : '未知'}\n分辨率: ${task.width}x${task.height || '未知'}`,
                  );
                }
              }}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

function Toolbar({
  onStartAll,
  onPauseAll,
  onClear,
}: {
  onStartAll: () => void;
  onPauseAll: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.toolbar}>
      <Btn title="开始全部" onPress={onStartAll} />
      <Btn title="暂停全部" onPress={onPauseAll} />
      <Btn title="清理已完成" onPress={onClear} />
    </View>
  );
}

function Btn({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.toolbarButton}>
      <Text style={styles.toolbarButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  selectButton: {
    backgroundColor: '#22c55e',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonDisabled: {
    opacity: 0.6,
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toolbar: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  toolbarButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  toolbarButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});

