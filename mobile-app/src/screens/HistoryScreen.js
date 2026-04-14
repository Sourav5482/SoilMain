import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { InputField } from "../components/InputField";
import { RecordCard } from "../components/RecordCard";
import { getAllRefIdsApi, getHistoryByLocationApi, getHistoryByRefIdApi } from "../services/api";
import { getQueueStatusSummary } from "../services/offlineQueue.service";

const flattenRecords = (data) => {
  if (Array.isArray(data)) {
    return data.flatMap((item) =>
      (item.records || []).map((record) => ({
        ...record,
        refId: record.refId || item.refId || "-",
        location: record.location || item.location || ""
      }))
    );
  }

  return (data.records || []).map((record) => ({
    ...record,
    refId: record.refId || data.refId || "-",
    location: record.location || data.location || ""
  }));
};

export const HistoryScreen = () => {
  const [location, setLocation] = useState("");
  const [refId, setRefId] = useState("");
  const [records, setRecords] = useState([]);
  const [refSummaries, setRefSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [queueStatus, setQueueStatus] = useState({
    pendingCount: 0,
    lastSyncError: null,
    nextRetryAt: null
  });

  const refreshQueueStatus = async () => {
    const summary = await getQueueStatusSummary();
    setQueueStatus(summary);
  };

  useFocusEffect(
    useCallback(() => {
      void refreshQueueStatus();
    }, [])
  );

  const formatRetryTime = (nextRetryAt) => {
    if (!nextRetryAt) {
      return "Ready now";
    }

    return new Date(nextRetryAt).toLocaleString();
  };

  const fetchByRefId = async () => {
    if (!refId.trim()) {
      Alert.alert("Validation", "Ref ID is required");
      return;
    }

    try {
      setLoading(true);
      const data = await getHistoryByRefIdApi(refId.trim());
      const flattened = flattenRecords(data).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setRecords(flattened);
      setRefSummaries([]);
    } catch (error) {
      Alert.alert("Search failed", error?.response?.data?.message || error.message);
      setRecords([]);
      setRefSummaries([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchByLocation = async () => {
    if (!location.trim()) {
      Alert.alert("Validation", "Location is required");
      return;
    }

    try {
      setLoading(true);
      const data = await getHistoryByLocationApi(location.trim());
      const flattened = flattenRecords(data).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setRecords(flattened);
      setRefSummaries([]);
    } catch (error) {
      Alert.alert("Search failed", error?.response?.data?.message || error.message);
      setRecords([]);
      setRefSummaries([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllRefIds = async () => {
    try {
      setLoading(true);
      const data = await getAllRefIdsApi();
      setRefSummaries(Array.isArray(data) ? data : []);
      setRecords([]);
    } catch (error) {
      Alert.alert("Search failed", error?.response?.data?.message || error.message);
      setRefSummaries([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>History</Text>

        <View style={styles.queueStatusCard}>
          <Text style={styles.queueStatusTitle}>Offline Queue Status</Text>
          <Text style={styles.queueStatusLine}>Pending count: {queueStatus.pendingCount}</Text>
          <Text style={styles.queueStatusLine}>Last sync error: {queueStatus.lastSyncError || "None"}</Text>
          <Text style={styles.queueStatusLine}>Next retry time: {formatRetryTime(queueStatus.nextRetryAt)}</Text>
          <TouchableOpacity style={styles.queueRefreshButton} onPress={refreshQueueStatus}>
            <Text style={styles.queueRefreshButtonText}>Refresh Queue Status</Text>
          </TouchableOpacity>
        </View>

        <InputField label="Location" value={location} onChangeText={setLocation} placeholder="Village / Farm" />
        <TouchableOpacity style={styles.button} onPress={fetchByLocation}>
          <Text style={styles.buttonText}>Search by Location</Text>
        </TouchableOpacity>

        <InputField label="Ref ID" value={refId} onChangeText={setRefId} placeholder="REF-001" />
        <TouchableOpacity style={styles.button} onPress={fetchByRefId}>
          <Text style={styles.buttonText}>Search by Ref ID</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={fetchAllRefIds}>
          <Text style={styles.buttonText}>Show All Ref ID</Text>
        </TouchableOpacity>

        {loading ? <ActivityIndicator size="large" color="#3d6f4d" /> : null}

        <View style={styles.recordsContainer}>
          {refSummaries.map((item, index) => (
            <View key={`${item.refId || "-"}-${index}`} style={styles.refSummaryCard}>
              <Text style={styles.refSummaryText}>Ref ID: {item.refId || "-"}</Text>
              <Text style={styles.refSummaryText}>Location: {item.location || "-"}</Text>
            </View>
          ))}

          {records.map((record, index) => (
            <RecordCard key={`${record.timestamp}-${index}`} record={record} />
          ))}
          {!loading && records.length === 0 && refSummaries.length === 0 ? <Text style={styles.emptyText}>No records loaded</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f6f4ed" },
  container: { padding: 16, paddingBottom: 24 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#23442f",
    marginBottom: 16
  },
  queueStatusCard: {
    backgroundColor: "#fffdf6",
    borderColor: "#dfd8c8",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14
  },
  queueStatusTitle: {
    color: "#284836",
    fontWeight: "800",
    marginBottom: 8
  },
  queueStatusLine: {
    color: "#38453d",
    marginBottom: 4
  },
  queueRefreshButton: {
    marginTop: 8,
    backgroundColor: "#3d6f4d",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  queueRefreshButtonText: {
    color: "#fff",
    fontWeight: "700"
  },
  button: {
    backgroundColor: "#2f6540",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700"
  },
  recordsContainer: {
    marginTop: 12
  },
  refSummaryCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4dcc7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10
  },
  refSummaryText: {
    color: "#2f3e33",
    fontWeight: "600",
    marginBottom: 2
  },
  emptyText: {
    textAlign: "center",
    marginTop: 16,
    color: "#6d675b"
  }
});
