import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, TextInput } from "react-native";
import { ShieldAlert, PhoneCall, Heart, Award, ShieldCheck, ChevronRight } from "lucide-react-native";

export default function SafetyScreen() {
  const [bloodType, setBloodType] = useState("O+");
  const [allergies, setAllergies] = useState("Penicillin, Peanuts");
  const [medications, setMedications] = useState("Lisinopril 10mg daily");
  const [emergencyContact, setEmergencyContact] = useState("Jane Doe (Spouse) - 555-0199");
  
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
            Medical ID details are stored locally and accessible offline for emergency responders.
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

        {/* One-tap Emergency Share */}
        <Pressable style={styles.shareBtn} onPress={() => alert("Generating emergency Medical ID summary card...")}>
          <PhoneCall size={16} color="#050b08" style={{ marginRight: 8 }} />
          <Text style={styles.shareBtnText}>One-Tap Emergency Share</Text>
        </Pressable>
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
    gap: 20,
  },
  alertBanner: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 16,
    padding: 14,
  },
  alertText: {
    color: "#ef4444",
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
    fontWeight: "bold",
  },
  card: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 20,
    gap: 15,
  },
  cardTitle: {
    color: "#f8fafc",
    fontSize: 14,
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
  },
  input: {
    backgroundColor: "#050b08",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    height: 44,
    color: "#f8fafc",
    paddingHorizontal: 14,
    fontSize: 14,
  },
  shareBtn: {
    backgroundColor: "#10b981",
    height: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtnText: {
    color: "#050b08",
    fontSize: 14,
    fontWeight: "bold",
  },
});
