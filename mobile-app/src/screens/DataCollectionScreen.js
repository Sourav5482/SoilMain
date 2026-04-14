import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { InputField } from "../components/InputField";
import { BLE_CONFIG, SOIL_TYPES } from "../constants/config";
import { BluetoothSoilService } from "../services/bluetooth.service";
import { enqueueSubmission, getPendingSubmissionCount } from "../services/offlineQueue.service";
import { isNetworkOnline } from "../services/network.service";
import { syncQueuedSubmissions } from "../services/sync.service";
import { calculateStats } from "../utils/stats";

const initialSensorState = {
  temperature: null,
  humidity: null,
  n: null,
  p: null,
  k: null,
  latitude: null,
  longitude: null,
  count: 0
};

export const DataCollectionScreen = ({ navigation }) => {
  const bleServiceRef = useRef(new BluetoothSoilService());

  const [refId, setRefId] = useState("");
  const [location, setLocation] = useState("");
  const [remarks, setRemarks] = useState("");
  const [soilType, setSoilType] = useState("Loamy");

  const [tempList, setTempList] = useState([]);
  const [humidityList, setHumidityList] = useState([]);
  const [nList, setNList] = useState([]);
  const [pList, setPList] = useState([]);
  const [kList, setKList] = useState([]);

  const [images, setImages] = useState([]);
  const [sensor, setSensor] = useState(initialSensorState);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [isBleConnected, setIsBleConnected] = useState(false);

  const [gettingData, setGettingData] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);

  useEffect(() => {
    void refreshPendingQueueCount();

    return () => {
      bleServiceRef.current.cleanup();
    };
  }, []);

  const refreshPendingQueueCount = async () => {
    const count = await getPendingSubmissionCount();
    setPendingQueueCount(count);
    return count;
  };

  const stats = useMemo(() => {
    if (nList.length < 10 || pList.length < 10 || kList.length < 10) {
      return null;
    }

    if (tempList.length < 10 || humidityList.length < 10 || nList.length < 10 || pList.length < 10 || kList.length < 10) {
      return null;
    }

    return calculateStats({ tempList, humidityList, nList, pList, kList });
  }, [tempList, humidityList, nList, pList, kList]);

  const getDataFromBle = async () => {
    if (!selectedDeviceId) {
      Alert.alert("Select device", "Scan and select your ESP32 device first");
      return;
    }

    try {
      setGettingData(true);

      setTempList([]);
      setHumidityList([]);
      setNList([]);
      setPList([]);
      setKList([]);
      setSensor(initialSensorState);

      const readings = await bleServiceRef.current.connectAndStream({
        config: BLE_CONFIG,
        selectedDeviceId,
        readingLimit: 10,
        onConnected: () => {
          setIsBleConnected(true);
          Alert.alert("Bluetooth Connected", "ESP32 connected successfully");
        },
        onReading: (reading, count) => {
          setTempList((prev) => [...prev, Number(reading.temp)]);
          setHumidityList((prev) => [...prev, Number(reading.humidity)]);
          setNList((prev) => [...prev, Number(reading.n)]);
          setPList((prev) => [...prev, Number(reading.p)]);
          setKList((prev) => [...prev, Number(reading.k)]);

          setSensor({
            temperature: Number(reading.temp),
            humidity: Number(reading.humidity),
            n: Number(reading.n),
            p: Number(reading.p),
            k: Number(reading.k),
            latitude: reading.lat !== undefined ? Number(reading.lat) : null,
            longitude: reading.lng !== undefined ? Number(reading.lng) : null,
            count
          });
        }
      });

      if (readings.length < 10) {
        Alert.alert("Incomplete readings", "Could not collect 10 readings from ESP32");
      }
    } catch (error) {
      setIsBleConnected(false);
      Alert.alert("Bluetooth Error", error.message || "Failed to collect sensor data");
    } finally {
      const connected = await bleServiceRef.current.isConnected();
      setIsBleConnected(connected);
      setGettingData(false);
    }
  };

  const scanDevices = async () => {
    try {
      setScanning(true);
      setDevices([]);
      setSelectedDeviceId("");

      const foundDevices = await bleServiceRef.current.scanForDevices({
        nameIncludes: BLE_CONFIG.deviceNameIncludes,
        timeoutMs: 8000
      });

      setDevices(foundDevices);

      if (!foundDevices.length) {
        Alert.alert("No device found", "No ESP32 device found. Make sure it is powered and advertising.");
      }
    } catch (error) {
      Alert.alert("Scan Error", error.message || "Failed to scan BLE devices");
    } finally {
      setScanning(false);
    }
  };

  const disconnectBluetooth = async () => {
    try {
      setDisconnecting(true);
      await bleServiceRef.current.disconnect({
        resetEsp32: true,
        config: BLE_CONFIG
      });
      setIsBleConnected(false);
      setSelectedDeviceId("");
      Alert.alert("Disconnected", "Bluetooth device disconnected. Reset command sent to ESP32.");
    } catch (error) {
      Alert.alert("Disconnect Error", error.message || "Failed to disconnect Bluetooth device");
    } finally {
      setDisconnecting(false);
    }
  };

  const clickPictures = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission", "Camera permission is required");
        return;
      }

      if (images.length >= 3) {
        Alert.alert("Limit reached", "Maximum 3 images allowed");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.4,
        allowsEditing: false
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const picked = result.assets[0];
      setImages((prev) => {
        if (prev.length >= 3) {
          return prev;
        }
        return [...prev, picked];
      });
    } catch (error) {
      Alert.alert("Camera Error", error.message || "Could not capture image");
    }
  };

  const removeImageAtIndex = (indexToRemove) => {
    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const getGpsCoordinates = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      return {
        latitude: sensor.latitude,
        longitude: sensor.longitude
      };
    }

    const position = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("GPS timeout")), 10000);
      })
    ]).catch(async () => {
      return await Location.getLastKnownPositionAsync();
    });

    return {
      latitude: position?.coords?.latitude ?? sensor.latitude,
      longitude: position?.coords?.longitude ?? sensor.longitude
    };
  };

  const resetFormAfterSubmit = () => {
    setRefId("");
    setLocation("");
    setRemarks("");
    setSoilType("Loamy");

    setImages([]);

    setTempList([]);
    setHumidityList([]);
    setNList([]);
    setPList([]);
    setKList([]);

    setSensor(initialSensorState);
  };

  const syncPendingQueue = async () => {
    try {
      setSyncingQueue(true);
      const online = await isNetworkOnline();

      if (!online) {
        Alert.alert("Offline", "No internet connection. Queued items will sync when network returns.");
        return;
      }

      const syncResult = await syncQueuedSubmissions({ reason: "manual-screen-sync", force: true });
      const pendingCount = await refreshPendingQueueCount();

      if (syncResult.syncedCount > 0) {
        Alert.alert("Sync complete", `Uploaded ${syncResult.syncedCount} queued item(s). Pending: ${pendingCount}`);
        return;
      }

      Alert.alert("Queue status", `No items synced now. Pending: ${pendingCount}`);
    } catch (error) {
      Alert.alert("Sync Error", error.message || "Failed to sync queued submissions");
    } finally {
      setSyncingQueue(false);
    }
  };

  const submit = async () => {
    if (!refId.trim()) {
      Alert.alert("Validation", "Ref ID is required");
      return;
    }

    if (!stats) {
      Alert.alert("Validation", "Please collect 10 BLE readings first");
      return;
    }

    try {
      setSubmitting(true);

      const coords = await getGpsCoordinates();
      const computedRecordKey = `${refId.trim()}-${Date.now()}`;

      const payload = {
        refId: refId.trim(),
        recordKey: computedRecordKey,
        sensorMode: "all",
        location: location.trim(),
        soilType,
        remarks: remarks.trim(),
        temperature: stats.temperature,
        humidity: stats.humidity,
        npk: stats.npk,
        minValues: stats.minValues,
        maxValues: stats.maxValues,
        latitude: coords.latitude,
        longitude: coords.longitude,
        images: [],
        timestamp: new Date().toISOString()
      };

      await enqueueSubmission({
        payload,
        images
      });

      resetFormAfterSubmit();

      const online = await isNetworkOnline();
      if (online) {
        await syncQueuedSubmissions({ reason: "post-submit" });
      }

      const pendingCount = await refreshPendingQueueCount();

      if (online && pendingCount === 0) {
        Alert.alert("Success", "Soil record saved and synced successfully");
        return;
      }

      Alert.alert(
        "Saved offline",
        `Submission is safely queued on device. Pending upload count: ${pendingCount}. It will auto-sync when internet is stable.`
      );
    } catch (error) {
      Alert.alert("Submit Error", error?.response?.data?.message || error.message);
      await refreshPendingQueueCount();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Soil Monitoring</Text>
        <Text style={styles.subtitle}>Capture sensor, image, and site details in one flow</Text>

        <TouchableOpacity style={styles.historyButton} onPress={() => navigation.navigate("History")}>
          <Text style={styles.historyButtonText}>View History</Text>
        </TouchableOpacity>

        <View style={styles.queueCard}>
          <Text style={styles.queueTitle}>Offline Queue</Text>
          <Text style={styles.queueText}>Pending uploads: {pendingQueueCount}</Text>
          <TouchableOpacity style={styles.queueSyncButton} onPress={syncPendingQueue} disabled={syncingQueue}>
            {syncingQueue ? <ActivityIndicator color="#fff" /> : <Text style={styles.queueSyncButtonText}>Sync Now</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.actionButton} onPress={getDataFromBle} disabled={gettingData}>
          {gettingData ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Get Data</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={scanDevices} disabled={scanning}>
          {scanning ? <ActivityIndicator color="#fff" /> : <Text style={styles.secondaryButtonText}>Scan ESP32</Text>}
        </TouchableOpacity>

        {isBleConnected ? (
          <TouchableOpacity style={styles.disconnectButton} onPress={disconnectBluetooth} disabled={disconnecting}>
            {disconnecting ? <ActivityIndicator color="#fff" /> : <Text style={styles.secondaryButtonText}>Disconnect Bluetooth</Text>}
          </TouchableOpacity>
        ) : null}

        {devices.length ? (
          <View style={styles.deviceListContainer}>
            {devices.map((device) => {
              const selected = selectedDeviceId === device.id;

              return (
                <TouchableOpacity
                  key={device.id}
                  style={[styles.deviceItem, selected && styles.deviceItemSelected]}
                  onPress={() => setSelectedDeviceId(device.id)}
                >
                  <Text style={[styles.deviceName, selected && styles.deviceNameSelected]}>{device.name}</Text>
                  <Text style={styles.deviceId}>{device.id}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <View style={styles.liveCard}>
          <Text style={styles.liveTitle}>Live Sensor Data</Text>
          <Text style={styles.liveText}>Readings: {sensor.count}/10</Text>
          <Text style={styles.liveText}>Temp: {sensor.temperature ?? "-"}</Text>
          <Text style={styles.liveText}>Humidity: {sensor.humidity ?? "-"}</Text>
          <Text style={styles.liveText}>N: {sensor.n ?? "-"} P: {sensor.p ?? "-"} K: {sensor.k ?? "-"}</Text>
        </View>

        <TouchableOpacity style={styles.secondaryButton} onPress={clickPictures}>
          <Text style={styles.secondaryButtonText}>Click Pic</Text>
        </TouchableOpacity>
        <Text style={styles.helperText}>Images selected: {images.length}/3 (optional for merge updates)</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesRow}>
          {images.map((image, index) => (
            <View key={`${image.uri}-${index}`} style={styles.previewWrapper}>
              <Image source={{ uri: image.uri }} style={styles.previewImage} />
              <TouchableOpacity style={styles.removeImageButton} onPress={() => removeImageAtIndex(index)}>
                <Text style={styles.removeImageButtonText}>X</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <InputField label="Ref ID" value={refId} onChangeText={setRefId} placeholder="Required" />
        <InputField label="Location" value={location} onChangeText={setLocation} placeholder="Farm or village" />
        <InputField label="Remarks" value={remarks} onChangeText={setRemarks} placeholder="Optional notes" multiline />

        <Text style={styles.dropdownLabel}>Soil Type</Text>
        <View style={styles.soilOptionsRow}>
          {SOIL_TYPES.map((item) => {
            const selected = soilType === item;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.soilOption, selected && styles.soilOptionActive]}
                onPress={() => setSoilType(item)}
              >
                <Text style={[styles.soilOptionText, selected && styles.soilOptionTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f1ede1" },
  container: { padding: 16, paddingBottom: 32 },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1e4d34"
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 16,
    color: "#5e5a4e"
  },
  historyButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2c5f41",
    marginBottom: 12
  },
  historyButtonText: {
    color: "#2c5f41",
    fontWeight: "700"
  },
  queueCard: {
    backgroundColor: "#fffaf0",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0d8c2",
    padding: 12,
    marginBottom: 12
  },
  queueTitle: {
    color: "#2e553f",
    fontWeight: "800",
    marginBottom: 4
  },
  queueText: {
    color: "#3f3a33",
    marginBottom: 8
  },
  queueSyncButton: {
    backgroundColor: "#2f6540",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center"
  },
  queueSyncButtonText: {
    color: "#fff",
    fontWeight: "700"
  },
  actionButton: {
    backgroundColor: "#1f6b43",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "700"
  },
  liveCard: {
    backgroundColor: "#fffaf0",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0d8c2",
    padding: 12,
    marginBottom: 12
  },
  liveTitle: {
    fontWeight: "700",
    marginBottom: 6,
    color: "#2e553f"
  },
  liveText: {
    color: "#3f3a33",
    marginBottom: 2
  },
  secondaryButton: {
    backgroundColor: "#c96e2a",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center"
  },
  disconnectButton: {
    marginTop: 8,
    backgroundColor: "#8a2f2f",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "700"
  },
  helperText: {
    marginTop: 8,
    color: "#605a4e",
    marginBottom: 6
  },
  deviceListContainer: {
    marginTop: 10,
    marginBottom: 12,
    gap: 8
  },
  deviceItem: {
    borderWidth: 1,
    borderColor: "#d2cab7",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#fffdf6"
  },
  deviceItemSelected: {
    borderColor: "#205d3a",
    backgroundColor: "#eef8f0"
  },
  deviceName: {
    fontWeight: "700",
    color: "#3f3a33"
  },
  deviceNameSelected: {
    color: "#205d3a"
  },
  deviceId: {
    marginTop: 2,
    fontSize: 12,
    color: "#7b7468"
  },
  imagesRow: {
    marginBottom: 12
  },
  previewWrapper: {
    position: "relative",
    marginRight: 8
  },
  previewImage: {
    width: 92,
    height: 92,
    borderRadius: 12,
    backgroundColor: "#ddd7cb"
  },
  removeImageButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#a52727",
    alignItems: "center",
    justifyContent: "center"
  },
  removeImageButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800"
  },
  dropdownLabel: {
    marginTop: 4,
    marginBottom: 8,
    fontWeight: "700",
    color: "#3f3b34"
  },
  soilOptionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16
  },
  soilOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#efe7d3"
  },
  soilOptionActive: {
    backgroundColor: "#285c3d"
  },
  soilOptionText: {
    color: "#5c513f",
    fontWeight: "700"
  },
  soilOptionTextActive: {
    color: "#fff"
  },
  submitButton: {
    backgroundColor: "#234a87",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center"
  },
  submitText: {
    color: "#fff",
    fontWeight: "700"
  }
});
