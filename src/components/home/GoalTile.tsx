import React, { useMemo } from "react";
import { Text, Pressable, View } from "react-native";
import Tile from "../ui/Tile";

function formatCalendar(goalDateISO?: string) {
  // goalDateISO expected "YYYY-MM-DD"
  if (!goalDateISO || goalDateISO.length < 10) return { mon: "—", day: "—" };
  const [y, m, d] = goalDateISO.split("-").map((x) => Number(x));
  if (!y || !m || !d) return { mon: "—", day: "—" };
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] ?? "—";
  return { mon, day: String(d) };
}

export default function GoalTile({
  title,
  subtitle,
  progressText,
  progressRatio,
  goalDateISO,
  onPress,
  width,
}: {
  title: string;
  subtitle: string;
  progressText: string;
  progressRatio: number; // 0..1
  goalDateISO?: string;
  onPress: () => void;
  width: number;
}) {
  const pct = Math.max(0, Math.min(1, progressRatio || 0));
  const cal = useMemo(() => formatCalendar(goalDateISO), [goalDateISO]);

  return (
    <Pressable onPress={onPress} style={{ width }}>
      <Tile style={{ marginHorizontal: 8, marginVertical: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: "900" }} numberOfLines={1}>
              {title}
            </Text>
            <Text style={{ opacity: 0.7, marginTop: 4 }} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>

          {/* Tiny calendar preview */}
          <View
            style={{
              width: 54,
              borderRadius: 14,
              backgroundColor: "#111",
              overflow: "hidden",
              alignItems: "center",
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: "white", opacity: 0.85, fontWeight: "900", fontSize: 12 }}>{cal.mon}</Text>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 18, marginTop: 2 }}>{cal.day}</Text>
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "800" }}>{progressText}</Text>
          <Text style={{ opacity: 0.6, marginTop: 4 }}>Tap to open group</Text>
        </View>

        <View
          style={{
            height: 8,
            borderRadius: 999,
            backgroundColor: "#e8e8e8",
            marginTop: 12,
            overflow: "hidden",
          }}
        >
          <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: "#111" }} />
        </View>
      </Tile>
    </Pressable>
  );
}
