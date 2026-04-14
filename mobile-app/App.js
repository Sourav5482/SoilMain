import React, { useEffect } from "react";
import { AppState } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DataCollectionScreen } from "./src/screens/DataCollectionScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { initializeAutoSync, syncQueuedSubmissions } from "./src/services/sync.service";

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    const disposeAutoSync = initializeAutoSync();

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        syncQueuedSubmissions({ reason: "app-resume" }).catch(() => {});
      }
    });

    syncQueuedSubmissions({ reason: "app-start" }).catch(() => {});

    return () => {
      appStateSubscription.remove();
      disposeAutoSync();
    };
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="DataCollection"
        screenOptions={{
          headerStyle: { backgroundColor: "#e5dfca" },
          headerTintColor: "#173424",
          headerTitleStyle: { fontWeight: "700" }
        }}
      >
        <Stack.Screen name="DataCollection" component={DataCollectionScreen} options={{ title: "Data Collection" }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: "Soil History" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
