import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useCameraPermissions, CameraView } from 'expo-camera';
import { useTaskQueue } from '../queue/TaskQueueProvider';
import { getShortId } from '../utils/storage';

type CameraFacing = 'back' | 'front';

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraFacing>('back');
  const [shortId, setShortId] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const cameraRef = useRef<CameraView>(null);
  const { enqueueEncode, state } = useTaskQueue();

  useEffect(() => {
    loadShortId();
  }, []);

  // Monitor encode task completion for notifications
  useEffect(() => {
    const encodeTasks = state.tasks.filter(t => t.type === 'ENCODE');
    encodeTasks.forEach(task => {
      if (task.status === 'SUCCESS' && !completedTaskIds.has(task.id)) {
        setCompletedTaskIds(prev => new Set(prev).add(task.id));
        Alert.alert('处理完成', '刚才拍的照片已加密并保存到相册');
      } else if (task.status === 'FAILED' && !completedTaskIds.has(task.id)) {
        setCompletedTaskIds(prev => new Set(prev).add(task.id));
        Alert.alert('处理失败', task.error || '加密失败，请重试');
      }
    });
  }, [state.tasks, completedTaskIds]);

  const loadShortId = async () => {
    const id = await getShortId();
    if (id) {
      setShortId(id);
    } else {
      Alert.alert('错误', '未找到Short ID，请重新登录');
    }
  };

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.text}>需要相机权限</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>授权</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const onCapture = async () => {
    if (!cameraRef.current || !shortId || isCapturing) return;
    
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: true,
      });
      
      if (photo?.uri) {
        enqueueEncode([{ uri: photo.uri }], shortId);
        // No alert here - task completion will be notified via useEffect
      }
    } catch (error) {
      Alert.alert('错误', '拍照失败，请重试');
      console.error('Capture error:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const toggleCameraType = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const pendingTasks = state.tasks.filter(t => t.status === 'PENDING' || t.status === 'QUEUED' || t.status === 'PROCESSING');
  const encodeTasks = pendingTasks.filter(t => t.type === 'ENCODE');

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Queue badge */}
        {encodeTasks.length > 0 && (
          <View style={styles.queueBadge}>
            <Text style={styles.queueBadgeText}>队列 {encodeTasks.length}</Text>
          </View>
        )}

        {/* Top controls */}
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.flipButton} onPress={toggleCameraType}>
            <Text style={styles.flipButtonText}>翻转</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomControls}>
          <TouchableOpacity
            style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
            onPress={onCapture}
            disabled={isCapturing || !shortId}
          >
            {isCapturing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingTop: 50,
  },
  flipButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  flipButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  bottomControls: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  queueBadge: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  queueBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

