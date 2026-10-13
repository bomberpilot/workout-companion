import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { arrayUnion, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { useAuth } from "../auth/useAuth";
import { userSettingsDoc } from "../firestore/paths";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,

    // Required by newer expo-notifications typings:
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function PushNotificationManager() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const register = async () => {
      if (!Device.isDevice) return;

      // Expo Go can run before this project is linked to EAS. In that case
      // there is no project to attribute a push token to.
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) return;

      const settingsRef = userSettingsDoc(user.uid);
      const settings = await getDoc(settingsRef);
      if (settings.data()?.notificationsEnabled === false) return;

      const existing = await Notifications.getPermissionsAsync();
      let finalStatus = existing.status;
      if (existing.status !== "granted") {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
      }

      if (finalStatus !== "granted") return;

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      if (!token || !isMounted) return;

      await setDoc(
        settingsRef,
        {
          expoPushTokens: arrayUnion(token),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    };

    void register().catch((error) => {
      if (__DEV__) console.warn("Push notification registration failed", error);
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  return null;
}
