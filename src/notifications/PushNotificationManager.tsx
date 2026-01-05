import { useEffect } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { arrayUnion, serverTimestamp, setDoc } from "firebase/firestore";

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

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      if (!token || !isMounted) return;

      await setDoc(
        userSettingsDoc(user.uid),
        {
          expoPushTokens: arrayUnion(token),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    };

    register();

    return () => {
      isMounted = false;
    };
  }, [user]);

  return null;
}
