import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  TextInput,
  Modal,
  Alert,
  Linking,
  Share,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  ShieldAlert,
  PhoneCall,
  Phone,
  Heart,
  ShieldCheck,
  Check,
  Plus,
  Trash2,
  Edit3,
  User,
  AlertTriangle,
  X,
  Copy,
  ExternalLink,
  Menu,
  Activity,
  FileText,
  Sparkles,
  ChevronRight,
  Stethoscope,
  QrCode,
  Share2,
  Send,
  Pill,
  Shield,
  Hospital,
} from "lucide-react-native";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { storage } from "@/services/storage";
import { getKV, setKV } from "@/services/db";
import { getStoredClinicalProfile } from "@/services/clinicalProfile";
import { useSlideMenu } from "@/context/SlideMenuContext";
import THEME from "@/constants/theme";
import { registerBackHandler } from "@/services/backNavigation";
import { evaluateMedicationSafety, SafetyEvaluationResult } from "@/services/clinicalSafetyEngine";
import { EmergencyQrCodeModal } from "@/components/safety/EmergencyQrCodeModal";

// ============================================================================
// EMERGENCY CONTACT & MEDICAL ID INTERFACES
// ============================================================================

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string; // "Spouse" | "Parent" | "Doctor" | "Hospital" | "Family" | "Other"
  phoneNumber: string;
  isPrimary?: boolean;
  notes?: string;
}

export interface MedicalProfileData {
  bloodType: string;
  allergies: string[];
  medications: string[];
  conditions: string[];
  organDonor: boolean;
  codeStatus?: string; // "Full Code" | "DNR" | "DNI" | "Comfort Measures"
  emergencyNotes: string;
  physicianName?: string;
  physicianPhone?: string;
  hospitalName?: string;
  hospitalPhone?: string;
  insuranceProvider?: string;
  insurancePolicyId?: string;
}

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

const CODE_STATUS_OPTIONS = [
  { id: "Full Code", label: "Full Code (CPR & Intubation)", badge: "Full Code" },
  { id: "DNR", label: "DNR (Do Not Resuscitate)", badge: "DNR" },
  { id: "DNI", label: "DNI (Do Not Intubate)", badge: "DNI" },
  { id: "Comfort Measures", label: "Comfort Measures Only", badge: "Comfort" },
];

const RELATIONSHIP_TYPES = [
  "Spouse / Partner",
  "Parent / Guardian",
  "Family / Child",
  "Doctor / Physician",
  "Hospital / Clinic",
  "Caregiver",
  "Friend / Neighbor",
  "Other",
];

const DEFAULT_CONTACTS: EmergencyContact[] = [];

const EMPTY_MEDICAL_PROFILE: MedicalProfileData = {
  bloodType: "",
  allergies: [],
  medications: [],
  conditions: [],
  organDonor: false,
  codeStatus: "Full Code",
  emergencyNotes: "",
  physicianName: "",
  physicianPhone: "",
  hospitalName: "",
  hospitalPhone: "",
  insuranceProvider: "",
  insurancePolicyId: "",
};

export default function SafetyScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { openLeftMenu } = useSlideMenu();
  const { data: profile } = useGetProfile();
  const updateProfileMutation = useUpdateProfile();

  // Active view section: 3-tab architecture ("contacts" | "medical_id" | "rx_shield")
  const [activeSection, setActiveSection] = useState<"contacts" | "medical_id" | "rx_shield">("contacts");

  // Emergency Contacts State
  const [contacts, setContacts] = useState<EmergencyContact[]>(DEFAULT_CONTACTS);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  // Contact Form Inputs
  const [formName, setFormName] = useState("");
  const [formRelationship, setFormRelationship] = useState("Spouse / Partner");
  const [formPhone, setFormPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formIsPrimary, setFormIsPrimary] = useState(false);

  // Medical Profile State
  const [medicalData, setMedicalData] = useState<MedicalProfileData>(EMPTY_MEDICAL_PROFILE);
  const [newAllergyInput, setNewAllergyInput] = useState("");
  const [newMedicationInput, setNewMedicationInput] = useState("");
  const [newConditionInput, setNewConditionInput] = useState("");

  // Modals & Feedback
  const [showEmergencyCard, setShowEmergencyCard] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isSavedBanner, setIsSavedBanner] = useState(false);
  const [dialFeedback, setDialFeedback] = useState<string | null>(null);
  const [sosFeedback, setSosFeedback] = useState<string | null>(null);

  // Real-time Clinical Safety & Drug Interaction Engine
  const rxSafety = useMemo(() => {
    return evaluateMedicationSafety(
      medicalData.medications,
      medicalData.conditions,
      medicalData.allergies
    );
  }, [medicalData.medications, medicalData.conditions, medicalData.allergies]);

  // Primary Emergency Contact
  const primaryContact = useMemo(() => {
    return contacts.find((c) => c.isPrimary) || contacts[0];
  }, [contacts]);

  // Back press handler: dismiss modals or return to Home tab (Capacitor Android & native)
  useFocusEffect(
    useCallback(() => {
      return registerBackHandler("screen-safety", 40, () => {
        if (showContactModal) {
          setShowContactModal(false);
          return true;
        }
        if (showEmergencyCard) {
          setShowEmergencyCard(false);
          return true;
        }
        if (showQrModal) {
          setShowQrModal(false);
          return true;
        }
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)");
        }
        return true;
      });
    }, [router, showContactModal, showEmergencyCard, showQrModal])
  );

  // Load Saved Contacts & Medical Profile from Local Persistent Engine & DB
  useEffect(() => {
    async function loadData() {
      try {
        // 1. Emergency Contacts (with legacy mock data purging)
        const isMockContact = (c: any) =>
          c && (c.name === "Dr. Sarah Miller" || c.name === "Emily Rivera" || c.id === "contact-1" || c.id === "contact-2");

        let loadedContacts: EmergencyContact[] = [];
        const storedContacts = await storage.getItem("lumen_emergency_contacts");
        if (storedContacts) {
          try {
            const parsed = JSON.parse(storedContacts);
            if (Array.isArray(parsed)) {
              loadedContacts = parsed.filter((c: EmergencyContact) => !isMockContact(c));
            }
          } catch {}
        } else {
          const kvContacts = await getKV("lumen_emergency_contacts");
          if (kvContacts) {
            try {
              const parsed = JSON.parse(kvContacts);
              if (Array.isArray(parsed)) {
                loadedContacts = parsed.filter((c: EmergencyContact) => !isMockContact(c));
              }
            } catch {}
          }
        }

        setContacts(loadedContacts);
        if (storedContacts) {
          try {
            const parsed = JSON.parse(storedContacts);
            if (Array.isArray(parsed) && parsed.some(isMockContact)) {
              const cleanedJson = JSON.stringify(loadedContacts);
              await storage.setItem("lumen_emergency_contacts", cleanedJson);
              await setKV("lumen_emergency_contacts", cleanedJson);
            }
          } catch {}
        }

        // 2. Medical Profile (with legacy mock data purging)
        let loadedMed: MedicalProfileData = { ...EMPTY_MEDICAL_PROFILE };
        const isMockProfile = (m: any) =>
          m && (m.physicianName === "Dr. Sarah Miller" || m.insurancePolicyId === "LMN-98234-X" || (Array.isArray(m.allergies) && m.allergies.includes("Penicillin") && m.allergies.includes("Peanuts")));

        const storedMed = await storage.getItem("lumen_medical_profile");
        if (storedMed) {
          try {
            const parsed = JSON.parse(storedMed);
            if (parsed && typeof parsed === "object" && !isMockProfile(parsed)) {
              loadedMed = { ...EMPTY_MEDICAL_PROFILE, ...parsed };
            }
          } catch {}
        } else {
          const kvMed = await getKV("lumen_medical_profile");
          if (kvMed) {
            try {
              const parsed = JSON.parse(kvMed);
              if (parsed && typeof parsed === "object" && !isMockProfile(parsed)) {
                loadedMed = { ...EMPTY_MEDICAL_PROFILE, ...parsed };
              }
            } catch {}
          }
        }

        if (profile) {
          const p = profile as any;
          if (Array.isArray(p.allergies) && p.allergies.length > 0) {
            loadedMed.allergies = p.allergies;
          }
          if (Array.isArray(p.medications) && p.medications.length > 0) {
            loadedMed.medications = p.medications;
          }
        }

        // Sync with clinical health profile if conditions exist
        try {
          const storedClinical = await getStoredClinicalProfile();
          if (storedClinical && Array.isArray(storedClinical.conditions)) {
            const mapped = storedClinical.conditions
              .filter((c) => c !== "standard")
              .map((c) => {
                if (c === "diabetes") return "Diabetes";
                if (c === "pregnancy") return "Pregnancy";
                if (c === "hypertension") return "Hypertension";
                if (c === "heart_health") return "Cardiovascular";
                return c;
              });
            for (const m of mapped) {
              if (!loadedMed.conditions.includes(m)) {
                loadedMed.conditions.push(m);
              }
            }
          }
        } catch {}

        setMedicalData(loadedMed);
        if (storedMed) {
          try {
            const parsed = JSON.parse(storedMed);
            if (isMockProfile(parsed)) {
              await storage.setItem("lumen_medical_profile", JSON.stringify(loadedMed));
              await setKV("lumen_medical_profile", JSON.stringify(loadedMed));
            }
          } catch {}
        }
      } catch (err) {
        console.warn("Error loading safety data:", err);
      }
    }
    loadData();
  }, [profile]);

  // Persist Emergency Contacts
  const persistContacts = async (updated: EmergencyContact[]) => {
    setContacts(updated);
    try {
      const json = JSON.stringify(updated);
      await storage.setItem("lumen_emergency_contacts", json);
      await setKV("lumen_emergency_contacts", json);
    } catch (e) {
      console.warn("Failed persisting emergency contacts:", e);
    }
  };

  // Persist Medical Profile
  const persistMedicalProfile = async (updated: MedicalProfileData) => {
    setMedicalData(updated);
    try {
      const json = JSON.stringify(updated);
      await storage.setItem("lumen_medical_profile", json);
      await setKV("lumen_medical_profile", json);

      // Also sync allergies & medications to backend user profile
      await updateProfileMutation.mutateAsync({
        data: {
          allergies: updated.allergies,
          medications: updated.medications,
        } as any,
      });
      qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });

      setIsSavedBanner(true);
      setTimeout(() => setIsSavedBanner(false), 3000);
    } catch {
      setIsSavedBanner(true);
      setTimeout(() => setIsSavedBanner(false), 3000);
    }
  };

  /**
   * DIRECT PHONE CALL DISPATCH
   * Cleans the number and opens the native device phone dialer via tel: scheme.
   * Works whether the number is stored in the phone's address book or not!
   */
  const handleCallNumber = async (phoneNumber: string, contactName?: string) => {
    if (!phoneNumber) {
      Alert.alert("Invalid Number", "No phone number provided.");
      return;
    }

    const cleanNumber = phoneNumber.replace(/[^0-9+*#]/g, "");
    if (!cleanNumber) {
      Alert.alert("Invalid Number", "Phone number contains no dialable digits.");
      return;
    }

    const telUrl = `tel:${cleanNumber}`;

    try {
      const supported = await Linking.canOpenURL(telUrl);
      if (supported || Platform.OS === "android") {
        setDialFeedback(`Redirecting to phone dialer: ${cleanNumber}...`);
        await Linking.openURL(telUrl);
        setTimeout(() => setDialFeedback(null), 4000);
      } else {
        Alert.alert(
          "Dialer Unavailable",
          `Unable to open phone app directly. Number extracted from Lumen: ${cleanNumber}`,
          [
            { text: "Dismiss", style: "cancel" },
            {
              text: "Copy Number",
              onPress: () => {
                setDialFeedback(`Extracted & copied: ${cleanNumber}`);
                setTimeout(() => setDialFeedback(null), 4000);
              },
            },
          ]
        );
      }
    } catch (err: any) {
      try {
        await Linking.openURL(telUrl);
      } catch {
        Alert.alert(
          "Phone Call Redirection",
          `Contact: ${contactName || "Emergency Number"}\nPhone: ${cleanNumber}\n\nNumber extracted from app.`,
          [{ text: "OK" }]
        );
      }
    }
  };

  /**
   * 1-TAP EMERGENCY SOS TELEMETRY & SMS DISPATCH
   * Pre-formats an emergency SOS message with patient credentials, code status,
   * allergies, conditions, and launches device SMS app directly to primary contact.
   */
  const handleSendSosSms = async () => {
    const recipientPhone = primaryContact?.phoneNumber || "911";
    const emergencyMessage = [
      `🚨 EMERGENCY SOS from Lumen Health OS:`,
      `${profile?.name || "Patient"} requires immediate medical assistance!`,
      `Blood Type: ${medicalData.bloodType || "Unknown"} | Resuscitation: ${medicalData.codeStatus || "Full Code"}`,
      medicalData.allergies.length > 0 ? `Critical Allergies: ${medicalData.allergies.join(", ")}` : "Allergies: NKDA (None Known)",
      medicalData.conditions.length > 0 ? `Conditions: ${medicalData.conditions.join(", ")}` : null,
      medicalData.emergencyNotes ? `Rescue Notes: "${medicalData.emergencyNotes}"` : null,
      primaryContact ? `Primary ICE Contact: ${primaryContact.name} (${primaryContact.phoneNumber})` : null,
      `Please dispatch first responders or call immediately.`,
    ]
      .filter(Boolean)
      .join("\n");

    const cleanRecipient = recipientPhone.replace(/[^0-9+*#]/g, "");
    const smsUrl = Platform.OS === "ios"
      ? `sms:${cleanRecipient}&body=${encodeURIComponent(emergencyMessage)}`
      : `sms:${cleanRecipient}?body=${encodeURIComponent(emergencyMessage)}`;

    try {
      setSosFeedback(`Launching SOS SMS dispatch to ${primaryContact?.name || "Emergency Contact"}...`);
      await Linking.openURL(smsUrl);
      setTimeout(() => setSosFeedback(null), 5000);
    } catch {
      try {
        await Share.share({
          title: "EMERGENCY SOS BROADCAST",
          message: emergencyMessage,
        });
      } catch {
        Alert.alert("Emergency SOS Payload", emergencyMessage);
      }
    }
  };

  // Open modal to add or edit contact
  const handleOpenContactModal = (contact?: EmergencyContact) => {
    if (contact) {
      setEditingContact(contact);
      setFormName(contact.name);
      setFormRelationship(contact.relationship);
      setFormPhone(contact.phoneNumber);
      setFormNotes(contact.notes || "");
      setFormIsPrimary(Boolean(contact.isPrimary));
    } else {
      setEditingContact(null);
      setFormName("");
      setFormRelationship("Spouse / Partner");
      setFormPhone("");
      setFormNotes("");
      setFormIsPrimary(contacts.length === 0);
    }
    setShowContactModal(true);
  };

  // Save Contact from Form
  const handleSaveContactForm = () => {
    if (!formName.trim()) {
      Alert.alert("Missing Name", "Please enter the contact or organization name.");
      return;
    }
    if (!formPhone.trim()) {
      Alert.alert("Missing Phone", "Please enter a valid phone number.");
      return;
    }

    let updatedList: EmergencyContact[];

    if (editingContact) {
      updatedList = contacts.map((c) => {
        if (c.id === editingContact.id) {
          return {
            ...c,
            name: formName.trim(),
            relationship: formRelationship,
            phoneNumber: formPhone.trim(),
            notes: formNotes.trim(),
            isPrimary: formIsPrimary,
          };
        }
        if (formIsPrimary && c.id !== editingContact.id) {
          return { ...c, isPrimary: false };
        }
        return c;
      });
    } else {
      const newContact: EmergencyContact = {
        id: `contact-${Date.now()}`,
        name: formName.trim(),
        relationship: formRelationship,
        phoneNumber: formPhone.trim(),
        notes: formNotes.trim(),
        isPrimary: formIsPrimary,
      };

      if (formIsPrimary) {
        updatedList = [newContact, ...contacts.map((c) => ({ ...c, isPrimary: false }))];
      } else {
        updatedList = [...contacts, newContact];
      }
    }

    persistContacts(updatedList);
    setShowContactModal(false);
  };

  // Delete Contact
  const handleDeleteContact = (id: string) => {
    Alert.alert(
      "Remove Emergency Contact",
      "Are you sure you want to remove this contact from your emergency protocol list?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            const filtered = contacts.filter((c) => c.id !== id);
            persistContacts(filtered);
          },
        },
      ]
    );
  };

  // Add Allergy Chip
  const handleAddAllergy = () => {
    if (!newAllergyInput.trim()) return;
    const item = newAllergyInput.trim();
    if (!medicalData.allergies.includes(item)) {
      persistMedicalProfile({
        ...medicalData,
        allergies: [...medicalData.allergies, item],
      });
    }
    setNewAllergyInput("");
  };

  // Remove Allergy Chip
  const handleRemoveAllergy = (item: string) => {
    persistMedicalProfile({
      ...medicalData,
      allergies: medicalData.allergies.filter((a) => a !== item),
    });
  };

  // Add Medication Chip
  const handleAddMedication = () => {
    if (!newMedicationInput.trim()) return;
    const item = newMedicationInput.trim();
    if (!medicalData.medications.includes(item)) {
      persistMedicalProfile({
        ...medicalData,
        medications: [...medicalData.medications, item],
      });
    }
    setNewMedicationInput("");
  };

  // Remove Medication Chip
  const handleRemoveMedication = (item: string) => {
    persistMedicalProfile({
      ...medicalData,
      medications: medicalData.medications.filter((m) => m !== item),
    });
  };

  // Add Condition Chip
  const handleAddCondition = () => {
    if (!newConditionInput.trim()) return;
    const item = newConditionInput.trim();
    if (!medicalData.conditions.includes(item)) {
      persistMedicalProfile({
        ...medicalData,
        conditions: [...medicalData.conditions, item],
      });
    }
    setNewConditionInput("");
  };

  // Remove Condition Chip
  const handleRemoveCondition = (item: string) => {
    persistMedicalProfile({
      ...medicalData,
      conditions: medicalData.conditions.filter((c) => c !== item),
    });
  };

  return (
    <View style={styles.container}>
      {/* ========================================================================= */}
      {/* TOP BAR & NAVIGATION */}
      {/* ========================================================================= */}
      <View style={styles.topBar}>
        <Pressable onPress={openLeftMenu} style={styles.menuBtn} accessibilityLabel="Open Menu">
          <Menu size={22} color="#f8fafc" />
        </Pressable>

        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          <Text style={styles.topBarSub} numberOfLines={1}>HEALTH OS PROTOCOL</Text>
          <Text style={styles.topBarTitle} numberOfLines={1}>Medical Safety & ID</Text>
        </View>
      </View>

      {/* Dial Feedback Banner */}
      {dialFeedback && (
        <View style={styles.feedbackBanner}>
          <PhoneCall size={14} color="#10b981" />
          <Text style={styles.feedbackText} numberOfLines={1}>{dialFeedback}</Text>
        </View>
      )}

      {/* SOS SMS Feedback Banner */}
      {sosFeedback && (
        <View style={[styles.feedbackBanner, { backgroundColor: "rgba(56, 189, 248, 0.15)", borderColor: "rgba(56, 189, 248, 0.3)" }]}>
          <Send size={14} color="#38bdf8" />
          <Text style={[styles.feedbackText, { color: "#38bdf8" }]} numberOfLines={1}>{sosFeedback}</Text>
        </View>
      )}

      {/* Save Success Banner */}
      {isSavedBanner && (
        <View style={styles.savedBanner}>
          <Check size={14} color="#050b08" strokeWidth={3} />
          <Text style={styles.savedBannerText} numberOfLines={1}>Medical ID Saved Locally & Synced</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ========================================================================= */}
        {/* TRI-ACTION EMERGENCY DISPATCH (911 / 112 / SOS SMS) */}
        {/* ========================================================================= */}
        <View style={styles.urgentAlertCard}>
          <View style={styles.urgentTopRow}>
            <View style={styles.sosIconBox}>
              <ShieldAlert size={20} color="#ef4444" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.urgentTitle} numberOfLines={1}>Instant Emergency Dispatch</Text>
              <Text style={styles.urgentSub}>
                1-tap direct dial or encrypted SOS SMS dispatch to emergency contacts
              </Text>
            </View>
          </View>

          <View style={styles.sosButtonsRow}>
            <Pressable
              style={[styles.sosCallBtn, { backgroundColor: "#dc2626" }]}
              onPress={() => handleCallNumber("911", "National Emergency 911")}
            >
              <PhoneCall size={15} color="#ffffff" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sosCallBtnTitle} numberOfLines={1}>CALL 911</Text>
                <Text style={styles.sosCallBtnSub} numberOfLines={1}>Ambulance</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.sosCallBtn, { backgroundColor: "#991b1b" }]}
              onPress={() => handleCallNumber("112", "Universal Emergency 112")}
            >
              <PhoneCall size={15} color="#ffffff" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sosCallBtnTitle} numberOfLines={1}>CALL 112</Text>
                <Text style={styles.sosCallBtnSub} numberOfLines={1}>Global</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.sosCallBtn, { backgroundColor: "#0284c7" }]}
              onPress={handleSendSosSms}
            >
              <Send size={15} color="#ffffff" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sosCallBtnTitle} numberOfLines={1}>SOS SMS</Text>
                <Text style={styles.sosCallBtnSub} numberOfLines={1}>ICE Contact</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 3-TAB SEGMENTED SWITCHER (Contacts / Medical ID / Rx Safety Shield) */}
        {/* ========================================================================= */}
        <View style={styles.segmentContainer}>
          <Pressable
            style={[styles.segmentBtn, activeSection === "contacts" && styles.segmentBtnActive]}
            onPress={() => setActiveSection("contacts")}
          >
            <Phone size={13} color={activeSection === "contacts" ? "#10b981" : "#64748b"} />
            <Text
              style={[
                styles.segmentBtnText,
                activeSection === "contacts" && styles.segmentBtnTextActive,
              ]}
              numberOfLines={1}
            >
              Contacts ({contacts.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentBtn, activeSection === "medical_id" && styles.segmentBtnActive]}
            onPress={() => setActiveSection("medical_id")}
          >
            <Heart size={13} color={activeSection === "medical_id" ? "#10b981" : "#64748b"} />
            <Text
              style={[
                styles.segmentBtnText,
                activeSection === "medical_id" && styles.segmentBtnTextActive,
              ]}
              numberOfLines={1}
            >
              Clinical ID
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentBtn, activeSection === "rx_shield" && styles.segmentBtnActive]}
            onPress={() => setActiveSection("rx_shield")}
          >
            <Shield size={13} color={activeSection === "rx_shield" ? (rxSafety.overallStatus === "critical" ? "#ef4444" : "#10b981") : "#64748b"} />
            <Text
              style={[
                styles.segmentBtnText,
                activeSection === "rx_shield" && styles.segmentBtnTextActive,
              ]}
              numberOfLines={1}
            >
              Rx Shield {rxSafety.alerts.length > 0 ? `(${rxSafety.alerts.length})` : ""}
            </Text>
          </Pressable>
        </View>

        {/* ========================================================================= */}
        {/* SECTION 1: EMERGENCY CONTACTS & DIALER */}
        {/* ========================================================================= */}
        {activeSection === "contacts" && (
          <View style={{ gap: 14 }}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                <Text style={styles.sectionTitle} numberOfLines={1}>Emergency Contacts</Text>
                <Text style={styles.sectionSub} numberOfLines={2}>
                  Tap Call on any contact to open phone dialer immediately
                </Text>
              </View>

              <Pressable style={styles.addContactBtn} onPress={() => handleOpenContactModal()}>
                <Plus size={14} color="#ffffff" strokeWidth={3} />
                <Text style={styles.addContactBtnText} numberOfLines={1}>Add Contact</Text>
              </Pressable>
            </View>

            {/* List of Contacts */}
            {contacts.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactTopRow}>
                  <View style={styles.contactAvatar}>
                    <User size={18} color="#10b981" />
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                      <Text style={styles.contactName} numberOfLines={1} ellipsizeMode="tail">{contact.name}</Text>
                      {contact.isPrimary && (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>PRIMARY ICE</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.contactRelationship} numberOfLines={1}>{contact.relationship}</Text>
                    <Text style={styles.contactPhone} numberOfLines={1}>{contact.phoneNumber}</Text>

                    {contact.notes ? (
                      <Text style={styles.contactNotes} numberOfLines={2} ellipsizeMode="tail">“{contact.notes}”</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.contactActionDivider} />

                <View style={styles.contactActionsRow}>
                  <Pressable
                    style={styles.callActionBtn}
                    onPress={() => handleCallNumber(contact.phoneNumber, contact.name)}
                  >
                    <PhoneCall size={16} color="#ffffff" strokeWidth={2.5} />
                    <Text style={styles.callActionBtnText}>Call Now</Text>
                  </Pressable>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      style={styles.contactSmallIconBtn}
                      onPress={() => handleOpenContactModal(contact)}
                      accessibilityLabel="Edit Contact"
                    >
                      <Edit3 size={15} color="#94a3b8" />
                    </Pressable>

                    <Pressable
                      style={[styles.contactSmallIconBtn, { borderColor: "rgba(239, 68, 68, 0.3)" }]}
                      onPress={() => handleDeleteContact(contact.id)}
                      accessibilityLabel="Delete Contact"
                    >
                      <Trash2 size={15} color="#ef4444" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}

            {contacts.length === 0 && (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <ShieldCheck size={28} color="#10b981" />
                </View>
                <Text style={styles.emptyTitle}>No Emergency Contacts Added</Text>
                <Text style={styles.emptySub}>
                  Add trusted family members, physicians, or caregivers so you or first responders can reach them instantly in an emergency.
                </Text>
                <Pressable style={styles.addContactEmptyBtn} onPress={() => handleOpenContactModal()}>
                  <Plus size={16} color="#ffffff" strokeWidth={3} />
                  <Text style={styles.addContactEmptyBtnText}>Add Emergency Contact</Text>
                </Pressable>
              </View>
            )}

            {/* Offline Dialer Guarantee Card */}
            <View style={styles.infoBox}>
              <Sparkles size={16} color="#38bdf8" />
              <Text style={styles.infoBoxText}>
                <Text style={{ fontWeight: "bold", color: "#f8fafc" }}>Offline Native Redirection: </Text>
                Tapping Call automatically launches your mobile phone dialer with zero internet and even if the contact is not in your phone’s address book.
              </Text>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* SECTION 2: CLINICAL ID & FIRST RESPONDER DATA */}
        {/* ========================================================================= */}
        {activeSection === "medical_id" && (
          <View style={{ gap: 16 }}>
            {/* Blood Group Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Blood Group</Text>
                <View style={styles.bloodTypeActivePill}>
                  <Text style={styles.bloodTypeActivePillText}>
                    {medicalData.bloodType || "Not Set"}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSub}>Critical for emergency blood transfusions</Text>

              <View style={styles.bloodChipsGrid}>
                {BLOOD_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    style={[
                      styles.bloodChip,
                      medicalData.bloodType === type && styles.bloodChipActive,
                    ]}
                    onPress={() =>
                      persistMedicalProfile({
                        ...medicalData,
                        bloodType: medicalData.bloodType === type ? "" : type,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.bloodChipText,
                        medicalData.bloodType === type && styles.bloodChipTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Resuscitation Directives (Code Status) & Organ Donor */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Resuscitation Preference (Code Status)</Text>
              <Text style={styles.cardSub}>Emergency directive for paramedics & ICU triage</Text>

              <View style={{ gap: 8, marginTop: 10 }}>
                {CODE_STATUS_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.codeOptionRow,
                      medicalData.codeStatus === opt.id && styles.codeOptionRowActive,
                    ]}
                    onPress={() =>
                      persistMedicalProfile({
                        ...medicalData,
                        codeStatus: opt.id,
                      })
                    }
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.codeOptionTitle,
                          medicalData.codeStatus === opt.id && { color: "#38bdf8" },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.codeRadioCircle,
                        medicalData.codeStatus === opt.id && styles.codeRadioCircleActive,
                      ]}
                    >
                      {medicalData.codeStatus === opt.id && <View style={styles.codeRadioDot} />}
                    </View>
                  </Pressable>
                ))}
              </View>

              <View style={styles.organDonorRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.organDonorTitle}>Organ Donor Designation</Text>
                  <Text style={styles.organDonorSub}>Verified on first responder medical pass</Text>
                </View>
                <Pressable
                  style={[
                    styles.organDonorToggle,
                    medicalData.organDonor && styles.organDonorToggleActive,
                  ]}
                  onPress={() =>
                    persistMedicalProfile({
                      ...medicalData,
                      organDonor: !medicalData.organDonor,
                    })
                  }
                >
                  <Text
                    style={[
                      styles.organDonorToggleText,
                      medicalData.organDonor && { color: "#ffffff" },
                    ]}
                  >
                    {medicalData.organDonor ? "YES" : "NO"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Allergies & Adverse Reactions */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Allergies & Adverse Reactions</Text>
                <Text style={styles.badgeCount}>{medicalData.allergies.length}</Text>
              </View>
              <Text style={styles.cardSub}>Alerts first responders to avoid life-threatening anaphylaxis</Text>

              {medicalData.allergies.length > 0 ? (
                <View style={styles.tagsContainer}>
                  {medicalData.allergies.map((allergy) => (
                    <View key={allergy} style={styles.allergyTag}>
                      <Text style={styles.allergyTagText} numberOfLines={1}>{allergy}</Text>
                      <Pressable onPress={() => handleRemoveAllergy(allergy)} hitSlop={8}>
                        <X size={12} color="#fca5a5" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyTagNotice}>No known drug allergies (NKDA). Add below if applicable.</Text>
              )}

              <View style={styles.addTagRow}>
                <TextInput
                  style={styles.tagInput}
                  placeholder="Add allergy (e.g. Penicillin, Peanuts)"
                  placeholderTextColor="#64748b"
                  value={newAllergyInput}
                  onChangeText={setNewAllergyInput}
                  onSubmitEditing={handleAddAllergy}
                />
                <Pressable style={styles.tagAddBtn} onPress={handleAddAllergy}>
                  <Plus size={16} color="#ffffff" />
                </Pressable>
              </View>
            </View>

            {/* Chronic Medical Conditions & Emergency Clinical Notes */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Medical Conditions & Clinical Notes</Text>
                <Text style={styles.badgeCount}>{medicalData.conditions.length}</Text>
              </View>
              <Text style={styles.cardSub}>Pre-existing health conditions or clinical history</Text>

              {medicalData.conditions.length > 0 ? (
                <View style={styles.tagsContainer}>
                  {medicalData.conditions.map((cond) => (
                    <View key={cond} style={styles.conditionTag}>
                      <Text style={styles.conditionTagText} numberOfLines={1}>{cond}</Text>
                      <Pressable onPress={() => handleRemoveCondition(cond)} hitSlop={8}>
                        <X size={12} color="#cbd5e1" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyTagNotice}>No chronic conditions logged yet.</Text>
              )}

              <View style={styles.addTagRow}>
                <TextInput
                  style={styles.tagInput}
                  placeholder="Add condition (e.g. Type 2 Diabetes, Hypertension)"
                  placeholderTextColor="#64748b"
                  value={newConditionInput}
                  onChangeText={setNewConditionInput}
                  onSubmitEditing={handleAddCondition}
                />
                <Pressable style={[styles.tagAddBtn, { backgroundColor: "#475569" }]} onPress={handleAddCondition}>
                  <Plus size={16} color="#ffffff" />
                </Pressable>
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>Emergency Rescue Notes</Text>
                <TextInput
                  style={[styles.tagInput, { minHeight: 60, textAlignVertical: "top" }]}
                  placeholder="Rescue instructions for first responders..."
                  placeholderTextColor="#64748b"
                  multiline
                  value={medicalData.emergencyNotes}
                  onChangeText={(val) => persistMedicalProfile({ ...medicalData, emergencyNotes: val })}
                />
              </View>
            </View>

            {/* Primary Physician & Emergency Hospital */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Physician & Preferred Trauma Center</Text>
              <Text style={styles.cardSub}>Doctor contact details and hospital destination</Text>

              <View style={styles.twoColInputs}>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <Text style={styles.fieldLabel}>Primary Physician</Text>
                  <TextInput
                    style={styles.tagInput}
                    placeholder="Doctor name"
                    placeholderTextColor="#64748b"
                    value={medicalData.physicianName}
                    onChangeText={(val) => persistMedicalProfile({ ...medicalData, physicianName: val })}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <Text style={styles.fieldLabel}>Physician Phone</Text>
                  <TextInput
                    style={styles.tagInput}
                    placeholder="Phone number"
                    placeholderTextColor="#64748b"
                    keyboardType="phone-pad"
                    value={medicalData.physicianPhone}
                    onChangeText={(val) => persistMedicalProfile({ ...medicalData, physicianPhone: val })}
                  />
                </View>
              </View>

              {medicalData.physicianPhone ? (
                <Pressable
                  style={styles.physicianCallBtn}
                  onPress={() => handleCallNumber(medicalData.physicianPhone!, medicalData.physicianName)}
                >
                  <PhoneCall size={14} color="#10b981" />
                  <Text style={styles.physicianCallBtnText} numberOfLines={1}>
                    Call Physician ({medicalData.physicianPhone})
                  </Text>
                </Pressable>
              ) : null}

              <View style={[styles.twoColInputs, { marginTop: 10 }]}>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <Text style={styles.fieldLabel}>Preferred Hospital</Text>
                  <TextInput
                    style={styles.tagInput}
                    placeholder="e.g. Memorial Trauma Center"
                    placeholderTextColor="#64748b"
                    value={medicalData.hospitalName}
                    onChangeText={(val) => persistMedicalProfile({ ...medicalData, hospitalName: val })}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <Text style={styles.fieldLabel}>Hospital ER Phone</Text>
                  <TextInput
                    style={styles.tagInput}
                    placeholder="ER phone"
                    placeholderTextColor="#64748b"
                    keyboardType="phone-pad"
                    value={medicalData.hospitalPhone}
                    onChangeText={(val) => persistMedicalProfile({ ...medicalData, hospitalPhone: val })}
                  />
                </View>
              </View>

              {medicalData.hospitalPhone ? (
                <Pressable
                  style={[styles.physicianCallBtn, { borderColor: "rgba(239, 68, 68, 0.3)", backgroundColor: "rgba(239, 68, 68, 0.08)" }]}
                  onPress={() => handleCallNumber(medicalData.hospitalPhone!, medicalData.hospitalName)}
                >
                  <Hospital size={14} color="#ef4444" />
                  <Text style={[styles.physicianCallBtnText, { color: "#ef4444" }]} numberOfLines={1}>
                    Call Hospital ER ({medicalData.hospitalPhone})
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* Health Insurance Credentials */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Health Insurance Credentials</Text>
              <Text style={styles.cardSub}>Expedites emergency admission and coverage verification</Text>

              <View style={styles.twoColInputs}>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <Text style={styles.fieldLabel}>Insurance Carrier</Text>
                  <TextInput
                    style={styles.tagInput}
                    placeholder="e.g. BlueCross, Aetna"
                    placeholderTextColor="#64748b"
                    value={medicalData.insuranceProvider}
                    onChangeText={(val) => persistMedicalProfile({ ...medicalData, insuranceProvider: val })}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <Text style={styles.fieldLabel}>Policy / Member ID</Text>
                  <TextInput
                    style={styles.tagInput}
                    placeholder="e.g. XEA-91823-01"
                    placeholderTextColor="#64748b"
                    value={medicalData.insurancePolicyId}
                    onChangeText={(val) => persistMedicalProfile({ ...medicalData, insurancePolicyId: val })}
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* SECTION 3: RX SAFETY SHIELD & DRUG CONTRAINDICATIONS */}
        {/* ========================================================================= */}
        {activeSection === "rx_shield" && (
          <View style={{ gap: 16 }}>
            {/* Clinical Regimen Status Banner */}
            <View
              style={[
                styles.shieldStatusCard,
                rxSafety.overallStatus === "critical" && styles.shieldStatusCardCritical,
                rxSafety.overallStatus === "high" && styles.shieldStatusCardHigh,
                rxSafety.overallStatus === "moderate" && styles.shieldStatusCardModerate,
                rxSafety.overallStatus === "safe" && styles.shieldStatusCardSafe,
              ]}
            >
              <View style={styles.shieldStatusHeader}>
                {rxSafety.overallStatus === "critical" && <ShieldAlert size={24} color="#ef4444" />}
                {rxSafety.overallStatus === "high" && <AlertTriangle size={24} color="#f97316" />}
                {rxSafety.overallStatus === "moderate" && <AlertTriangle size={24} color="#eab308" />}
                {rxSafety.overallStatus === "safe" && <ShieldCheck size={24} color="#10b981" />}

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.shieldStatusTitle,
                      rxSafety.overallStatus === "critical" && { color: "#ef4444" },
                      rxSafety.overallStatus === "high" && { color: "#f97316" },
                      rxSafety.overallStatus === "moderate" && { color: "#eab308" },
                      rxSafety.overallStatus === "safe" && { color: "#10b981" },
                    ]}
                  >
                    {rxSafety.overallStatus === "critical" && "Critical Interaction Detected"}
                    {rxSafety.overallStatus === "high" && "High Clinical Precaution Advised"}
                    {rxSafety.overallStatus === "moderate" && "Moderate Interaction Advisory"}
                    {rxSafety.overallStatus === "safe" && "Regimen Verified Safe"}
                  </Text>
                  <Text style={styles.shieldStatusSub}>
                    {rxSafety.alerts.length > 0
                      ? `${rxSafety.alerts.length} potential interaction(s) found across ${rxSafety.checkedMedicationsCount} logged medication(s).`
                      : `Zero contraindications found between your ${medicalData.medications.length} medication(s), ${medicalData.conditions.length} condition(s), and ${medicalData.allergies.length} allergy item(s).`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Active Medications Manager */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Active Prescriptions & Regimen</Text>
                <Text style={styles.badgeCount}>{medicalData.medications.length}</Text>
              </View>
              <Text style={styles.cardSub}>Logged medications are evaluated continuously for contraindications</Text>

              {medicalData.medications.length > 0 ? (
                <View style={styles.tagsContainer}>
                  {medicalData.medications.map((med) => (
                    <View key={med} style={styles.medTag}>
                      <Pill size={13} color="#93c5fd" />
                      <Text style={styles.medTagText} numberOfLines={1}>{med}</Text>
                      <Pressable onPress={() => handleRemoveMedication(med)} hitSlop={8}>
                        <X size={12} color="#93c5fd" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyTagNotice}>No medications logged yet. Add your daily prescriptions below.</Text>
              )}

              <View style={styles.addTagRow}>
                <TextInput
                  style={styles.tagInput}
                  placeholder="Add medication (e.g. Lisinopril 10mg, Metformin 500mg)"
                  placeholderTextColor="#64748b"
                  value={newMedicationInput}
                  onChangeText={setNewMedicationInput}
                  onSubmitEditing={handleAddMedication}
                />
                <Pressable style={[styles.tagAddBtn, { backgroundColor: "#2563eb" }]} onPress={handleAddMedication}>
                  <Plus size={16} color="#ffffff" />
                </Pressable>
              </View>
            </View>

            {/* Clinical Alerts List */}
            {rxSafety.alerts.length > 0 && (
              <View style={{ gap: 12 }}>
                <Text style={styles.clinicalAlertsHeader}>CLINICAL INTERACTION DETAILS</Text>
                {rxSafety.alerts.map((alert) => (
                  <View
                    key={alert.id}
                    style={[
                      styles.alertDetailCard,
                      alert.severity === "critical" && styles.alertDetailCardCritical,
                      alert.severity === "high" && styles.alertDetailCardHigh,
                      alert.severity === "moderate" && styles.alertDetailCardModerate,
                    ]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <AlertTriangle
                        size={16}
                        color={
                          alert.severity === "critical"
                            ? "#ef4444"
                            : alert.severity === "high"
                            ? "#f97316"
                            : "#eab308"
                        }
                      />
                      <Text
                        style={[
                          styles.alertDetailTitle,
                          alert.severity === "critical" && { color: "#ef4444" },
                          alert.severity === "high" && { color: "#f97316" },
                          alert.severity === "moderate" && { color: "#eab308" },
                        ]}
                      >
                        {alert.title}
                      </Text>
                    </View>

                    <Text style={styles.alertDetailDesc}>{alert.description}</Text>

                    <View style={styles.alertGuidanceBox}>
                      <Text style={styles.alertGuidanceLabel}>CLINICAL GUIDANCE:</Text>
                      <Text style={styles.alertGuidanceText}>{alert.clinicalGuidance}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Safe Medications List */}
            {rxSafety.safeMedications.length > 0 && (
              <View style={styles.safeMedsCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Check size={16} color="#10b981" />
                  <Text style={styles.safeMedsTitle}>Cleared with Active Profile:</Text>
                </View>
                <Text style={styles.safeMedsList}>
                  {rxSafety.safeMedications.join(" • ")}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* FIRST RESPONDER CREDENTIALS & PHYSICAL PASSPORT CARDS                      */}
        {/* ========================================================================= */}
        <View style={styles.bottomCredentialsSection}>
          <Text style={styles.bottomCredentialsHeader}>FIRST RESPONDER CREDENTIALS</Text>
          <Text style={styles.bottomCredentialsSub}>
            Physical credentials for EMTs, paramedics, and emergency clinical triage
          </Text>

          <View style={styles.bottomCredentialsGrid}>
            {/* Optical QR Passport */}
            <Pressable
              style={styles.bottomCredentialCard}
              onPress={() => setShowQrModal(true)}
              accessibilityLabel="View Paramedic Optical QR Passport"
            >
              <View style={[styles.bottomCardIconBox, { backgroundColor: "rgba(56, 189, 248, 0.15)", borderColor: "rgba(56, 189, 248, 0.3)" }]}>
                <QrCode size={22} color="#38bdf8" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.bottomCardTitle} numberOfLines={1}>Optical QR Passport</Text>
                  <View style={styles.bottomBadgeSky}>
                    <Text style={styles.bottomBadgeTextSky}>OFFLINE</Text>
                  </View>
                </View>
                <Text style={styles.bottomCardSub} numberOfLines={2}>
                  Instant paramedic camera scan for blood type, allergies & active vitals
                </Text>
              </View>
              <ChevronRight size={18} color="#38bdf8" />
            </Pressable>

            {/* First Responder Medical ID Card */}
            <Pressable
              style={styles.bottomCredentialCard}
              onPress={() => setShowEmergencyCard(true)}
              accessibilityLabel="View First Responder Medical ID Card"
            >
              <View style={[styles.bottomCardIconBox, { backgroundColor: "rgba(239, 68, 68, 0.15)", borderColor: "rgba(239, 68, 68, 0.3)" }]}>
                <ShieldAlert size={22} color="#ef4444" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.bottomCardTitle} numberOfLines={1}>First Responder ID Card</Text>
                  <View style={styles.bottomBadgeRed}>
                    <Text style={styles.bottomBadgeTextRed}>ICE PROTOCOL</Text>
                  </View>
                </View>
                <Text style={styles.bottomCardSub} numberOfLines={2}>
                  Emergency wallet badge with clinical conditions, donor status & contacts
                </Text>
              </View>
              <ChevronRight size={18} color="#ef4444" />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT EMERGENCY CONTACT */}
      {/* ========================================================================= */}
      <Modal visible={showContactModal} transparent animationType="slide" onRequestClose={() => setShowContactModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <PhoneCall size={18} color="#10b981" />
                <Text style={styles.modalTitle}>
                  {editingContact ? "Edit Emergency Contact" : "Add Emergency Contact"}
                </Text>
              </View>
              <Pressable onPress={() => setShowContactModal(false)} hitSlop={10}>
                <X size={20} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12, paddingVertical: 10 }}>
              <View>
                <Text style={styles.fieldLabel}>Contact Name / Service *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Jane Doe or Emergency Contact"
                  placeholderTextColor="#64748b"
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              <View>
                <Text style={styles.fieldLabel}>Relationship / Role</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 4 }}>
                  {RELATIONSHIP_TYPES.map((rel) => (
                    <Pressable
                      key={rel}
                      style={[
                        styles.relChip,
                        formRelationship === rel && styles.relChipActive,
                      ]}
                      onPress={() => setFormRelationship(rel)}
                    >
                      <Text
                        style={[
                          styles.relChipText,
                          formRelationship === rel && styles.relChipTextActive,
                        ]}
                      >
                        {rel}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View>
                <Text style={styles.fieldLabel}>Phone Number *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. +1 555 019 2834 or 911"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                  value={formPhone}
                  onChangeText={setFormPhone}
                />
                <Text style={styles.inputHelperText}>
                  This number will be dialed immediately on tap, even if not saved in phonebook.
                </Text>
              </View>

              <View>
                <Text style={styles.fieldLabel}>Medical or Access Notes (Optional)</Text>
                <TextInput
                  style={[styles.modalInput, { minHeight: 60, textAlignVertical: "top" }]}
                  placeholder="e.g. Has spare keys to house; aware of allergies..."
                  placeholderTextColor="#64748b"
                  multiline
                  value={formNotes}
                  onChangeText={setFormNotes}
                />
              </View>

              <Pressable
                style={styles.primarySwitchRow}
                onPress={() => setFormIsPrimary(!formIsPrimary)}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.primarySwitchTitle} numberOfLines={1}>Set as Primary Contact</Text>
                  <Text style={styles.primarySwitchSub} numberOfLines={1}>Will receive SOS SMS and appear at top of ID</Text>
                </View>
                <View style={[styles.checkboxBox, formIsPrimary && styles.checkboxBoxActive]}>
                  {formIsPrimary && <Check size={14} color="#050b08" strokeWidth={3} />}
                </View>
              </Pressable>

              <Pressable style={styles.saveContactModalBtn} onPress={handleSaveContactForm}>
                <Check size={16} color="#ffffff" strokeWidth={3} />
                <Text style={styles.saveContactModalBtnText}>
                  {editingContact ? "Save Changes" : "Save Emergency Contact"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: FULL FIRST RESPONDER DIGITAL MEDICAL CARD */}
      {/* ========================================================================= */}
      <Modal visible={showEmergencyCard} transparent animationType="fade" onRequestClose={() => setShowEmergencyCard(false)}>
        <View style={styles.emergencyCardOverlay}>
          <View style={styles.emergencyCardContent}>
            {/* Red Badge Bar */}
            <View style={styles.emergencyCardBadgeBar}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                <ShieldAlert size={20} color="#ffffff" />
                <Text style={styles.emergencyCardTitle} numberOfLines={1}>FIRST RESPONDER MEDICAL ID</Text>
              </View>
              <Pressable onPress={() => setShowEmergencyCard(false)} hitSlop={10}>
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
              {/* Patient Identifier & Blood Type Header */}
              <View style={styles.patientBannerRow}>
                <View style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                  <Text style={styles.patientLabel}>PATIENT IDENTIFIER</Text>
                  <Text style={styles.patientName} numberOfLines={1}>
                    {profile?.name || "Lumen User"}
                  </Text>
                  <Text style={styles.patientSub} numberOfLines={1}>
                    Resuscitation: {medicalData.codeStatus || "Full Code"} • {medicalData.organDonor ? "Organ Donor" : "Standard"}
                  </Text>
                </View>
                <View style={styles.bloodTypeBigBox}>
                  <Text style={styles.bloodTypeBigLabel}>BLOOD</Text>
                  <Text style={styles.bloodTypeBigVal}>{medicalData.bloodType || "--"}</Text>
                </View>
              </View>

              {/* Allergies Alert */}
              <View style={styles.modalAlertBox}>
                <Text style={styles.modalAlertBoxLabel}>⚠️ ALLERGIES & CONTRAINDICATIONS</Text>
                <Text style={styles.modalAlertBoxVal}>
                  {medicalData.allergies.length > 0 ? medicalData.allergies.join(", ") : "No known allergies"}
                </Text>
              </View>

              {/* Medications */}
              <View style={styles.modalSectionBox}>
                <Text style={styles.modalSectionBoxLabel}>ACTIVE MEDICATIONS & REGIMEN</Text>
                <Text style={styles.modalSectionBoxVal}>
                  {medicalData.medications.length > 0 ? medicalData.medications.join(" • ") : "None reported"}
                </Text>
              </View>

              {/* Conditions & Notes */}
              <View style={styles.modalSectionBox}>
                <Text style={styles.modalSectionBoxLabel}>CONDITIONS & RESCUE NOTES</Text>
                <Text style={styles.modalSectionBoxVal}>
                  {medicalData.conditions.length > 0 ? medicalData.conditions.join(" • ") : "None reported"}
                </Text>
                {medicalData.emergencyNotes ? (
                  <Text style={[styles.modalSectionBoxVal, { fontStyle: "italic", marginTop: 4, color: "#cbd5e1" }]}>
                    “{medicalData.emergencyNotes}”
                  </Text>
                ) : null}
              </View>

              {/* Emergency Contacts with Direct Call in Card */}
              <View style={styles.modalSectionBox}>
                <Text style={styles.modalSectionBoxLabel}>EMERGENCY CONTACTS (ONE-TAP CALL)</Text>
                {contacts.length > 0 ? (
                  <View style={{ gap: 8, marginTop: 6 }}>
                    {contacts.map((c) => (
                      <View key={c.id} style={styles.modalContactRow}>
                        <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                          <Text style={styles.modalContactName} numberOfLines={1}>
                            {c.name} {c.isPrimary ? "(Primary ICE)" : ""}
                          </Text>
                          <Text style={styles.modalContactPhone} numberOfLines={1}>{c.phoneNumber}</Text>
                        </View>
                        <Pressable
                          style={styles.modalCallSmallBtn}
                          onPress={() => handleCallNumber(c.phoneNumber, c.name)}
                        >
                          <PhoneCall size={14} color="#050b08" />
                          <Text style={styles.modalCallSmallBtnText}>CALL</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.modalSectionBoxVal, { marginTop: 4, fontStyle: "italic", color: "#94a3b8" }]}>
                    No emergency contacts added yet.
                  </Text>
                )}
              </View>

              {/* Universal 911 Direct Trigger inside Card */}
              <Pressable
                style={styles.universalCallBtn}
                onPress={() => handleCallNumber("911", "National Emergency 911")}
              >
                <PhoneCall size={16} color="#ffffff" strokeWidth={2.5} />
                <Text style={styles.universalCallBtnText} numberOfLines={1}>CALL 911 DISPATCH</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: OPTICAL PARAMEDIC QR PASSPORT */}
      {/* ========================================================================= */}
      <EmergencyQrCodeModal
        visible={showQrModal}
        onClose={() => setShowQrModal(false)}
        patientName={profile?.name || "Lumen User"}
        bloodType={medicalData.bloodType}
        codeStatus={medicalData.codeStatus || "Full Code"}
        organDonor={medicalData.organDonor}
        allergies={medicalData.allergies}
        medications={medicalData.medications}
        conditions={medicalData.conditions}
        emergencyNotes={medicalData.emergencyNotes}
        primaryContact={
          primaryContact
            ? {
                name: primaryContact.name,
                relationship: primaryContact.relationship,
                phoneNumber: primaryContact.phoneNumber,
              }
            : undefined
        }
        physician={
          medicalData.physicianName && medicalData.physicianPhone
            ? {
                name: medicalData.physicianName,
                phone: medicalData.physicianPhone,
              }
            : undefined
        }
        insurancePolicyId={medicalData.insurancePolicyId}
        onCallNumber={handleCallNumber}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bgSolid,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 54 : 38,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.15)",
    backgroundColor: THEME.colors.bgSolid,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(232, 241, 237, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarSub: {
    fontSize: 9,
    fontWeight: "800",
    color: "#ef4444",
    letterSpacing: 1,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
  },
  qrHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  qrHeaderBtnText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#38bdf8",
    letterSpacing: 0.5,
  },
  sosCardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  sosCardPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#ef4444",
    letterSpacing: 0.5,
  },

  feedbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#34d399",
  },

  savedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#10b981",
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  savedBannerText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#050b08",
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 110,
    gap: 16,
  },

  urgentAlertCard: {
    backgroundColor: "rgba(220, 38, 38, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(220, 38, 38, 0.4)",
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  urgentTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sosIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  urgentTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#f87171",
  },
  urgentSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fca5a5",
    marginTop: 2,
  },
  sosButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  sosCallBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  sosCallBtnTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  sosCallBtnSub: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 9,
    fontWeight: "700",
  },

  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
  segmentBtnTextActive: {
    color: "#f8fafc",
    fontWeight: "800",
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#f8fafc",
  },
  sectionSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: 2,
  },
  addContactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  addContactBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },

  contactCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  contactTopRow: {
    flexDirection: "row",
    gap: 12,
  },
  contactAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  contactName: {
    fontSize: 15,
    fontWeight: "900",
    color: "#f8fafc",
  },
  primaryBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#34d399",
  },
  contactRelationship: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
    marginTop: 2,
  },
  contactPhone: {
    fontSize: 13,
    fontWeight: "800",
    color: "#38bdf8",
    marginTop: 2,
  },
  contactNotes: {
    fontSize: 11,
    fontWeight: "500",
    color: "#94a3b8",
    fontStyle: "italic",
    marginTop: 4,
  },
  contactActionDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  contactActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  callActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#10b981",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  callActionBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  contactSmallIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyCard: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 24,
    gap: 8,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900",
  },
  emptySub: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },
  addContactEmptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#10b981",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  addContactEmptyBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    borderRadius: 16,
    padding: 14,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 11,
    color: "#94a3b8",
    lineHeight: 16,
  },

  card: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    padding: 16,
    gap: 6,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#f8fafc",
  },
  cardSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 6,
  },
  badgeCount: {
    fontSize: 11,
    fontWeight: "800",
    color: "#38bdf8",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  bloodTypeActivePill: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bloodTypeActivePillText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  bloodChipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  bloodChip: {
    width: "22%",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  bloodChipActive: {
    backgroundColor: "#dc2626",
    borderColor: "#ef4444",
  },
  bloodChipText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "800",
  },
  bloodChipTextActive: {
    color: "#ffffff",
    fontWeight: "900",
  },

  codeOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 12,
    borderRadius: 14,
  },
  codeOptionRowActive: {
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  codeOptionTitle: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "700",
  },
  codeRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#64748b",
    alignItems: "center",
    justifyContent: "center",
  },
  codeRadioCircleActive: {
    borderColor: "#38bdf8",
  },
  codeRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#38bdf8",
  },

  organDonorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(16, 185, 129, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    padding: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  organDonorTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  organDonorSub: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  organDonorToggle: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  organDonorToggleActive: {
    backgroundColor: "#10b981",
  },
  organDonorToggleText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "900",
  },

  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 6,
  },
  allergyTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  allergyTagText: {
    color: "#fca5a5",
    fontSize: 12,
    fontWeight: "700",
  },
  medTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(37, 99, 235, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.35)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  medTagText: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "700",
  },
  conditionTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  conditionTagText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyTagNotice: {
    color: "#64748b",
    fontSize: 12,
    fontStyle: "italic",
    marginVertical: 4,
  },
  addTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  tagInput: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 13,
  },
  tagAddBtn: {
    backgroundColor: "#ef4444",
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  twoColInputs: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  physicianCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    padding: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  physicianCallBtnText: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "700",
  },

  shieldStatusCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
  },
  shieldStatusCardCritical: {
    backgroundColor: "rgba(220, 38, 38, 0.12)",
    borderColor: "rgba(220, 38, 38, 0.4)",
  },
  shieldStatusCardHigh: {
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    borderColor: "rgba(249, 115, 22, 0.4)",
  },
  shieldStatusCardModerate: {
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderColor: "rgba(234, 179, 8, 0.4)",
  },
  shieldStatusCardSafe: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  shieldStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  shieldStatusTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  shieldStatusSub: {
    fontSize: 11,
    fontWeight: "500",
    color: "#cbd5e1",
    marginTop: 2,
    lineHeight: 16,
  },

  clinicalAlertsHeader: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  alertDetailCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  alertDetailCardCritical: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  alertDetailCardHigh: {
    backgroundColor: "rgba(249, 115, 22, 0.08)",
    borderColor: "rgba(249, 115, 22, 0.3)",
  },
  alertDetailCardModerate: {
    backgroundColor: "rgba(234, 179, 8, 0.08)",
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  alertDetailTitle: {
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
  },
  alertDetailDesc: {
    color: "#e2e8f0",
    fontSize: 12,
    lineHeight: 17,
  },
  alertGuidanceBox: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  alertGuidanceLabel: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  alertGuidanceText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
  },

  safeMedsCard: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  safeMedsTitle: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "800",
  },
  safeMedsList: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "600",
  },

  bottomCredentialsSection: {
    marginTop: 10,
    gap: 8,
  },
  bottomCredentialsHeader: {
    fontSize: 11,
    fontWeight: "900",
    color: "#94a3b8",
    letterSpacing: 1.2,
  },
  bottomCredentialsSub: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16,
    marginTop: -2,
    marginBottom: 4,
  },
  bottomCredentialsGrid: {
    gap: 10,
  },
  bottomCredentialCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 18,
    padding: 14,
  },
  bottomCardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.colors.textOnDarkPrimary,
  },
  bottomBadgeSky: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bottomBadgeTextSky: {
    fontSize: 9,
    fontWeight: "800",
    color: "#38bdf8",
    letterSpacing: 0.5,
  },
  bottomBadgeRed: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bottomBadgeTextRed: {
    fontSize: 9,
    fontWeight: "800",
    color: "#ef4444",
    letterSpacing: 0.5,
  },
  bottomCardSub: {
    fontSize: 11,
    color: "#94a3b8",
    lineHeight: 15,
    marginTop: 2,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#0d1813",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "90%",
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingBottom: 14,
  },
  modalTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900",
  },
  modalInput: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 12,
    color: "#f8fafc",
    fontSize: 13,
    marginTop: 4,
  },
  inputHelperText: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 4,
  },
  relChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  relChipActive: {
    backgroundColor: "#10b981",
    borderColor: "#34d399",
  },
  relChipText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
  },
  relChipTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  primarySwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  primarySwitchTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  primarySwitchSub: {
    color: "#94a3b8",
    fontSize: 10,
    marginTop: 2,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#64748b",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxBoxActive: {
    backgroundColor: "#10b981",
    borderColor: "#34d399",
  },
  saveContactModalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10b981",
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 10,
  },
  saveContactModalBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  emergencyCardOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.88)",
    justifyContent: "flex-end",
  },
  emergencyCardContent: {
    backgroundColor: "#08110d",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    borderWidth: 1.5,
    borderColor: "rgba(239, 68, 68, 0.4)",
    overflow: "hidden",
  },
  emergencyCardBadgeBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#b91c1c",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  emergencyCardTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  patientBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 16,
    padding: 14,
  },
  patientLabel: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  patientName: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },
  patientSub: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  bloodTypeBigBox: {
    width: 64,
    height: 58,
    borderRadius: 14,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },
  bloodTypeBigLabel: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 9,
    fontWeight: "800",
  },
  bloodTypeBigVal: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },
  modalAlertBox: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  modalAlertBoxLabel: {
    color: "#ef4444",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  modalAlertBoxVal: {
    color: "#fecaca",
    fontSize: 13,
    fontWeight: "700",
  },
  modalSectionBox: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  modalSectionBoxLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  modalSectionBoxVal: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
  },
  modalContactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    padding: 10,
    borderRadius: 12,
  },
  modalContactName: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  modalContactPhone: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "700",
  },
  modalCallSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10b981",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  modalCallSmallBtnText: {
    color: "#050b08",
    fontSize: 11,
    fontWeight: "900",
  },
  universalCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#dc2626",
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 6,
    marginBottom: Platform.OS === "ios" ? 20 : 10,
  },
  universalCallBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
});
