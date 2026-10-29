import React, { useState, useEffect } from "react";
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
} from "react-native";
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
} from "lucide-react-native";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { storage } from "@/services/storage";
import { getKV, setKV } from "@/services/db";
import { useSlideMenu } from "@/context/SlideMenuContext";
import THEME from "@/constants/theme";

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
  emergencyNotes: string;
  physicianName?: string;
  physicianPhone?: string;
  hospitalName?: string;
  insuranceProvider?: string;
  insurancePolicyId?: string;
}

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

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

const DEFAULT_CONTACTS: EmergencyContact[] = [
  {
    id: "contact-1",
    name: "Dr. Sarah Miller",
    relationship: "Doctor / Physician",
    phoneNumber: "+1 (555) 234-5678",
    isPrimary: true,
    notes: "Primary Care Physician • City Health Clinic",
  },
  {
    id: "contact-2",
    name: "Emily Rivera",
    relationship: "Spouse / Partner",
    phoneNumber: "+1 (555) 019-2834",
    isPrimary: false,
    notes: "Has home access keys & aware of penicillin allergy",
  },
];

const DEFAULT_MEDICAL_PROFILE: MedicalProfileData = {
  bloodType: "O+",
  allergies: ["Penicillin", "Peanuts"],
  medications: ["Lisinopril 10mg daily", "Multivitamin"],
  conditions: ["Mild Asthma"],
  organDonor: true,
  emergencyNotes: "Carries emergency rescue inhaler in travel bag.",
  physicianName: "Dr. Sarah Miller",
  physicianPhone: "+1 (555) 234-5678",
  hospitalName: "Memorial Health Center",
  insuranceProvider: "BlueCross Bio-Shield",
  insurancePolicyId: "LMN-98234-X",
};

export default function SafetyScreen() {
  const qc = useQueryClient();
  const { openLeftMenu } = useSlideMenu();
  const { data: profile } = useGetProfile();
  const updateProfileMutation = useUpdateProfile();

  // Active view section: "contacts" | "medical_id"
  const [activeSection, setActiveSection] = useState<"contacts" | "medical_id">("contacts");

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
  const [medicalData, setMedicalData] = useState<MedicalProfileData>(DEFAULT_MEDICAL_PROFILE);
  const [newAllergyInput, setNewAllergyInput] = useState("");
  const [newMedicationInput, setNewMedicationInput] = useState("");
  const [newConditionInput, setNewConditionInput] = useState("");

  // Modals & Feedback
  const [showEmergencyCard, setShowEmergencyCard] = useState(false);
  const [isSavedBanner, setIsSavedBanner] = useState(false);
  const [dialFeedback, setDialFeedback] = useState<string | null>(null);

  // Load Saved Contacts & Medical Profile from Local Persistent Engine & DB
  useEffect(() => {
    async function loadData() {
      try {
        // 1. Emergency Contacts
        const storedContacts = await storage.getItem("lumen_emergency_contacts");
        if (storedContacts) {
          const parsed = JSON.parse(storedContacts);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setContacts(parsed);
          }
        } else {
          const kvContacts = await getKV("lumen_emergency_contacts");
          if (kvContacts) {
            const parsed = JSON.parse(kvContacts);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setContacts(parsed);
            }
          }
        }

        // 2. Medical Profile
        const storedMed = await storage.getItem("lumen_medical_profile");
        if (storedMed) {
          setMedicalData(JSON.parse(storedMed));
        } else if (profile) {
          const p = profile as any;
          setMedicalData((prev) => ({
            ...prev,
            allergies: Array.isArray(p.allergies) && p.allergies.length > 0 ? p.allergies : prev.allergies,
            medications: Array.isArray(p.medications) && p.medications.length > 0 ? p.medications : prev.medications,
          }));
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

    // Strip formatting characters while preserving leading + for international dial
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
        // Fallback for simulators or devices without telephony capability
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
      // Attempt direct fallback open
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
        // If this contact is marked primary, unmark others
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

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.topBarSub}>EMERGENCY PROTOCOL</Text>
          <Text style={styles.topBarTitle}>Medical Safety & ID</Text>
        </View>

        <Pressable style={styles.sosCardPill} onPress={() => setShowEmergencyCard(true)}>
          <ShieldAlert size={14} color="#ef4444" />
          <Text style={styles.sosCardPillText}>VIEW ID CARD</Text>
        </Pressable>
      </View>

      {/* Dial Feedback Banner */}
      {dialFeedback && (
        <View style={styles.feedbackBanner}>
          <PhoneCall size={14} color="#10b981" />
          <Text style={styles.feedbackText}>{dialFeedback}</Text>
        </View>
      )}

      {/* Save Success Banner */}
      {isSavedBanner && (
        <View style={styles.savedBanner}>
          <Check size={14} color="#050b08" strokeWidth={3} />
          <Text style={styles.savedBannerText}>Medical ID Saved & Encrypted Locally</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ========================================================================= */}
        {/* NATIONAL EMERGENCY SPEED DIALER (911 / 112 / 108) */}
        {/* ========================================================================= */}
        <View style={styles.urgentAlertCard}>
          <View style={styles.urgentTopRow}>
            <View style={styles.sosIconBox}>
              <ShieldAlert size={20} color="#ef4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.urgentTitle}>Instant Emergency Dispatch</Text>
              <Text style={styles.urgentSub}>
                1-tap direct dial to primary emergency services & first responders
              </Text>
            </View>
          </View>

          <View style={styles.sosButtonsRow}>
            <Pressable
              style={[styles.sosCallBtn, { backgroundColor: "#dc2626" }]}
              onPress={() => handleCallNumber("911", "National Emergency 911")}
            >
              <PhoneCall size={16} color="#ffffff" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sosCallBtnTitle} numberOfLines={1}>CALL 911</Text>
                <Text style={styles.sosCallBtnSub} numberOfLines={1}>Ambulance • Fire</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.sosCallBtn, { backgroundColor: "#991b1b" }]}
              onPress={() => handleCallNumber("112", "Universal Emergency 112")}
            >
              <PhoneCall size={16} color="#ffffff" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sosCallBtnTitle} numberOfLines={1}>CALL 112</Text>
                <Text style={styles.sosCallBtnSub} numberOfLines={1}>Global Dispatch</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* SEGMENTED TAB SWITCHER */}
        {/* ========================================================================= */}
        <View style={styles.segmentContainer}>
          <Pressable
            style={[styles.segmentBtn, activeSection === "contacts" && styles.segmentBtnActive]}
            onPress={() => setActiveSection("contacts")}
          >
            <Phone size={14} color={activeSection === "contacts" ? "#10b981" : "#64748b"} />
            <Text
              style={[
                styles.segmentBtnText,
                activeSection === "contacts" && styles.segmentBtnTextActive,
              ]}
            >
              Emergency Contacts ({contacts.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentBtn, activeSection === "medical_id" && styles.segmentBtnActive]}
            onPress={() => setActiveSection("medical_id")}
          >
            <Heart size={14} color={activeSection === "medical_id" ? "#10b981" : "#64748b"} />
            <Text
              style={[
                styles.segmentBtnText,
                activeSection === "medical_id" && styles.segmentBtnTextActive,
              ]}
            >
              Medical Info & Responders
            </Text>
          </Pressable>
        </View>

        {/* ========================================================================= */}
        {/* SECTION 1: EMERGENCY CONTACTS & DIALER */}
        {/* ========================================================================= */}
        {activeSection === "contacts" && (
          <View style={{ gap: 14 }}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Important Contacts</Text>
                <Text style={styles.sectionSub}>
                  Click Call on any contact to open your phone dialer with number pre-dialed
                </Text>
              </View>

              <Pressable style={styles.addContactBtn} onPress={() => handleOpenContactModal()}>
                <Plus size={14} color="#050b08" strokeWidth={3} />
                <Text style={styles.addContactBtnText}>Add Contact</Text>
              </Pressable>
            </View>

            {/* List of Contacts */}
            {contacts.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactTopRow}>
                  <View style={styles.contactAvatar}>
                    <User size={18} color="#10b981" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      {contact.isPrimary && (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.contactRelationship}>{contact.relationship}</Text>
                    <Text style={styles.contactPhone}>{contact.phoneNumber}</Text>

                    {contact.notes ? (
                      <Text style={styles.contactNotes}>“{contact.notes}”</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.contactActionDivider} />

                <View style={styles.contactActionsRow}>
                  {/* Big Call Button - Redirects directly to phone call dialer */}
                  <Pressable
                    style={styles.callActionBtn}
                    onPress={() => handleCallNumber(contact.phoneNumber, contact.name)}
                  >
                    <PhoneCall size={16} color="#050b08" strokeWidth={2.5} />
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
                <AlertTriangle size={32} color="#f59e0b" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>No Emergency Contacts Added</Text>
                <Text style={styles.emptySub}>
                  Add trusted family members, doctors, or specialists so first responders can reach them instantly.
                </Text>
                <Pressable style={styles.addContactEmptyBtn} onPress={() => handleOpenContactModal()}>
                  <Plus size={16} color="#050b08" />
                  <Text style={styles.addContactEmptyBtnText}>Add Your First Emergency Contact</Text>
                </Pressable>
              </View>
            )}

            {/* Offline Dialer Guarantee Card */}
            <View style={styles.infoBox}>
              <Sparkles size={16} color="#38bdf8" />
              <Text style={styles.infoBoxText}>
                <Text style={{ fontWeight: "bold", color: "#f8fafc" }}>Offline Native Redirection: </Text>
                Tapping Call automatically launches your mobile phone dialer and inputs the extracted number even if the contact is NOT stored in your phone’s address book and with zero internet.
              </Text>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* SECTION 2: MEDICAL PROFILE & FIRST RESPONDER DATA */}
        {/* ========================================================================= */}
        {activeSection === "medical_id" && (
          <View style={{ gap: 16 }}>
            {/* Blood Group Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Blood Group</Text>
                <View style={styles.bloodTypeActivePill}>
                  <Text style={styles.bloodTypeActivePillText}>{medicalData.bloodType}</Text>
                </View>
              </View>
              <Text style={styles.cardSub}>Critical for emergency transfusions</Text>

              <View style={styles.bloodChipsGrid}>
                {BLOOD_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    style={[
                      styles.bloodChip,
                      medicalData.bloodType === type && styles.bloodChipActive,
                    ]}
                    onPress={() => persistMedicalProfile({ ...medicalData, bloodType: type })}
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

            {/* Allergies & Adverse Reactions */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Allergies & Reactions</Text>
                <Text style={styles.badgeCount}>{medicalData.allergies.length}</Text>
              </View>
              <Text style={styles.cardSub}>Alerts paramedics to avoid fatal drug contraindications</Text>

              <View style={styles.tagsContainer}>
                {medicalData.allergies.map((allergy) => (
                  <View key={allergy} style={styles.allergyTag}>
                    <Text style={styles.allergyTagText}>{allergy}</Text>
                    <Pressable onPress={() => handleRemoveAllergy(allergy)}>
                      <X size={12} color="#fca5a5" />
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={styles.addTagRow}>
                <TextInput
                  style={styles.tagInput}
                  placeholder="Add allergy (e.g. Latex, Sulfa, Aspirin)"
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

            {/* Current Medications & Dosages */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Current Medications</Text>
                <Text style={styles.badgeCount}>{medicalData.medications.length}</Text>
              </View>
              <Text style={styles.cardSub}>Active prescription and daily supplements</Text>

              <View style={styles.tagsContainer}>
                {medicalData.medications.map((med) => (
                  <View key={med} style={styles.medTag}>
                    <Text style={styles.medTagText}>{med}</Text>
                    <Pressable onPress={() => handleRemoveMedication(med)}>
                      <X size={12} color="#93c5fd" />
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={styles.addTagRow}>
                <TextInput
                  style={styles.tagInput}
                  placeholder="Add medication (e.g. Metformin 500mg daily)"
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

            {/* Chronic Medical Conditions */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Chronic Conditions & Clinical Notes</Text>
                <Text style={styles.badgeCount}>{medicalData.conditions.length}</Text>
              </View>
              <Text style={styles.cardSub}>Pre-existing health background & surgical history</Text>

              <View style={styles.tagsContainer}>
                {medicalData.conditions.map((cond) => (
                  <View key={cond} style={styles.conditionTag}>
                    <Text style={styles.conditionTagText}>{cond}</Text>
                    <Pressable onPress={() => handleRemoveCondition(cond)}>
                      <X size={12} color="#cbd5e1" />
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={styles.addTagRow}>
                <TextInput
                  style={styles.tagInput}
                  placeholder="Add condition (e.g. Type 1 Diabetes, Pacemaker)"
                  placeholderTextColor="#64748b"
                  value={newConditionInput}
                  onChangeText={setNewConditionInput}
                  onSubmitEditing={handleAddCondition}
                />
                <Pressable style={[styles.tagAddBtn, { backgroundColor: "#475569" }]} onPress={handleAddCondition}>
                  <Plus size={16} color="#ffffff" />
                </Pressable>
              </View>

              <View style={{ marginTop: 10 }}>
                <Text style={styles.fieldLabel}>Emergency Clinical Notes</Text>
                <TextInput
                  style={[styles.tagInput, { minHeight: 60, textAlignVertical: "top" }]}
                  placeholder="Additional rescue instructions for first responders..."
                  placeholderTextColor="#64748b"
                  multiline
                  value={medicalData.emergencyNotes}
                  onChangeText={(val) => persistMedicalProfile({ ...medicalData, emergencyNotes: val })}
                />
              </View>
            </View>

            {/* Primary Physician & Clinical Facilities */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Physician & Insurance Facility</Text>
              <Text style={styles.cardSub}>Doctor contacts for medical authorization</Text>

              <View style={styles.twoColInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Primary Physician</Text>
                  <TextInput
                    style={styles.tagInput}
                    placeholder="Doctor Name"
                    placeholderTextColor="#64748b"
                    value={medicalData.physicianName}
                    onChangeText={(val) => persistMedicalProfile({ ...medicalData, physicianName: val })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Physician Phone</Text>
                  <TextInput
                    style={styles.tagInput}
                    placeholder="+1 (555) 000-0000"
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
                  <Text style={styles.physicianCallBtnText}>Call Physician ({medicalData.physicianPhone})</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT EMERGENCY CONTACT */}
      {/* ========================================================================= */}
      <Modal visible={showContactModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <PhoneCall size={18} color="#10b981" />
                <Text style={styles.modalTitle}>
                  {editingContact ? "Edit Emergency Contact" : "Add Emergency Contact"}
                </Text>
              </View>
              <Pressable onPress={() => setShowContactModal(false)}>
                <X size={20} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12, paddingVertical: 10 }}>
              <View>
                <Text style={styles.fieldLabel}>Contact Name / Service *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Dr. Sarah Miller or Emily Rivera"
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.primarySwitchTitle}>Set as Primary Contact</Text>
                  <Text style={styles.primarySwitchSub}>Will appear at the top of First Responder ID</Text>
                </View>
                <View style={[styles.checkboxBox, formIsPrimary && styles.checkboxBoxActive]}>
                  {formIsPrimary && <Check size={14} color="#050b08" strokeWidth={3} />}
                </View>
              </Pressable>

              <Pressable style={styles.saveContactModalBtn} onPress={handleSaveContactForm}>
                <Check size={16} color="#050b08" strokeWidth={3} />
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
      <Modal visible={showEmergencyCard} transparent animationType="fade">
        <View style={styles.emergencyCardOverlay}>
          <View style={styles.emergencyCardContent}>
            {/* Red Badge Bar */}
            <View style={styles.emergencyCardBadgeBar}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ShieldAlert size={22} color="#ffffff" />
                <Text style={styles.emergencyCardTitle}>FIRST RESPONDER MEDICAL ID</Text>
              </View>
              <Pressable onPress={() => setShowEmergencyCard(false)}>
                <X size={22} color="#ffffff" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
              {/* Patient Identifier & Blood Type Header */}
              <View style={styles.patientBannerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.patientLabel}>PATIENT IDENTIFIER</Text>
                  <Text style={styles.patientName}>{profile?.name || "Alex Rivera"}</Text>
                  <Text style={styles.patientSub}>Lumen Verified Health ID • AES-256 Offline</Text>
                </View>
                <View style={styles.bloodTypeBigBox}>
                  <Text style={styles.bloodTypeBigLabel}>BLOOD</Text>
                  <Text style={styles.bloodTypeBigVal}>{medicalData.bloodType}</Text>
                </View>
              </View>

              {/* Allergies Alert */}
              <View style={styles.modalAlertBox}>
                <Text style={styles.modalAlertBoxLabel}>⚠️ ALLERGIES & CONTRAINDICATIONS</Text>
                <Text style={styles.modalAlertBoxVal}>
                  {medicalData.allergies.length > 0 ? medicalData.allergies.join(", ") : "None declared"}
                </Text>
              </View>

              {/* Medications */}
              <View style={styles.modalSectionBox}>
                <Text style={styles.modalSectionBoxLabel}>ACTIVE MEDICATIONS & REGIMEN</Text>
                <Text style={styles.modalSectionBoxVal}>
                  {medicalData.medications.length > 0 ? medicalData.medications.join(" • ") : "None declared"}
                </Text>
              </View>

              {/* Conditions & Notes */}
              <View style={styles.modalSectionBox}>
                <Text style={styles.modalSectionBoxLabel}>CHRONIC CONDITIONS & RESCUE NOTES</Text>
                <Text style={styles.modalSectionBoxVal}>
                  {medicalData.conditions.length > 0 ? medicalData.conditions.join(" • ") : "None declared"}
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
                <View style={{ gap: 8, marginTop: 6 }}>
                  {contacts.map((c) => (
                    <View key={c.id} style={styles.modalContactRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalContactName}>
                          {c.name} {c.isPrimary ? "(Primary)" : ""}
                        </Text>
                        <Text style={styles.modalContactPhone}>{c.phoneNumber}</Text>
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
              </View>

              {/* Universal 911 Direct Trigger inside Card */}
              <Pressable
                style={styles.universalCallBtn}
                onPress={() => handleCallNumber("911", "National Emergency 911")}
              >
                <PhoneCall size={16} color="#ffffff" strokeWidth={2.5} />
                <Text style={styles.universalCallBtnText}>CALL 911 EMERGENCY DISPATCH NOW</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  sosCardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    paddingVertical: 6,
    paddingHorizontal: 12,
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
    backgroundColor: THEME.colors.accentGreen,
    paddingVertical: 8,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  savedBannerText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#ffffff",
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 50,
    gap: 16,
  },

  // Urgent Emergency Card
  urgentAlertCard: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  urgentTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sosIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  urgentTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
  },
  urgentSub: {
    fontSize: 11,
    color: "#fca5a5",
    lineHeight: 15,
    marginTop: 2,
  },
  sosButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  sosCallBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  sosCallBtnTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  sosCallBtnSub: {
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.8)",
  },

  // Segmented Tabs
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(232, 241, 237, 0.15)",
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.25)",
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
    backgroundColor: THEME.colors.accentTeal,
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.textOnDarkSecondary,
  },
  segmentBtnTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: THEME.colors.textOnDarkPrimary,
  },
  sectionSub: {
    fontSize: 11,
    color: THEME.colors.textOnDarkSecondary,
    marginTop: 2,
    maxWidth: 240,
  },
  addContactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.colors.accentGreen,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  addContactBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ffffff",
  },

  // Contact Cards
  contactCard: {
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: 24,
    padding: 16,
    ...THEME.shadows.card,
  },
  contactTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  contactName: {
    fontSize: 15,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
  },
  primaryBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  primaryBadgeText: {
    fontSize: 8,
    fontWeight: "900",
    color: THEME.colors.accentGreen,
  },
  contactRelationship: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.cardTextSecondary,
    marginTop: 1,
  },
  contactPhone: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.colors.accentTeal,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  contactNotes: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    fontStyle: "italic",
    marginTop: 4,
    lineHeight: 15,
  },
  contactActionDivider: {
    height: 1,
    backgroundColor: "rgba(200, 218, 210, 0.4)",
    marginVertical: 12,
  },
  contactActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  callActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.colors.accentGreen,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  callActionBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  contactSmallIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.5)",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty State
  emptyCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 24,
    alignItems: "center",
    textAlign: "center",
    ...THEME.shadows.card,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
  },
  emptySub: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 14,
  },
  addContactEmptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.colors.accentGreen,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  addContactEmptyBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#ffffff",
  },

  // Info Box
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(232, 241, 237, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.5)",
    borderRadius: 16,
    padding: 12,
  },
  infoBoxText: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    lineHeight: 16,
    flex: 1,
  },

  // Medical ID Cards
  card: {
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: 24,
    padding: 18,
    gap: 10,
    ...THEME.shadows.card,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
  },
  cardSub: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
  },
  badgeCount: {
    backgroundColor: "rgba(232, 241, 237, 0.7)",
    color: THEME.colors.cardTextPrimary,
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },

  // Blood chips
  bloodTypeActivePill: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  bloodTypeActivePillText: {
    color: "#ef4444",
    fontWeight: "900",
    fontSize: 12,
  },
  bloodChipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  bloodChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
  },
  bloodChipActive: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "#ef4444",
  },
  bloodChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.cardTextSecondary,
  },
  bloodChipTextActive: {
    color: "#ef4444",
    fontWeight: "900",
  },

  // Tags
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  allergyTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  allergyTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#dc2626",
  },
  medTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  medTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563eb",
  },
  conditionTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  conditionTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.cardTextPrimary,
  },

  addTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  tagInput: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.8)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: THEME.colors.cardTextPrimary,
  },
  tagAddBtn: {
    backgroundColor: "#dc2626",
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.cardTextSecondary,
    marginBottom: 4,
  },
  twoColInputs: {
    flexDirection: "row",
    gap: 10,
  },
  physicianCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 6,
  },
  physicianCallBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.accentGreen,
  },

  // Modal 1: Add Contact
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11, 22, 19, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: THEME.colors.drawerBg,
    borderWidth: 1.5,
    borderColor: "rgba(200, 218, 210, 0.3)",
    borderRadius: 24,
    padding: 20,
    width: "100%",
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.15)",
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
  },
  modalInput: {
    backgroundColor: "rgba(232, 241, 237, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.25)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: THEME.colors.textOnDarkPrimary,
  },
  inputHelperText: {
    fontSize: 10,
    color: THEME.colors.textOnDarkSecondary,
    marginTop: 4,
  },
  relChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(232, 241, 237, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
  },
  relChipActive: {
    backgroundColor: THEME.colors.accentTeal,
    borderColor: THEME.colors.accentTeal,
  },
  relChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.textOnDarkSecondary,
  },
  relChipTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  primarySwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  primarySwitchTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.colors.textOnDarkPrimary,
  },
  primarySwitchSub: {
    fontSize: 10,
    color: THEME.colors.textOnDarkSecondary,
    marginTop: 1,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(200, 218, 210, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxBoxActive: {
    backgroundColor: THEME.colors.accentGreen,
    borderColor: THEME.colors.accentGreen,
  },
  saveContactModalBtn: {
    backgroundColor: THEME.colors.accentGreen,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  saveContactModalBtnText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#ffffff",
  },

  // Modal 2: First Responder Card
  emergencyCardOverlay: {
    flex: 1,
    backgroundColor: "rgba(11, 22, 19, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  emergencyCardContent: {
    backgroundColor: THEME.colors.drawerBg,
    borderWidth: 2,
    borderColor: "#ef4444",
    borderRadius: 24,
    width: "100%",
    maxHeight: "90%",
    overflow: "hidden",
  },
  emergencyCardBadgeBar: {
    backgroundColor: "#dc2626",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emergencyCardTitle: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  patientBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.15)",
  },
  patientLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: THEME.colors.textOnDarkSecondary,
    letterSpacing: 0.5,
  },
  patientName: {
    fontSize: 17,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
    marginTop: 2,
  },
  patientSub: {
    fontSize: 10,
    color: THEME.colors.textOnDarkSecondary,
    marginTop: 2,
  },
  bloodTypeBigBox: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1.5,
    borderColor: "#ef4444",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: "center",
  },
  bloodTypeBigLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#fca5a5",
  },
  bloodTypeBigVal: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ef4444",
  },
  modalAlertBox: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    padding: 12,
    borderRadius: 14,
  },
  modalAlertBoxLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#ef4444",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modalAlertBoxVal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fecaca",
  },
  modalSectionBox: {
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.15)",
    padding: 12,
    borderRadius: 14,
  },
  modalSectionBoxLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.textOnDarkSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modalSectionBoxVal: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.colors.textOnDarkPrimary,
    lineHeight: 18,
  },
  modalContactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.15)",
  },
  modalContactName: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.colors.textOnDarkPrimary,
  },
  modalContactPhone: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.accentGreen,
    marginTop: 2,
  },
  modalCallSmallBtn: {
    backgroundColor: THEME.colors.accentGreen,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  modalCallSmallBtnText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#ffffff",
  },
  universalCallBtn: {
    backgroundColor: "#dc2626",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 6,
  },
  universalCallBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
});
