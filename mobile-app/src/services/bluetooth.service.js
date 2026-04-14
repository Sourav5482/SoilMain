import "react-native-url-polyfill/auto";
import { Buffer } from "buffer";
import { BleManager } from "react-native-ble-plx";

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeReading = (payload) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const temp = payload.temp ?? payload.temperature ?? payload.t;
  const humidity = payload.humidity ?? payload.hum ?? payload.h;
  const n = payload.n ?? payload.N;
  const p = payload.p ?? payload.P;
  const k = payload.k ?? payload.K;
  const lat = payload.lat ?? payload.latitude;
  const lng = payload.lng ?? payload.longitude;

  const normalized = {
    temp: toNumberOrNull(temp),
    humidity: toNumberOrNull(humidity),
    n: toNumberOrNull(n),
    p: toNumberOrNull(p),
    k: toNumberOrNull(k),
    lat: toNumberOrNull(lat),
    lng: toNumberOrNull(lng)
  };

  if (
    normalized.temp === null &&
    normalized.humidity === null &&
    normalized.n === null &&
    normalized.p === null &&
    normalized.k === null
  ) {
    return null;
  }

  return normalized;
};

const parseReadingRaw = (rawValue) => {
  const raw = String(rawValue || "").replace(/\u0000/g, "").trim();

  if (!raw) {
    return null;
  }

  // Preferred format: full JSON object.
  if (raw.startsWith("{") && raw.endsWith("}")) {
    return normalizeReading(JSON.parse(raw));
  }

  // If transport adds extra chars, parse the JSON object slice.
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = raw.slice(firstBrace, lastBrace + 1);
    return normalizeReading(JSON.parse(slice));
  }

  // Fallback for simple numeric payload: use same value across required fields.
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return {
      temp: numeric,
      humidity: numeric,
      n: numeric,
      p: numeric,
      k: numeric,
      lat: null,
      lng: null
    };
  }

  return null;
};

export class BluetoothSoilService {
  constructor() {
    this.manager = null;
    this.device = null;
    this.subscription = null;
    this.scanTimeout = null;
  }

  getManager() {
    if (!this.manager) {
      try {
        this.manager = new BleManager();
      } catch (_error) {
        throw new Error(
          "Bluetooth is unavailable in Expo Go. Use a development build (expo run:android / expo run:ios)."
        );
      }
    }

    return this.manager;
  }

  async scanForDevices({ nameIncludes, timeoutMs = 12000 }) {
    await this.ensurePoweredOn();

    const manager = this.getManager();
    const foundMap = new Map();

    return new Promise((resolve, reject) => {
      manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          manager.stopDeviceScan();
          reject(error);
          return;
        }

        if (!device?.name) {
          return;
        }

        if (device.name.includes(nameIncludes)) {
          foundMap.set(device.id, { id: device.id, name: device.name });
        }
      });

      setTimeout(() => {
        manager.stopDeviceScan();
        resolve(Array.from(foundMap.values()));
      }, timeoutMs);
    });
  }

  async connectAndStream({ config, onReading, onConnected, readingLimit = 10, selectedDeviceId = null }) {
    const { serviceUUID, characteristicUUID, deviceNameIncludes } = config;

    const readings = [];

    await this.ensurePoweredOn();

    if (selectedDeviceId) {
      this.device = await this.getManager().connectToDevice(selectedDeviceId);
    } else {
      const device = await this.findDevice(deviceNameIncludes, 15000);
      this.device = await device.connect();
    }

    // Larger MTU helps avoid JSON payload truncation on Android BLE notifications.
    try {
      await this.device.requestMTU(185);
    } catch (_mtuError) {
      // Ignore when platform/device does not support MTU request.
    }

    await this.device.discoverAllServicesAndCharacteristics();

    if (typeof onConnected === "function") {
      onConnected(this.device);
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const startedAt = Date.now();
      let parseErrors = 0;

      const settleReject = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearInterval(interval);
        if (this.subscription) {
          this.subscription.remove();
          this.subscription = null;
        }
        reject(error);
      };

      const settleResolve = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearInterval(interval);
        if (this.subscription) {
          this.subscription.remove();
          this.subscription = null;
        }
        resolve(readings.slice(0, readingLimit));
      };

      this.subscription = this.device.monitorCharacteristicForService(
        serviceUUID,
        characteristicUUID,
        (error, characteristic) => {
          if (error) {
            settleReject(new Error(`BLE monitor error: ${error.message || "Unknown monitor error"}`));
            return;
          }

          if (!characteristic?.value) {
            return;
          }

          try {
            const raw = Buffer.from(characteristic.value, "base64").toString("utf8");
            const reading = parseReadingRaw(raw);

            if (!reading) {
              parseErrors += 1;
              return;
            }

            readings.push(reading);
            onReading(reading, readings.length);

            if (readings.length >= readingLimit) {
              settleResolve();
            }
          } catch (_parseError) {
            parseErrors += 1;
          }
        }
      );

      const interval = setInterval(() => {
        if (Date.now() - startedAt > 40000) {
          settleReject(
            new Error(
              `Timed out while collecting BLE readings. Received ${readings.length}/${readingLimit} packets, parse errors: ${parseErrors}.`
            )
          );
        }
      }, 500);
    });
  }

  ensurePoweredOn() {
    const manager = this.getManager();

    return new Promise((resolve, reject) => {
      const sub = manager.onStateChange((state) => {
        if (state === "PoweredOn") {
          sub.remove();
          resolve();
        }
      }, true);

      setTimeout(() => {
        sub.remove();
        reject(new Error("Bluetooth is unavailable or disabled"));
      }, 10000);
    });
  }

  findDevice(nameIncludes, timeoutMs) {
    const manager = this.getManager();

    return new Promise((resolve, reject) => {
      let found = false;

      manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          manager.stopDeviceScan();
          reject(error);
          return;
        }

        if (!device?.name) {
          return;
        }

        if (device.name.includes(nameIncludes)) {
          found = true;
          if (this.scanTimeout) {
            clearTimeout(this.scanTimeout);
            this.scanTimeout = null;
          }
          manager.stopDeviceScan();
          resolve(device);
        }
      });

      this.scanTimeout = setTimeout(() => {
        if (!found) {
          manager.stopDeviceScan();
          reject(new Error("ESP32 device not found"));
        }
      }, timeoutMs);
    });
  }

  cleanup() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }

    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }

    if (this.device) {
      this.device.cancelConnection().catch(() => {});
      this.device = null;
    }

    if (this.manager) {
      this.manager.destroy();
      this.manager = null;
    }
  }

  async disconnect({ resetEsp32 = false, config = null } = {}) {
    if (resetEsp32 && this.device && config?.serviceUUID && config?.characteristicUUID) {
      const commandBase64 = Buffer.from("RESET", "utf8").toString("base64");

      try {
        await this.device.writeCharacteristicWithResponseForService(
          config.serviceUUID,
          config.characteristicUUID,
          commandBase64
        );
      } catch (_writeWithResponseError) {
        try {
          await this.device.writeCharacteristicWithoutResponseForService(
            config.serviceUUID,
            config.characteristicUUID,
            commandBase64
          );
        } catch (_writeWithoutResponseError) {
          // Ignore reset command failures and still disconnect.
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }

    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }

    if (this.device) {
      try {
        await this.device.cancelConnection();
      } catch (_error) {
        // Ignore disconnect errors if device is already disconnected.
      }
      this.device = null;
    }
  }

  async isConnected() {
    if (!this.device) {
      return false;
    }

    try {
      return await this.device.isConnected();
    } catch (_error) {
      return false;
    }
  }
}
