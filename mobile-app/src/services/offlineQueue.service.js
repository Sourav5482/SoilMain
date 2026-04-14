import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { OFFLINE_SYNC_CONFIG } from "../constants/config";

const OFFLINE_QUEUE_STORAGE_KEY = OFFLINE_SYNC_CONFIG.storageKey;
const QUEUE_DIRECTORY_URI = `${FileSystem.documentDirectory}${OFFLINE_SYNC_CONFIG.queueDirectory}/`;

const parseQueue = (rawValue) => {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};

const getExtensionFromImage = (image, index) => {
  const uriWithoutQuery = String(image?.uri || "").split("?")[0];
  const extMatch = uriWithoutQuery.match(/\.([a-zA-Z0-9]+)$/);
  if (extMatch?.[1]) {
    return extMatch[1].toLowerCase();
  }

  const mimeExt = String(image?.type || "").split("/")[1];
  if (mimeExt) {
    return mimeExt.toLowerCase();
  }

  return index % 2 === 0 ? "jpg" : "jpeg";
};

const createQueueId = (recordKey) => {
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `${recordKey}-${Date.now()}-${randomSuffix}`;
};

const ensureQueueDirectory = async () => {
  const directoryInfo = await FileSystem.getInfoAsync(QUEUE_DIRECTORY_URI);

  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(QUEUE_DIRECTORY_URI, { intermediates: true });
  }
};

export const cleanupStagedImages = async (stagedImages = []) => {
  for (const image of stagedImages) {
    if (!image?.uri) {
      continue;
    }

    try {
      await FileSystem.deleteAsync(image.uri, { idempotent: true });
    } catch (_error) {
      // Ignore cleanup errors to avoid blocking queue state updates.
    }
  }
};

export const getQueuedSubmissions = async () => {
  const rawValue = await AsyncStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
  return parseQueue(rawValue);
};

export const saveQueuedSubmissions = async (queueItems) => {
  await AsyncStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queueItems));
};

export const getPendingSubmissionCount = async () => {
  const queue = await getQueuedSubmissions();
  return queue.length;
};

export const getQueueStatusSummary = async () => {
  const queue = await getQueuedSubmissions();
  const pendingCount = queue.length;

  const latestErrorItem = queue
    .filter((item) => item?.lastError)
    .sort((a, b) => Number(b?.nextRetryAt || b?.createdAt || 0) - Number(a?.nextRetryAt || a?.createdAt || 0))[0];

  const nextRetryCandidates = queue
    .map((item) => Number(item?.nextRetryAt || 0))
    .filter((value) => Number.isFinite(value) && value > Date.now())
    .sort((a, b) => a - b);

  const nextRetryAt = nextRetryCandidates.length ? nextRetryCandidates[0] : null;

  return {
    pendingCount,
    lastSyncError: latestErrorItem?.lastError || null,
    nextRetryAt
  };
};

const stageImagesForQueue = async (queueId, images = []) => {
  if (!Array.isArray(images) || !images.length) {
    return [];
  }

  await ensureQueueDirectory();

  const stagedImages = [];

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];

    if (!image?.uri) {
      continue;
    }

    const extension = getExtensionFromImage(image, index);
    const fileName = `${queueId}-${index}.${extension}`;
    const destinationUri = `${QUEUE_DIRECTORY_URI}${fileName}`;

    await FileSystem.copyAsync({
      from: image.uri,
      to: destinationUri
    });

    stagedImages.push({
      uri: destinationUri,
      fileName: image.fileName || fileName,
      type: image.type || `image/${extension === "jpg" ? "jpeg" : extension}`
    });
  }

  return stagedImages;
};

export const enqueueSubmission = async ({ payload, images = [] }) => {
  if (!payload?.recordKey) {
    throw new Error("recordKey is required to enqueue submission");
  }

  const queueId = createQueueId(payload.recordKey);
  const stagedImages = await stageImagesForQueue(queueId, images);

  const queueItem = {
    id: queueId,
    createdAt: Date.now(),
    retryCount: 0,
    nextRetryAt: 0,
    status: "pending",
    lastError: null,
    payload,
    stagedImages,
    uploadedImageUrls: []
  };

  const queue = await getQueuedSubmissions();
  queue.push(queueItem);

  while (queue.length > OFFLINE_SYNC_CONFIG.maxQueueItems) {
    const oldestItem = queue.shift();
    await cleanupStagedImages(oldestItem?.stagedImages || []);
  }

  await saveQueuedSubmissions(queue);
  return queueItem;
};

export const updateQueueItem = async (id, updates) => {
  const queue = await getQueuedSubmissions();
  const updatedQueue = queue.map((item) => {
    if (item.id !== id) {
      return item;
    }

    return {
      ...item,
      ...updates
    };
  });

  await saveQueuedSubmissions(updatedQueue);
  return updatedQueue.find((item) => item.id === id) || null;
};

export const removeQueueItem = async (id) => {
  const queue = await getQueuedSubmissions();
  const queueItem = queue.find((item) => item.id === id) || null;
  const nextQueue = queue.filter((item) => item.id !== id);

  await saveQueuedSubmissions(nextQueue);
  return queueItem;
};
