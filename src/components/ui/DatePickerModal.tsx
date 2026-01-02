import React, { useEffect, useMemo, useState } from "react";
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
  dt.setFullYear(y || dt.getFullYear());
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
  maxDateISO,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  initialDateISO: string;
  minDateISO?: string;
  maxDateISO?: string;
  onClose: () => void;
  onSelect: (iso: string) => void;
}) {
  const [temp, setTemp] = useState<Date>(() => dateFromISO(initialDateISO));

  useEffect(() => {
    if (visible) setTemp(dateFromISO(initialDateISO));
  }, [visible, initialDateISO]);

  const minDate = useMemo(() => (minDateISO ? dateFromISO(minDateISO) : undefined), [minDateISO]);
  const maxDate = useMemo(() => (maxDateISO ? dateFromISO(maxDateISO) : undefined), [maxDateISO]);

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
        {/* Backdrop: only this closes the modal */}
        <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />

        {/* Sheet */}
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
              // iOS: inline is great, but can be unreadable under some themes; compact is more robust
              display={Platform.OS === "ios" ? "compact" : "default"}
              minimumDate={minDate}
              maximumDate={maxDate}
              // Ensures readable picker on iOS even if device is in dark mode
              themeVariant="light"
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
      </View>
    </Modal>
  );
}
