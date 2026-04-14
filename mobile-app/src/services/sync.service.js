import { OFFLINE_SYNC_CONFIG } from "../constants/config";
import { saveSoilDataApi, uploadImagesApi } from "./api";
import {
  cleanupStagedImages,
  getPendingSubmissionCount,
  getQueuedSubmissions,
  removeQueueItem,
  updateQueueItem
} from "./offlineQueue.service";
import { isNetworkOnline, onNetworkReconnected } from "./network.service";

let isSyncing = false;
let retryTimer = null;
let disposeReconnectListener = null;

const clearRetryTimer = () => {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
};

const computeBackoffDelay = (retryCount) => {
  const exponentialDelay = Math.min(
    OFFLINE_SYNC_CONFIG.retryBaseDelayMs * 2 ** Math.min(retryCount, 8),
    OFFLINE_SYNC_CONFIG.retryMaxDelayMs
  );

  const jitter = Math.floor(Math.random() * OFFLINE_SYNC_CONFIG.retryJitterMs);
  return exponentialDelay + jitter;
};

const extractSyncErrorMessage = (error) => {
  const serverMessage =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.statusText;

  if (serverMessage) {
    return serverMessage;
  }

  return error?.message || "Sync failed";
};

const scheduleNextRetry = async () => {
  clearRetryTimer();

  const queue = await getQueuedSubmissions();
  if (!queue.length) {
    return;
  }

  const now = Date.now();
  const earliestNextRetryAt = queue.reduce((earliest, item) => {
    const candidate = Number(item?.nextRetryAt || 0);
    return candidate < earliest ? candidate : earliest;
  }, Number.MAX_SAFE_INTEGER);

  if (earliestNextRetryAt === Number.MAX_SAFE_INTEGER) {
    return;
  }

  const delay = Math.max(earliestNextRetryAt - now, 1000);

  retryTimer = setTimeout(() => {
    syncQueuedSubmissions({ reason: "scheduled-retry" }).catch(() => {});
  }, delay);
};

const syncQueueItem = async (queueItem) => {
  let uploadedImageUrls = Array.isArray(queueItem.uploadedImageUrls)
    ? [...queueItem.uploadedImageUrls]
    : [];

  if (!uploadedImageUrls.length && Array.isArray(queueItem.stagedImages) && queueItem.stagedImages.length) {
    uploadedImageUrls = await uploadImagesApi(queueItem.stagedImages);
    await updateQueueItem(queueItem.id, { uploadedImageUrls });
  }

  const payload = {
    ...queueItem.payload,
    images: uploadedImageUrls
  };

  await saveSoilDataApi(payload);

  const removedItem = await removeQueueItem(queueItem.id);
  await cleanupStagedImages(removedItem?.stagedImages || queueItem.stagedImages || []);
};

export const syncQueuedSubmissions = async ({ reason = "manual", force = false } = {}) => {
  if (isSyncing) {
    return {
      syncedCount: 0,
      pendingCount: await getPendingSubmissionCount(),
      reason,
      skipped: true
    };
  }

  const online = await isNetworkOnline();
  if (!online) {
    return {
      syncedCount: 0,
      pendingCount: await getPendingSubmissionCount(),
      reason,
      skipped: true
    };
  }

  isSyncing = true;
  clearRetryTimer();

  let syncedCount = 0;

  try {
    const queue = await getQueuedSubmissions();

    for (const queueItem of queue) {
      const now = Date.now();
      if (!force && Number(queueItem?.nextRetryAt || 0) > now) {
        continue;
      }

      try {
        await updateQueueItem(queueItem.id, {
          status: "syncing",
          lastError: null
        });

        await syncQueueItem(queueItem);
        syncedCount += 1;
      } catch (error) {
        const retryCount = Number(queueItem?.retryCount || 0) + 1;
        const nextRetryAt = Date.now() + computeBackoffDelay(retryCount);

        await updateQueueItem(queueItem.id, {
          status: "pending",
          retryCount,
          nextRetryAt,
          lastError: extractSyncErrorMessage(error)
        });
      }
    }
  } finally {
    isSyncing = false;
    await scheduleNextRetry();
  }

  return {
    syncedCount,
    pendingCount: await getPendingSubmissionCount(),
    reason,
    skipped: false
  };
};

export const initializeAutoSync = () => {
  if (disposeReconnectListener) {
    return () => {
      // Already initialized by app root.
    };
  }

  disposeReconnectListener = onNetworkReconnected(() => {
    syncQueuedSubmissions({ reason: "network-reconnected" }).catch(() => {});
  });

  return () => {
    if (disposeReconnectListener) {
      disposeReconnectListener();
      disposeReconnectListener = null;
    }

    clearRetryTimer();
  };
};
