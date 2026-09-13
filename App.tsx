import React from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, Text, TouchableOpacity, Animated } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { AppProvider, useApp } from "./src/context/AppContext";
import { HomeScreen } from "./src/screens/HomeScreen";
import { CatalogScreen } from "./src/screens/CatalogScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { FavoritesScreen } from "./src/screens/FavoritesScreen";
import { DetailScreen } from "./src/screens/DetailScreen";
import { PlayerScreen } from "./src/screens/PlayerScreen";
import { NetworkBanner } from "./src/components/NetworkBanner";
import { UpdateModal } from "./src/components/UpdateModal";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#070a12",
    card: "#070a12",
    text: "#ffffff",
    border: "rgba(255, 255, 255, 0.08)",
    primary: "#e50914",
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#070a12",
          borderTopColor: "rgba(255, 255, 255, 0.08)",
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: "#e50914",
        tabBarInactiveTintColor: "#64748b",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any = "home";
          if (route.name === "HomeTab") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "CatalogTab") {
            iconName = focused ? "film" : "film-outline";
          } else if (route.name === "SearchTab") {
            iconName = focused ? "search" : "search-outline";
          } else if (route.name === "FavoritesTab") {
            iconName = focused ? "heart" : "heart-outline";
          }
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ tabBarLabel: "Asosiy" }}
      />
      <Tab.Screen
        name="CatalogTab"
        component={CatalogScreen}
        options={{ tabBarLabel: "Katalog" }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{ tabBarLabel: "Qidiruv" }}
      />
      <Tab.Screen
        name="FavoritesTab"
        component={FavoritesScreen}
        options={{ tabBarLabel: "Sevimlilar" }}
      />
    </Tab.Navigator>
  );
}

function AppContent() {
  const {
    isOffline,
    isRestored,
    updateInfo,
    showUpdateModal,
    setShowUpdateModal,
    syncToast,
    dismissSyncToast,
  } = useApp();

  return (
    <View style={styles.rootContainer}>
      <NavigationContainer theme={customDarkTheme}>
        <StatusBar style="light" backgroundColor="#070a12" />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            contentStyle: { backgroundColor: "#070a12" },
          }}
        >
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="Detail" component={DetailScreen} />
          <Stack.Screen
            name="Player"
            component={PlayerScreen}
            options={{
              animation: "fade",
              orientation: "all",
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Real-time Dynamic In-App Sync Floating Toast */}
      {syncToast && (
        <View style={styles.toastWrapper} pointerEvents="box-none">
          <View style={styles.toastCard}>
            <View style={styles.toastIconWrap}>
              <Ionicons name="sparkles" size={16} color="#38ef7d" />
            </View>
            <Text style={styles.toastText} numberOfLines={2}>
              {syncToast}
            </Text>
            <TouchableOpacity
              onPress={dismissSyncToast}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.toastCloseBtn}
            >
              <Ionicons name="close" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Global Realtime Internet Connectivity Banner */}
      <NetworkBanner isOffline={isOffline} isRestored={isRestored} />

      {/* In-App GitHub Auto-Update Modal with Direct Downloader (Only for Major Engine Upgrades) */}
      <UpdateModal
        visible={showUpdateModal}
        updateInfo={updateInfo}
        onClose={() => setShowUpdateModal(false)}
      />
    </View>
  );
}

export default function App() {
  const [reloadKey, setReloadKey] = React.useState(0);

  const handleAppRestart = React.useCallback((message?: string) => {
    // Increment root key to cleanly remount navigation stack with fresh collections
    setReloadKey((prev) => prev + 1);
  }, []);

  return (
    <SafeAreaProvider key={`safe-root-${reloadKey}`}>
      <AppProvider onAppRestart={handleAppRestart}>
        <AppContent />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "#070a12",
  },
  toastWrapper: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 9999,
  },
  toastCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(56, 239, 125, 0.4)",
    shadowColor: "#38ef7d",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    gap: 10,
    maxWidth: 380,
  },
  toastIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(56, 239, 125, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  toastText: {
    flex: 1,
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  toastCloseBtn: {
    padding: 2,
  },
});
