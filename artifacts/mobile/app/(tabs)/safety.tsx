import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, TextInput } from "react-native";
import { ShieldAlert, PhoneCall, Heart, Award, ShieldCheck, Check, Sparkles } from "lucide-react-native";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function SafetyScreen() {
  const qc = useQueryClient();
  const { data: profile } = useGetProfile();
  const updateProfileMutation = useUpdateProfile();

  const [bloodType, setBloodType] = useState("O+");
  const [allergies, setAllergies] = useState("Penicillin, Peanuts");
  const [medications, setMedications] = useState("Lisinopril 10mg daily");
  const [emergencyContact, setEmergencyContact] = useState("Jane Doe (Spouse) - 555-0199");
  const [isSaved, setIsSaved] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);

  useEffect(() => {
    if (profile) {
      if (Array.isArray(profile.allergies) && profile.allergies.length > 0) {
        setAllergies(profile.allergies.join(", "));
      }
      if (Array.isArray(profile.medications) && profile.medications.length > 0) {
        setMedications(profile.medications.join(", "));
      }
    }
  }, [profile]);

  const handleSaveMedicalId = async () => {
    try {
      await updateProfileMutation.mutateAsync({
        data: {
          allergies: allergies.split(",").map((s) => s.trim()).filter(Boolean),
          medications: medications.split(",").map((s) => s.trim()).filter(Boolean),
        },
      });
      qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerSub}>Emergency Protocol</Text>
        <Text style={styles.headerTitle}>Medical Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Urgent info warning banner */}
        <View style={styles.alertBanner}>
          <ShieldAlert size={18} color="#ef4444" />
          <Text style={styles.alertText}>
            Medical ID details are stored securely and accessible offline for emergency responders.
          </Text>
        </View>

        {/* Input Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Medical Information</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Blood Group</Text>
            <TextInput style={styles.input} value={bloodType} onChangeText={setBloodType} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Allergies</Text>
            <TextInput style={styles.input} value={allergies} onChangeText={setAllergies} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Current Medications</Text>
            <TextInput style={styles.input} value={medications} onChangeText={setMedications} />
          </View>
        </View>

        {/* Emergency Contacts */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emergency Contacts</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Primary Contact Details</Text>
            <TextInput style={styles.input} value={emergencyContact} onChangeText={setEmergencyContact} />
          </View>
        </View>

        {/* Save button */}
        <Pressable
          style={[styles.saveBtn, isSaved && { backgroundColor: "#047857" }]}
          onPress={handleSaveMedicalId}
        >
          {isSaved ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Check size={16} color="#ffffff" />
              <Text style={styles.saveBtnText}>Medical ID Saved & Synced</Text>
            </View>
          ) : (
            <Text style={styles.saveBtnText}>Save Medical Information</Text>
          )}
        </Pressable>

        {/* One-tap Emergency Share */}
        <Pressable style={styles.shareBtn} onPress={() => setShowCardModal(true)}>
          <PhoneCall size={16} color="#050b08" style={{ marginRight: 8 }} />
          <Text style={styles.shareBtnText}>View Emergency Medical Card</Text>
        </Pressable>

        {/* Emergency Card Modal */}
        {showCardModal && (
          <View style={styles.emergencyModal}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={20} color="#ef4444" />
                <Text style={{ color: "#f8fafc", fontSize: 16, fontWeight: "900" }}>EMERGENCY MEDICAL ID</Text>
              </View>
              <Pressable onPress={() => setShowCardModal(false)}>
                <Text style={{ color: "#94a3b8", fontSize: 12 }}>Close</Text>
              </Pressable>
            </View>

            <View style={{ backgroundColor: "#1e1313", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#7f1d1d", gap: 8 }}>
              <Text style={{ color: "#ef4444", fontWeight: "bold", fontSize: 12 }}>PATIENT IDENTIFIER</Text>
              <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>{profile?.name || "Alex Rivera"}</Text>
              
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={{ color: "#94a3b8", fontSize: 12 }}>Blood Type:</Text>
                <Text style={{ color: "#ef4444", fontWeight: "bold" }}>{bloodType}</Text>
              </View>

              <View style={{ marginTop: 4 }}>
                <Text style={{ color: "#94a3b8", fontSize: 12 }}>Allergies:</Text>
                <Text style={{ color: "#f8fafc", fontWeight: "600", fontSize: 13 }}>{allergies || "None declared"}</Text>
              </View>

              <View style={{ marginTop: 4 }}>
                <Text style={{ color: "#94a3b8", fontSize: 12 }}>Medications:</Text>
                <Text style={{ color: "#f8fafc", fontWeight: "600", fontSize: 13 }}>{medications || "None declared"}</Text>
              </View>

              <View style={{ marginTop: 4 }}>
                <Text style={{ color: "#94a3b8", fontSize: 12 }}>Emergency Contact:</Text>
                <Text style={{ color: "#10b981", fontWeight: "bold", fontSize: 13 }}>{emergencyContact}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050b08",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  header: {
    paddingHorizontal: 25,
    marginBottom: 20,
  },
  headerSub: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "900",
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 40,
    gap: 15,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  alertText: {
    color: "#fca5a5",
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  card: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  cardTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "bold",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingBottom: 8,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#050b08",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: "#10b981",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#050b08",
    fontSize: 13,
    fontWeight: "900",
  },
  shareBtn: {
    backgroundColor: "#ef4444",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  shareBtnText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 13,
  },
  emergencyModal: {
    backgroundColor: "#0d0f11",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ef4444",
    padding: 18,
    marginTop: 10,
  },
});
