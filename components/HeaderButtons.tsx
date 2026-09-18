import React from "react";
import { Pressable, StyleSheet, Alert } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useThemeColors } from "@/styles/commonStyles";

export function HeaderRightButton() {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={() => Alert.alert("Not Implemented", "This feature is not implemented yet")}
      style={styles.headerButtonContainer}
    >
      <IconSymbol ios_icon_name="plus" android_material_icon_name="add" color={colors.primary} />
    </Pressable>
  );
}

export function HeaderLeftButton() {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={() => Alert.alert("Not Implemented", "This feature is not implemented yet")}
      style={styles.headerButtonContainer}
    >
      <IconSymbol ios_icon_name="gear" android_material_icon_name="settings" color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerButtonContainer: {
    padding: 6,
  },
});
