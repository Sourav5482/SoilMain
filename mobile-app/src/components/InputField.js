import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

export const InputField = ({ label, value, onChangeText, placeholder, multiline = false }) => (
  <View style={styles.wrapper}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      multiline={multiline}
      style={[styles.input, multiline && styles.multiline]}
      placeholderTextColor="#7a7469"
    />
  </View>
);

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3f3b34",
    marginBottom: 6
  },
  input: {
    borderWidth: 1,
    borderColor: "#d3ccb8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#2b2b2b",
    backgroundColor: "#fffdf6"
  },
  multiline: {
    minHeight: 84,
    textAlignVertical: "top"
  }
});
