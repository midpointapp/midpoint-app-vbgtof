
import React from "react";
import { Stack, useRouter } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useTheme } from "@react-navigation/native";
import { HeaderRightButton, HeaderLeftButton } from "@/components/HeaderButtons";
import { mockSessions, mockCurrentUser } from "@/data/mockData";
import { IconSymbol } from "@/components/IconSymbol";
import { useThemeColors } from "@/styles/commonStyles";

export default function HomeScreen() {
  const theme = useTheme();
  const colors = useThemeColors();
  const router = useRouter();

  const userSessions = mockSessions.filter(
    (session) => session.creator_id === mockCurrentUser.id
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "MidPoint",
          headerRight: () => <HeaderRightButton />,
          headerLeft: () => <HeaderLeftButton />,
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeText, { color: colors.text }]}>
              Welcome back, {mockCurrentUser.name}!
            </Text>
            <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>
              Meet halfway without sharing your home address
            </Text>
          </View>

          {/* Start New MidPoint Button */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/create-session")}
          >
            <IconSymbol
              ios_icon_name="plus.circle.fill"
              android_material_icon_name="add_circle"
              size={24}
              color="#FFFFFF"
            />
            <Text style={styles.primaryButtonText}>Start a New MidPoint</Text>
          </TouchableOpacity>

          {/* Invite Friends Button */}
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
            onPress={() => console.log("Invite friends pressed")}
          >
            <IconSymbol
              ios_icon_name="person.badge.plus"
              android_material_icon_name="person_add"
              size={24}
              color={colors.primary}
            />
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
              Invite Friends
            </Text>
          </TouchableOpacity>

          {/* Past Sessions Section */}
          <View style={styles.sessionsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Your Past Sessions
            </Text>

            {userSessions.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
                <IconSymbol
                  ios_icon_name="map"
                  android_material_icon_name="map"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No sessions yet
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  Create your first MidPoint to get started
                </Text>
              </View>
            ) : (
              userSessions.map((session, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.sessionCard, { backgroundColor: colors.card }]}
                  onPress={() => router.push(`/session/${session.id}`)}
                >
                  <View style={styles.sessionHeader}>
                    <View style={styles.sessionInfo}>
                      <Text style={[styles.sessionTitle, { color: colors.text }]}>
                        {session.title}
                      </Text>
                      <Text style={[styles.sessionCategory, { color: colors.textSecondary }]}>
                        {session.category}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            session.status === "active"
                              ? colors.success + "20"
                              : colors.textSecondary + "20",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          {
                            color:
                              session.status === "active"
                                ? colors.success
                                : colors.textSecondary,
                          },
                        ]}
                      >
                        {session.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.sessionFooter}>
                    <IconSymbol
                      ios_icon_name="calendar"
                      android_material_icon_name="calendar_today"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={[styles.sessionDate, { color: colors.textSecondary }]}>
                      {new Date(session.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  welcomeSection: {
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    lineHeight: 22,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 32,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
  sessionsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  emptyCard: {
    padding: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  sessionCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
    elevation: 3,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  sessionCategory: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  sessionFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sessionDate: {
    fontSize: 14,
  },
});
