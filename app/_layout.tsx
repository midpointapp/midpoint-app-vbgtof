
import "react-native-reanimated";
import React, { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme, Alert, Platform } from "react-native";
import { useNetworkState } from "expo-network";
import * as Linking from "expo-linking";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "onboarding",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const networkState = useNetworkState();
  const router = useRouter();
  const segments = useSegments();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const [initialUrlProcessed, setInitialUrlProcessed] = useState(false);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      setAppReady(true);
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

  // Handle deep links with meetPointId query parameter
  useEffect(() => {
    if (!appReady) {
      return;
    }

    const handleDeepLink = (url: string) => {
      if (!url) return;

      console.log("[DeepLink] Deep link received:", url);
      
      try {
        // Parse the URL to extract query parameters
        const parsed = Linking.parse(url);
        console.log("[DeepLink] Parsed deep link:", parsed);
        
        // Check for meetPointId in query parameters
        const meetPointId = parsed.queryParams?.meetPointId as string | undefined;
        
        if (meetPointId) {
          console.log("[DeepLink] MeetPoint ID found in URL:", meetPointId);
          
          // Navigate to the Meet Session screen with the meetPointId
          // Use a small delay to ensure navigation is ready
          setTimeout(() => {
            console.log("[DeepLink] Navigating to /meet-session with meetPointId:", meetPointId);
            router.push({
              pathname: '/meet-session',
              params: { meetPointId },
            });
          }, 300);
        } else {
          console.log("[DeepLink] No meetPointId found in URL query parameters");
        }
      } catch (error) {
        console.error("[DeepLink] Error parsing deep link:", error);
      }
    };

    // Handle initial URL if app was opened via deep link
    if (!initialUrlProcessed) {
      console.log("[DeepLink] Checking for initial URL...");
      
      Linking.getInitialURL()
        .then((url) => {
          console.log("[DeepLink] Initial URL:", url);
          if (url) {
            handleDeepLink(url);
          } else {
            console.log("[DeepLink] No initial URL found");
          }
          setInitialUrlProcessed(true);
        })
        .catch((error) => {
          console.error("[DeepLink] Error getting initial URL:", error);
          setInitialUrlProcessed(true);
        });
    }

    // Listen for deep links when app is already open
    const subscription = Linking.addEventListener("url", (event) => {
      console.log("[DeepLink] Deep link event received:", event);
      if (event?.url) {
        handleDeepLink(event.url);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [appReady, initialUrlProcessed, router]);

  if (!loaded) {
    return null;
  }

  const CustomDefaultTheme: Theme = {
    ...DefaultTheme,
    dark: false,
    colors: {
      primary: "rgb(63, 81, 181)",
      background: "rgb(245, 245, 245)",
      card: "rgb(255, 255, 255)",
      text: "rgb(33, 33, 33)",
      border: "rgb(224, 224, 224)",
      notification: "rgb(244, 67, 54)",
    },
  };

  const CustomDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
      primary: "rgb(63, 81, 181)",
      background: "rgb(18, 18, 18)",
      card: "rgb(33, 33, 33)",
      text: "rgb(255, 255, 255)",
      border: "rgb(66, 66, 66)",
      notification: "rgb(244, 67, 54)",
    },
  };

  return (
    <>
      <StatusBar style="auto" animated />
      <ThemeProvider
        value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}
      >
        <WidgetProvider>
          <GestureHandlerRootView>
            <Stack>
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
                  presentation: "modal",
                  headerShown: true,
                  title: "Meet Now",
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
            <SystemBars style={"auto"} />
          </GestureHandlerRootView>
        </WidgetProvider>
      </ThemeProvider>
    </>
  );
}
