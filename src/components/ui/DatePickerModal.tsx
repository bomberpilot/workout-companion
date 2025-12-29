import React, { useMemo, useState } from "react";
import { Modal, View, Text, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

function isoFromDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateFromISO(iso: string) {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date();
  dt.setFullYear(y);
  dt.setMonth((m || 1) - 1);
  dt.setDate(d || 1);
  dt.setHours(12, 0, 0, 0);
  return dt;
}

export default function DatePickerModal({
  visible,
  title,
  initialDateISO,
  minDateISO,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  initialDateISO: string;
  minDateISO?: string;
  onClose: () => void;
  onSelect: (iso: string) => void;
}) {
  const [temp, setTemp] = useState<Date>(() => dateFromISO(initialDateISO));

  const minDate = useMemo(() => (minDateISO ? dateFromISO(minDateISO) : undefined), [minDateISO]);

  // Keep temp in sync when opening
  React.useEffect(() => {
    if (visible) setTemp(dateFromISO(initialDateISO));
  }, [visible, initialDateISO]);

  const body = (
    <View
      style={{
        backgroundColor: "white",
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        padding: 16,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "900" }}>{title}</Text>

      <View style={{ marginTop: 12 }}>
        <DateTimePicker
          value={temp}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          minimumDate={minDate}
          onChange={(_, d) => {
            if (d) setTemp(d);
          }}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <Pressable
          onPress={onClose}
          style={{
            flex: 1,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#ddd",
            backgroundColor: "white",
          }}
        >
          <Text style={{ fontWeight: "900" }}>Cancel</Text>
        </Pressable>

        <Pressable
          onPress={() => onSelect(isoFromDate(temp))}
          style={{
            flex: 1,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
            backgroundColor: "#111",
          }}
        >
          <Text style={{ fontWeight: "900", color: "white" }}>Select</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}
      >
        <Pressable onPress={() => {}} style={{ width: "100%" }}>
          {body}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
