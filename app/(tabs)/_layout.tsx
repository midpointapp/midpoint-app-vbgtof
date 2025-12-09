import React from 'react';
import { Stack } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  useColorScheme,
} from 'react-native';
import { useRouter, usePathname, Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const { width: screenWidth } = Dimensions.get('window');

interface TabBarItem {
  name: string;
  route: Href;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}

function FloatingTabBar({ tabs }: { tabs: TabBarItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const animatedValue = useSharedValue(0);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const colors = {
    background: isDark ? '#121212' : '#F5F5F5',
    text: isDark ? '#FFFFFF' : '#212121',
    textSecondary: isDark ? '#B0B0B0' : '#757575',
    primary: '#3F51B5',
    border: isDark ? '#424242' : '#E0E0E0',
  };

  const activeTabIndex = React.useMemo(() => {
    let bestMatch = -1;
    let bestMatchScore = 0;

    tabs.forEach((tab, index) => {
      let score = 0;

      if (pathname === tab.route) {
        score = 100;
      } else if (pathname.startsWith(tab.route as string)) {
        score = 80;
      } else if (pathname.includes(tab.name)) {
        score = 60;
      } else if (
        (tab.route as string).includes('/(tabs)/') &&
        pathname.includes((tab.route as string).split('/(tabs)/')[1])
      ) {
        score = 40;
      }

      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatch = index;
      }
    });

    return bestMatch >= 0 ? bestMatch : 0;
  }, [pathname, tabs]);

  React.useEffect(() => {
    if (activeTabIndex >= 0) {
      animatedValue.value = withSpring(activeTabIndex, {
        damping: 20,
        stiffness: 120,
        mass: 1,
      });
    }
  }, [activeTabIndex, animatedValue]);

  const handleTabPress = (route: Href) => {
    router.push(route);
  };

  const containerWidth = screenWidth * 0.9;
  const tabWidthPercent = ((100 / tabs.length) - 1).toFixed(2);

  const indicatorStyle = useAnimatedStyle(() => {
    const tabWidth = (containerWidth - 8) / tabs.length;
    return {
      transform: [
        {
          translateX: interpolate(
            animatedValue.value,
            [0, tabs.length - 1],
            [0, tabWidth * (tabs.length - 1)]
          ),
        },
      ],
    };
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={[styles.container, { width: containerWidth }]}>
        <BlurView
          intensity={80}
          style={[
            styles.blurContainer,
            {
              borderWidth: 1,
              borderColor: colors.border,
              ...Platform.select({
                ios: {
                  backgroundColor: isDark
                    ? 'rgba(33, 33, 33, 0.9)'
                    : 'rgba(255, 255, 255, 0.9)',
                },
                android: {
                  backgroundColor: isDark
                    ? 'rgba(33, 33, 33, 0.95)'
                    : 'rgba(255, 255, 255, 0.95)',
                },
                web: {
                  backgroundColor: isDark
                    ? 'rgba(33, 33, 33, 0.95)'
                    : 'rgba(255, 255, 255, 0.95)',
                  // @ts-ignore web-only style
                  backdropFilter: 'blur(10px)',
                },
              }),
            },
          ]}
        >
          <Animated.View
            style={[
              styles.indicator,
              {
                backgroundColor: colors.primary,
                opacity: 0.1,
                width: `${tabWidthPercent}%` as `${number}%`,
              },
              indicatorStyle,
            ]}
          />
          <View style={styles.tabsContainer}>
            {tabs.map((tab) => {
              const isActive = activeTabIndex === tabs.indexOf(tab);
              const uniqueKey = `${tab.name}-${tab.route}`;

              return (
                <TouchableOpacity
                  key={uniqueKey}
                  style={styles.tab}
                  onPress={() => handleTabPress(tab.route)}
                  activeOpacity={0.7}
                >
                  <View style={styles.tabContent}>
                    <MaterialIcons
                      name={tab.icon}
                      size={24}
                      color={isActive ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.tabLabel,
                        { color: colors.textSecondary },
                        isActive && {
                          color: colors.primary,
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </BlurView>
      </View>
    </SafeAreaView>
  );
}

export default function TabLayout() {
  const tabs: TabBarItem[] = [
    {
      name: '(home)',
      route: '/(tabs)/(home)/',
      icon: 'home',
      label: 'Home',
    },
    {
      name: 'profile',
      route: '/(tabs)/profile',
      icon: 'person',
      label: 'Profile',
    },
  ];

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      >
        <Stack.Screen key="home" name="(home)" />
        <Stack.Screen key="profile" name="profile" />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
  },
  container: {
    marginHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  blurContainer: {
    overflow: 'hidden',
    borderRadius: 35,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    left: 2,
    bottom: 4,
    borderRadius: 27,
  },
  tabsContainer: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 2,
  },
});
