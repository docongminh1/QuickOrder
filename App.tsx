import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DataProvider } from './src/store/DataContext';
import CutDoseScreen from './src/screens/CutDoseScreen';
import LookupScreen from './src/screens/LookupScreen';
import DataScreen from './src/screens/DataScreen';
import { C } from './src/ui/theme';

const Tab = createBottomTabNavigator();

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: C.accent, background: C.bg, card: C.surface, border: C.line, text: C.ink } };

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  'Cắt liều': { on: 'medkit', off: 'medkit-outline' },
  'Tra thuốc': { on: 'search', off: 'search-outline' },
  'Dữ liệu': { on: 'document-text', off: 'document-text-outline' },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <DataProvider>
        <NavigationContainer theme={theme}>
          <StatusBar style="dark" />
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarActiveTintColor: C.accent,
              tabBarInactiveTintColor: C.muted,
              tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
              tabBarIcon: ({ focused, color, size }) => (
                <Ionicons name={focused ? ICONS[route.name].on : ICONS[route.name].off} color={color} size={size} />
              ),
            })}
          >
            <Tab.Screen name="Cắt liều" component={CutDoseScreen} />
            <Tab.Screen name="Tra thuốc" component={LookupScreen} />
            <Tab.Screen name="Dữ liệu" component={DataScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </DataProvider>
    </SafeAreaProvider>
  );
}
