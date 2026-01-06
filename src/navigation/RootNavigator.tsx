import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../auth/useAuth";

import SignInScreen from "../screens/SignInScreen";
import HomeScreen from "../screens/HomeScreen";
import CreateGroupScreen from "../screens/CreateGroupScreen";
import JoinGroupScreen from "../screens/JoinGroupScreen";
import GroupChatScreen from "../screens/GroupChatScreen";
import GoalSetupScreen from "../screens/GoalSetupScreen";
import GoalEditScreen from "../screens/GoalEditScreen";
import ProfileScreen from "../screens/ProfileScreen";
import MemberProfileScreen from "../screens/MemberProfileScreen";
import GroupProgressScreen from "../screens/GroupProgressScreen";
import SettingsScreen from "../screens/SettingsScreen";

export type RootStackParamList = {
  SignIn: undefined;
  Home: undefined;
  CreateGroup: undefined;
  JoinGroup: undefined;
  Chat: { groupId: string };
  GroupProgress: { groupId: string };
  GoalSetup: { groupId: string };
  GoalEdit: { groupId: string; userId: string };
  Profile: undefined;
  MemberProfile: { groupId: string; userId: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) return null;

  return (
    <Stack.Navigator>
      {!user ? (
        <Stack.Screen
          name="SignIn"
          component={SignInScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: "Workout Accountability Companion" }}
          />
          <Stack.Screen
            name="CreateGroup"
            component={CreateGroupScreen}
            options={{ title: "Create group" }}
          />
          <Stack.Screen
            name="JoinGroup"
            component={JoinGroupScreen}
            options={{ title: "Join group" }}
          />
          <Stack.Screen
            name="Chat"
            component={GroupChatScreen}
            options={{ title: "Group chat" }}
          />
          <Stack.Screen
            name="GroupProgress"
            component={GroupProgressScreen}
            options={{ title: "Group progress" }}
          />
          <Stack.Screen
            name="GoalSetup"
            component={GoalSetupScreen}
            options={{ title: "Your goal" }}
          />
          <Stack.Screen
            name="GoalEdit"
            component={GoalEditScreen}
            options={{ title: "Edit goal" }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ title: "Profile" }}
          />
          <Stack.Screen
            name="MemberProfile"
            component={MemberProfileScreen}
            options={{ title: "Member Summary" }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: "Settings" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
