import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  View,
  Animated,
  Image,
  Text,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AppProvider, useApp } from './src/context/AppContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { CatalogScreen } from './src/screens/CatalogScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { DetailScreen } from './src/screens/DetailScreen';
import { PlayerScreen } from './src/screens/PlayerScreen';
import { NetworkBanner } from './src/components/NetworkBanner';
import { UpdateModal } from './src/components/UpdateModal';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#070a12',
    card: '#070a12',
    text: '#ffffff',
    border: 'rgba(255, 255, 255, 0.08)',
    primary: '#e50914',
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#070a12',
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#e50914',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any = 'home';
          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'CatalogTab') {
            iconName = focused ? 'film' : 'film-outline';
          } else if (route.name === 'SearchTab') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'FavoritesTab') {
            iconName = focused ? 'heart' : 'heart-outline';
          }
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ tabBarLabel: 'Asosiy' }}
      />
      <Tab.Screen
        name="CatalogTab"
        component={CatalogScreen}
        options={{ tabBarLabel: 'Katalog' }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{ tabBarLabel: 'Qidiruv' }}
      />
      <Tab.Screen
        name="FavoritesTab"
        component={FavoritesScreen}
        options={{ tabBarLabel: 'Sevimlilar' }}
      />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { isOffline, isRestored, updateInfo, showUpdateModal, setShowUpdateModal } = useApp();
  const [appReady, setAppReady] = useState(false);
  const splashFadeAnim = useRef(new Animated.Value(1)).current;
  const splashScaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    // Elegant entrance scale
    Animated.spring(splashScaleAnim, {
      toValue: 1,
      friction: 6,
      useNativeDriver: true,
    }).start();

    // Fast transition: only 150ms before initiating smooth fade out
    const timer = setTimeout(() => {
      Animated.timing(splashFadeAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setAppReady(true));
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.rootContainer}>
      <NavigationContainer theme={customDarkTheme}>
        <StatusBar style="light" backgroundColor="#070a12" />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#070a12' },
          }}
        >
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="Detail" component={DetailScreen} />
          <Stack.Screen
            name="Player"
            component={PlayerScreen}
            options={{
              animation: 'fade',
              orientation: 'all',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Global Realtime Internet Connectivity Banner */}
      <NetworkBanner isOffline={isOffline} isRestored={isRestored} />

      {/* In-App GitHub Auto-Update Modal with Direct Downloader */}
      <UpdateModal
        visible={showUpdateModal}
        updateInfo={updateInfo}
        onClose={() => setShowUpdateModal(false)}
      />

      {/* Branded Fast Splash Screen with Vibrant Logo (Instant, never pitch-black!) */}
      {!appReady && (
        <Animated.View
          style={[styles.splashOverlay, { opacity: splashFadeAnim }]}
          pointerEvents="none"
        >
          <Animated.View
            style={[styles.splashCard, { transform: [{ scale: splashScaleAnim }] }]}
          >
            <Image
              source={require('./assets/icon.png')}
              style={styles.splashLogo}
              resizeMode="cover"
            />
            <View style={styles.splashTextWrap}>
              <Text style={styles.splashBrand}>FILMX</Text>
              <Text style={styles.splashTagline}>Premyeralar va Seriallar</Text>
            </View>
            <ActivityIndicator size="small" color="#e50914" style={{ marginTop: 14 }} />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#070a12',
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#070a12',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  splashCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 110,
    height: 110,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(229, 9, 20, 0.6)',
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  splashTextWrap: {
    alignItems: 'center',
    marginTop: 14,
  },
  splashBrand: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
  },
  splashTagline: {
    color: '#00f2fe',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
