import React, { createContext, useContext, useMemo, useReducer, useEffect } from 'react';
import type { QueueState, QueueAction, Task, TaskStatus, ApiConfig } from './TaskTypes';
import { v4 as uuidv4 } from 'uuid';
import * as MediaLibrary from 'expo-media-library';
import { apiEncode, apiDecode } from '../api/client';

// NOTE: uuidv4() is used here to generate task IDs (internal queue identifiers).
// This is different from user "Short ID" (7-char alphanumeric) used for steganography encoding.

const initialState: QueueState = { tasks: [], runningTaskId: null, isRunning: true };

function reducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'ENQUEUE': {
      const items = Array.isArray(action.payload) ? action.payload : [action.payload];
      const next = items.map((t) => ({ ...t, status: 'QUEUED' as TaskStatus }));
      return { ...state, tasks: [...state.tasks, ...next] };
    }
    case 'REMOVE': {
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    }
    case 'UPDATE': {
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch, updatedAt: Date.now() } : t)),
      };
    }
    case 'SET_RUNNING':
      return { ...state, isRunning: action.running };
    case 'SET_RUNNING_TASK':
      return { ...state, runningTaskId: action.id };
    case 'CLEAR_COMPLETED':
      return { ...state, tasks: state.tasks.filter((t) => !['SUCCESS', 'FAILED'].includes(t.status)) };
    default:
      return state;
  }
}

type Ctx = {
  state: QueueState;
  dispatch: React.Dispatch<QueueAction>;
  enqueueEncode: (files: { uri: string; name?: string; size?: number; w?: number; h?: number }[], shortId: string) => void;
  enqueueDecode: (files: { uri: string; name?: string; size?: number; w?: number; h?: number }[]) => void;
  startAll: () => void;
  pauseAll: () => void;
  clearCompleted: () => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
};

const QueueContext = createContext<Ctx | undefined>(undefined);

export function TaskQueueProvider({ children, api }: { children: React.ReactNode; api: ApiConfig }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Pump: single-flight execution
  useEffect(() => {
    if (!state.isRunning || state.runningTaskId) return;
    const next = state.tasks.find((t) => t.status === 'QUEUED' || t.status === 'PENDING');
    if (!next) return;
    runTask(next).catch(() => void 0);
  }, [state.isRunning, state.runningTaskId, state.tasks]);

  const runTask = async (task: Task) => {
    dispatch({ type: 'SET_RUNNING_TASK', id: task.id });
    dispatch({ type: 'UPDATE', id: task.id, patch: { status: 'PROCESSING', metrics: { ...task.metrics, startedAt: Date.now() } } });

    try {
      if (task.type === 'ENCODE') {
        const pngUri = await apiEncode(api, {
          fileUri: task.fileUri,
          fileName: task.fileName,
          shortId: task.message!,
          onUploadProgress: (p) => dispatch({ type: 'UPDATE', id: task.id, patch: { metrics: { ...task.metrics, uploadProgress: p } } }),
        });
        // Save to gallery (PNG-only)
        const asset = await MediaLibrary.saveToLibraryAsync(pngUri);
        dispatch({
          type: 'UPDATE',
          id: task.id,
          patch: {
            status: 'SUCCESS',
            result: { outputUri: pngUri, savedAssetId: asset as any, saved: true },
            metrics: { ...task.metrics, finishedAt: Date.now() },
          },
        });
      } else {
        const res = await apiDecode(api, {
          fileUri: task.fileUri,
          fileName: task.fileName,
          onUploadProgress: (p) => dispatch({ type: 'UPDATE', id: task.id, patch: { metrics: { ...task.metrics, uploadProgress: p } } }),
        });
        if (res?.success) {
          dispatch({
            type: 'UPDATE',
            id: task.id,
            patch: { status: 'SUCCESS', result: { shortId: res.data?.message, modelUsed: res.data?.model_used }, metrics: { ...task.metrics, finishedAt: Date.now() } },
          });
        } else {
          throw new Error(res?.error || 'decode failed');
        }
      }
    } catch (e: any) {
      dispatch({ type: 'UPDATE', id: task.id, patch: { status: 'FAILED', error: String(e?.message || e) } });
    } finally {
      dispatch({ type: 'SET_RUNNING_TASK', id: null });
    }
  };

  const actions = useMemo<Ctx>(() => ({
    state,
    dispatch,
    enqueueEncode: (files, shortId) => {
      if (!shortId || shortId.length !== 7) return; // Short ID length check
      const now = Date.now();
      const tasks: Task[] = files.map((f) => ({
        id: uuidv4(),
        type: 'ENCODE',
        source: 'gallery',
        fileUri: f.uri,
        fileName: f.name,
        fileSize: f.size,
        width: f.w,
        height: f.h,
        message: shortId,
        status: 'PENDING',
        metrics: { uploadProgress: 0, attempt: 0 },
        createdAt: now,
        updatedAt: now,
      }));
      dispatch({ type: 'ENQUEUE', payload: tasks });
    },
    enqueueDecode: (files) => {
      const now = Date.now();
      const tasks: Task[] = files.map((f) => ({
        id: uuidv4(),
        type: 'DECODE',
        source: 'gallery',
        fileUri: f.uri,
        fileName: f.name,
        fileSize: f.size,
        width: f.w,
        height: f.h,
        status: 'PENDING',
        metrics: { uploadProgress: 0, attempt: 0 },
        createdAt: now,
        updatedAt: now,
      }));
      dispatch({ type: 'ENQUEUE', payload: tasks });
    },
    startAll: () => dispatch({ type: 'SET_RUNNING', running: true }),
    pauseAll: () => dispatch({ type: 'SET_RUNNING', running: false }),
    clearCompleted: () => dispatch({ type: 'CLEAR_COMPLETED' }),
    cancel: (id: string) => dispatch({ type: 'REMOVE', id }),
    retry: (id: string) => dispatch({ type: 'UPDATE', id, patch: { status: 'QUEUED', error: undefined } }),
  }), [state]);

  return <QueueContext.Provider value={actions}>{children}</QueueContext.Provider>;
}

export function useTaskQueue() {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useTaskQueue must be used within TaskQueueProvider');
  return ctx;
}

