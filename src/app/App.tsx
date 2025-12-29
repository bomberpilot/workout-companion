import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AuthProvider from "../auth/AuthProvider";
import RootNavigator from "../navigation/RootNavigator";
import { ThemeProvider, useTheme } from "../theme/ThemeProvider";
import { toNavigationTheme } from "../theme/navigationTheme";

function AppNav() {
  const theme = useTheme();
  return (
    <NavigationContainer theme={toNavigationTheme(theme)}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppNav />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
