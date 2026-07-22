
import "react-native-reanimated";
import React, { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
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

// CRITICAL FIX: Set index as initial route for proper deep link handling
export const unstable_settings = {
  initialRouteName: "index",
};

function DeepLinkHandler({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [deepLinkProcessed, setDeepLinkProcessed] = useState(false);

  // On native: handle deep links that cold-start the app
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const processInitialUrl = async () => {
      console.log('[DeepLink] Processing initial URL (native)');
      try {
        const initialUrl = await Linking.getInitialURL();

        if (initialUrl) {
          console.log('[DeepLink] Initial URL:', initialUrl);
          const parsed = Linking.parse(initialUrl);
          console.log('[DeepLink] Parsed:', JSON.stringify(parsed));

          if (parsed.queryParams?.sessionId) {
            const sessionId = parsed.queryParams.sessionId as string;
            const token = parsed.queryParams.token as string | undefined;
            console.log('[DeepLink] sessionId found, routing to /session');
            setDeepLinkProcessed(true);
            setTimeout(() => {
              if (token) {
                router.replace(`/session?sessionId=${sessionId}&token=${token}`);
              } else {
                router.replace(`/session?sessionId=${sessionId}`);
              }
            }, 100);
            return;
          }

          if (parsed.queryParams?.meetPointId) {
            const meetPointId = parsed.queryParams.meetPointId as string;
            console.log('[DeepLink] meetPointId found, routing to /meet-now');
            setDeepLinkProcessed(true);
            setTimeout(() => {
              router.replace(`/meet-now?meetPointId=${meetPointId}`);
            }, 100);
            return;
          }
        } else {
          console.log('[DeepLink] No initial URL (native)');
        }
      } catch (error) {
        console.error('[DeepLink] Error processing initial URL:', error);
      }
    };

    processInitialUrl();
  }, [router]);

  // Listen for deep links when app is already open
  useEffect(() => {
    if (deepLinkProcessed) return;

    console.log('[DeepLink] Setting up deep link listener');

    const subscription = Linking.addEventListener("url", (event) => {
      console.log('[DeepLink] URL event (app open):', event?.url);
      if (event?.url) {
        try {
          const parsed = Linking.parse(event.url);
          console.log('[DeepLink] Parsed:', JSON.stringify(parsed));

          if (parsed.queryParams?.sessionId) {
            const sessionId = parsed.queryParams.sessionId as string;
            const token = parsed.queryParams.token as string | undefined;
            console.log('[DeepLink] sessionId found, pushing /session');
            if (token) {
              router.push(`/session?sessionId=${sessionId}&token=${token}`);
            } else {
              router.push(`/session?sessionId=${sessionId}`);
            }
            return;
          }

          if (parsed.queryParams?.meetPointId) {
            const meetPointId = parsed.queryParams.meetPointId as string;
            console.log('[DeepLink] meetPointId found, pushing /meet-now');
            router.push(`/meet-now?meetPointId=${meetPointId}`);
            return;
          }

          console.log('[DeepLink] No recognized params in URL');
        } catch (error) {
          console.error('[DeepLink] Error parsing URL:', error);
        }
      }
    });

    return () => {
      console.log('[DeepLink] Cleaning up deep link listener');
      subscription?.remove();
    };
  }, [router, deepLinkProcessed]);

  return <>{children}</>;
}

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
            <DeepLinkHandler>
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
                    headerShown: true,
                    title: "Meet Session",
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
            </DeepLinkHandler>
          </GestureHandlerRootView>
        </WidgetProvider>
      </ThemeProvider>
    </>
  );
}
