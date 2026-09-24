
import "react-native-reanimated";
import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme, Alert } from "react-native";
import { useNetworkState } from "expo-network";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const networkState = useNetworkState();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (
      !networkState.isConnected &&
      networkState.isInternetReachable === false
    ) {
      Alert.alert(
        "🔌 You are offline",
        "You can keep using the app! Your changes will be saved locally and synced when you are back online."
      );
    }
  }, [networkState.isConnected, networkState.isInternetReachable]);

  if (!loaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="auto" animated />
      <WidgetProvider>
        <GestureHandlerRootView>
          <Stack>
                {/* CRITICAL FIX: Index route for root path handling */}
                <Stack.Screen
                  name="index"
                  options={{
                    headerShown: false,
                  }}
                />
                {/* CRITICAL FIX: Session screen for deep link routing */}
                <Stack.Screen
                  name="session"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen 
                  name="onboarding" 
                  options={{ headerShown: false }} 
                />
                <Stack.Screen 
                  name="(tabs)" 
                  options={{ headerShown: false }} 
                />
                <Stack.Screen
                  name="meet-now"
                  options={{
                    headerShown: true,
                    title: "Meet Now",
                    headerBackButtonDisplayMode: "minimal",
                  }}
                />
                <Stack.Screen
                  name="meet"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="meet-session"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="midpoint-results"
                  options={{
                    headerShown: true,
                    title: "Meet Point Results",
                    headerBackButtonDisplayMode: "minimal",
                  }}
                />
                <Stack.Screen
                  name="invite"
                  options={{
                    presentation: "modal",
                    headerShown: true,
                    title: "Invite",
                  }}
                />
                <Stack.Screen
                  name="create-session"
                  options={{
                    presentation: "modal",
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="session/[id]"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="modal"
                  options={{
                    presentation: "modal",
                    title: "Standard Modal",
                  }}
                />
                <Stack.Screen
                  name="formsheet"
                  options={{
                    presentation: "formSheet",
                    title: "Form Sheet Modal",
                    sheetGrabberVisible: true,
                    sheetAllowedDetents: [0.5, 0.8, 1.0],
                    sheetCornerRadius: 20,
                  }}
                />
                <Stack.Screen
                  name="transparent-modal"
                  options={{
                    presentation: "transparentModal",
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="settings/notifications"
                  options={{
                    presentation: "modal",
                    headerShown: true,
                    title: "Notifications",
                  }}
                />
                <Stack.Screen
                  name="settings/privacy"
                  options={{
                    presentation: "modal",
                    headerShown: true,
                    title: "Privacy",
                  }}
                />
                <Stack.Screen
                  name="settings/help"
                  options={{
                    presentation: "modal",
                    headerShown: true,
                    title: "Help & Support",
                  }}
                />
            </Stack>
        </GestureHandlerRootView>
      </WidgetProvider>
    </>
  );
}
