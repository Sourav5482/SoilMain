export const API_BASE_URL = "https://backendsoil.onrender.com/api";

export const BLE_CONFIG = {
  deviceNameIncludes: "ESP32",
  serviceUUID: "4fafc201-1fb5-459e-8fcc-c5c9c331914b",
  characteristicUUID: "beb5483e-36e1-4688-b7f5-ea07361b26a8"
};

export const SOIL_TYPES = ["Clay", "Sandy", "Loamy", "Silty"];

export const OFFLINE_SYNC_CONFIG = {
  storageKey: "soil-monitoring-offline-queue-v1",
  queueDirectory: "soil-offline-queue",
  maxQueueItems: 100,
  retryBaseDelayMs: 5000,
  retryMaxDelayMs: 5 * 60 * 1000,
  retryJitterMs: 2000
};
