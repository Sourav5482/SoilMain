import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

const MetricRow = ({ label, value }) => (
  <View style={styles.metricRow}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

export const RecordCard = ({ record }) => {
  const date = new Date(record.timestamp).toLocaleString();

  return (
    <View style={styles.card}>
      <Text style={styles.date}>{date}</Text>
      <MetricRow label="Ref ID" value={record.refId || "-"} />
      {record.location ? <MetricRow label="Location" value={record.location} /> : null}
      <MetricRow label="Temperature" value={`${record.temperature} C`} />
      <MetricRow label="Humidity" value={`${record.humidity} %`} />
      <MetricRow label="NPK" value={`N:${record.npk?.n} P:${record.npk?.p} K:${record.npk?.k}`} />
      <MetricRow
        label="Min"
        value={`T:${record.minValues?.tempMin} H:${record.minValues?.humidityMin} N:${record.minValues?.nMin} P:${record.minValues?.pMin} K:${record.minValues?.kMin}`}
      />
      <MetricRow
        label="Max"
        value={`T:${record.maxValues?.tempMax} H:${record.maxValues?.humidityMax} N:${record.maxValues?.nMax} P:${record.maxValues?.pMax} K:${record.maxValues?.kMax}`}
      />
      <Text style={styles.remarks}>Remarks: {record.remarks || "-"}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagesContainer}>
        {(record.images || []).map((image, index) => (
          <Image key={`${image}-${index}`} source={{ uri: image }} style={styles.image} />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e4dcc7"
  },
  date: {
    fontWeight: "700",
    marginBottom: 8,
    color: "#2e4b37"
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  metricLabel: {
    color: "#5d5648",
    fontWeight: "600"
  },
  metricValue: {
    color: "#2d2a24"
  },
  remarks: {
    marginTop: 8,
    marginBottom: 8,
    color: "#4a4236"
  },
  imagesContainer: {
    gap: 8
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#ece8dd"
  }
});
