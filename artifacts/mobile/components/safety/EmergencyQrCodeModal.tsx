import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Platform,
} from "react-native";
import Svg, { Rect } from "react-native-svg";
import {
  ShieldAlert,
  QrCode,
  Share2,
  Copy,
  Check,
  X,
  PhoneCall,
  Heart,
  AlertTriangle,
} from "lucide-react-native";
import { registerBackHandler } from "@/services/backNavigation";
import { generateQrMatrix } from "./qrEncoder";
import THEME from "@/constants/theme";

interface EmergencyQrCodeModalProps {
  visible: boolean;
  onClose: () => void;
  patientName: string;
  bloodType: string;
  codeStatus: string;
  organDonor: boolean;
  allergies: string[];
  medications: string[];
  conditions: string[];
  emergencyNotes?: string;
  primaryContact?: {
    name: string;
    relationship: string;
    phoneNumber: string;
  };
  physician?: {
    name: string;
    phone: string;
  };
  insurancePolicyId?: string;
  onCallNumber?: (phone: string, name?: string) => void;
}

export function EmergencyQrCodeModal({
  visible,
  onClose,
  patientName,
  bloodType,
  codeStatus,
  organDonor,
  allergies,
  medications,
  conditions,
  emergencyNotes,
  primaryContact,
  physician,
  insurancePolicyId,
  onCallNumber,
}: EmergencyQrCodeModalProps) {
  const [copiedToast, setCopiedToast] = useState(false);

  // Register hardware back navigation to dismiss modal
  useEffect(() => {
    if (!visible) return;
    return registerBackHandler("emergency-qr-modal", 100, () => {
      onClose();
      return true;
    });
  }, [visible, onClose]);

  // Format emergency payload for QR code & clipboard
  const emergencyBriefText = useMemo(() => {
    return [
      `🚨 LUMEN EMERGENCY MEDICAL PASSPORT 🚨`,
      `Patient: ${patientName || "Lumen Member"}`,
      `Blood Type: ${bloodType || "Unknown"}`,
      `Resuscitation: ${codeStatus || "Full Code"}`,
      `Organ Donor: ${organDonor ? "YES" : "NO"}`,
      `Allergies: ${allergies.length > 0 ? allergies.join(", ") : "NKDA (None Known)"}`,
      `Medications: ${medications.length > 0 ? medications.join(", ") : "None Reported"}`,
      `Conditions: ${conditions.length > 0 ? conditions.join(", ") : "None Reported"}`,
      emergencyNotes ? `Emergency Notes: "${emergencyNotes}"` : null,
      primaryContact ? `ICE Contact: ${primaryContact.name} (${primaryContact.relationship}) - ${primaryContact.phoneNumber}` : null,
      physician?.name ? `Physician: ${physician.name} - ${physician.phone}` : null,
      insurancePolicyId ? `Insurance Policy: ${insurancePolicyId}` : null,
      `Verified by Lumen Health OS • Offline Paramedic Triage Standard`,
    ]
      .filter(Boolean)
      .join("\n");
  }, [
    patientName,
    bloodType,
    codeStatus,
    organDonor,
    allergies,
    medications,
    conditions,
    emergencyNotes,
    primaryContact,
    physician,
    insurancePolicyId,
  ]);

  // Generate 41x41 QR Code matrix
  const qrMatrix = useMemo(() => {
    try {
      return generateQrMatrix(emergencyBriefText);
    } catch {
      return [];
    }
  }, [emergencyBriefText]);

  // Share Brief via Native Sheet
  const handleShareBrief = async () => {
    try {
      await Share.share({
        title: `Lumen Emergency Medical Brief - ${patientName}`,
        message: emergencyBriefText,
      });
    } catch (e) {
      console.warn("Share failed:", e);
    }
  };

  const qrSize = 220;
  const moduleCount = qrMatrix.length || 41;
  const cellSize = qrSize / moduleCount;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.cardContainer}>
          {/* Crimson Header Bar */}
          <View style={styles.headerBar}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <ShieldAlert size={20} color="#ffffff" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  PARAMEDIC EMERGENCY PASSPORT
                </Text>
                <Text style={styles.headerSub} numberOfLines={1}>
                  Optical QR • Offline Triage Specification
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={20} color="#ffffff" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Optical QR Code Box */}
            <View style={styles.qrContainer}>
              <View style={styles.qrWhiteCanvas}>
                {qrMatrix.length > 0 ? (
                  <Svg width={qrSize} height={qrSize}>
                    {qrMatrix.map((row, r) =>
                      row.map((cell, c) =>
                        cell ? (
                          <Rect
                            key={`${r}-${c}`}
                            x={c * cellSize}
                            y={r * cellSize}
                            width={cellSize}
                            height={cellSize}
                            fill="#050b08"
                          />
                        ) : null
                      )
                    )}
                  </Svg>
                ) : (
                  <View style={{ height: qrSize, justifyContent: "center", alignItems: "center" }}>
                    <QrCode size={48} color="#050b08" />
                    <Text style={{ color: "#050b08", fontWeight: "700", marginTop: 8 }}>
                      Generating QR Matrix...
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.qrScanInstruction}>
                Scan with any smartphone camera or paramedic scanner to read medical credentials instantly
              </Text>
            </View>

            {/* Critical Patient Vitals & Blood Type */}
            <View style={styles.vitalsRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.patientMetaLabel}>PATIENT IDENTIFIER</Text>
                <Text style={styles.patientMetaName} numberOfLines={1}>
                  {patientName || "Lumen User"}
                </Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  <View style={styles.codeStatusBadge}>
                    <Text style={styles.codeStatusText}>{codeStatus || "Full Code"}</Text>
                  </View>
                  {organDonor && (
                    <View style={styles.donorBadge}>
                      <Text style={styles.donorBadgeText}>ORGAN DONOR</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.bloodTypeBox}>
                <Text style={styles.bloodTypeLabel}>BLOOD</Text>
                <Text style={styles.bloodTypeVal}>{bloodType || "--"}</Text>
              </View>
            </View>

            {/* Allergies Warning */}
            <View style={styles.allergyWarningCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={16} color="#ef4444" />
                <Text style={styles.allergyTitle}>CRITICAL ALLERGIES & CONTRAINDICATIONS</Text>
              </View>
              <Text style={styles.allergyList}>
                {allergies.length > 0 ? allergies.join(" • ") : "No Known Drug Allergies (NKDA)"}
              </Text>
            </View>

            {/* Active Regimen */}
            <View style={styles.infoCard}>
              <Text style={styles.infoCardLabel}>ACTIVE MEDICATIONS</Text>
              <Text style={styles.infoCardVal}>
                {medications.length > 0 ? medications.join(" • ") : "None reported"}
              </Text>
            </View>

            {/* Conditions */}
            <View style={styles.infoCard}>
              <Text style={styles.infoCardLabel}>CHRONIC CONDITIONS & RESCUE NOTES</Text>
              <Text style={styles.infoCardVal}>
                {conditions.length > 0 ? conditions.join(" • ") : "None reported"}
              </Text>
              {emergencyNotes ? (
                <Text style={styles.notesText}>“{emergencyNotes}”</Text>
              ) : null}
            </View>

            {/* Primary ICE Contact with Direct Call */}
            {primaryContact && (
              <View style={styles.iceCard}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.iceLabel}>PRIMARY IN CASE OF EMERGENCY (ICE)</Text>
                  <Text style={styles.iceName} numberOfLines={1}>
                    {primaryContact.name} ({primaryContact.relationship})
                  </Text>
                  <Text style={styles.icePhone}>{primaryContact.phoneNumber}</Text>
                </View>
                {onCallNumber && (
                  <Pressable
                    style={styles.iceCallBtn}
                    onPress={() => onCallNumber(primaryContact.phoneNumber, primaryContact.name)}
                  >
                    <PhoneCall size={14} color="#ffffff" />
                    <Text style={styles.iceCallBtnText}>Call</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Action Buttons: Share & 911 */}
            <View style={styles.actionButtonsRow}>
              <Pressable style={styles.shareBtn} onPress={handleShareBrief}>
                <Share2 size={16} color="#ffffff" />
                <Text style={styles.shareBtnText}>Share Brief</Text>
              </Pressable>

              {onCallNumber && (
                <Pressable
                  style={styles.call911Btn}
                  onPress={() => onCallNumber("911", "National Emergency 911")}
                >
                  <PhoneCall size={16} color="#ffffff" />
                  <Text style={styles.call911BtnText}>CALL 911</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.88)",
    justifyContent: "flex-end",
  },
  cardContainer: {
    backgroundColor: "#08110d",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    borderWidth: 1.5,
    borderColor: "rgba(239, 68, 68, 0.4)",
    overflow: "hidden",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#b91c1c",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  headerSub: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 10,
    fontWeight: "600",
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
    gap: 14,
  },
  qrContainer: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
  },
  qrWhiteCanvas: {
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  qrScanInstruction: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
    maxWidth: 280,
  },
  vitalsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(16, 185, 129, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    borderRadius: 18,
    padding: 14,
  },
  patientMetaLabel: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  patientMetaName: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
  },
  codeStatusBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  codeStatusText: {
    color: "#38bdf8",
    fontSize: 10,
    fontWeight: "800",
  },
  donorBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  donorBadgeText: {
    color: "#34d399",
    fontSize: 10,
    fontWeight: "800",
  },
  bloodTypeBox: {
    width: 68,
    height: 60,
    borderRadius: 14,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },
  bloodTypeLabel: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  bloodTypeVal: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  allergyWarningCard: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  allergyTitle: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  allergyList: {
    color: "#fecaca",
    fontSize: 13,
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  infoCardLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  infoCardVal: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
  },
  notesText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  iceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  iceLabel: {
    color: "#10b981",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  iceName: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
  },
  icePhone: {
    color: "#34d399",
    fontSize: 13,
    fontWeight: "700",
  },
  iceCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  iceCallBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    marginBottom: Platform.OS === "ios" ? 20 : 10,
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 14,
    borderRadius: 16,
  },
  shareBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  call911Btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#dc2626",
    paddingVertical: 14,
    borderRadius: 16,
  },
  call911BtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
