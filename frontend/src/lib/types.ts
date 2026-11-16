export type Role = 'patient' | 'doctor' | 'admin';
export interface User { id: string; email: string; role: Role; profileId: string | null }
export type Status = 'booked' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export interface Page<T> { data: T[]; page: number; limit: number; total: number; pages: number }
export interface Doctor {
  _id: string; name: string; specialty: string; clinic?: { city?: string }; consultationTypes: ('online' | 'in_person')[];
  availability: { dayOfWeek: number; start: string; end: string }[];
}
export interface Appointment {
  _id: string; patientId: string; doctorId: string; startAt: string; endAt: string; status: Status;
  consultationType: 'online' | 'in_person'; reason?: string; doctorName: string; specialty: string; patientName: string;
}
export interface Slot { startAt: string; endAt: string; status: 'available' | 'taken' | 'past' }
export interface Patient {
  _id: string; fullName: string; dateOfBirth: string; contact?: { email?: string; phone?: string }; address?: { city?: string; country?: string };
  allergies: { substance: string; severity: 'Mild' | 'Moderate' | 'Severe' }[];
  emergencyContact: { name: string; relationship: string; phone?: string };
  onboardingDone?: boolean; // false only for freshly registered patients
}
export interface MedicalRecord {
  _id: string; visitAt: string; doctorName: string; specialty: string; diagnoses: { code: string; description: string }[];
  vitals?: { systolicBP?: number; diastolicBP?: number; heartRate?: number }; medications: string[]; notes?: string; followUpRequired: boolean;
}
export interface DocMeta { _id: string; filename: string; mimeType: string; size: number; checksum: string; uploadedAt: string }
export interface ChatMsg { role: 'user' | 'assistant'; content: string; sources?: string[]; mode?: string; degraded?: boolean; disclaimer?: string; emergency?: string }
export interface Overview {
  totals: { appointments: number; noShows: number; noShowRate: number };
  byStatus: { status: Status; count: number }[]; bySpecialty: { specialty: string; count: number }[];
  byConsultationType: { type: string; count: number }[];
  volumeByDoctor: { doctorId: string; name: string; specialty: string; totalAppointments: number }[];
  monthlyTrend: { year: number; month: number; status: Status; count: number }[];
  topDiagnoses: { code: string; description: string; count: number }[];
  allergyPrevalence: { substance: string; severity: string; patients: number }[];
  ageBands: { band: string; patients: number }[];
}
export interface AgendaItem { _id: string; patientId: string; startAt: string; endAt: string; status: Status; consultationType: 'online' | 'in_person'; reason?: string; patientName: string }
export interface DoctorOverview {
  generatedAt: string; today: AgendaItem[]; todayDone: number; awaiting: number; upcoming7: number; noShowRate: number;
  daily: { date: string; count: number }[]; outcomes: { status: Status; count: number }[]; next: AgendaItem | null; attention: AgendaItem[];
}
export interface Notice { _id: string; type: string; status: 'unread' | 'read'; message: string; createdAt: string }
export interface PatientOverview {
  generatedAt: string; upcomingCount: number; completed12: number; records: number; documents: number;
  upcoming: { _id: string; doctorId: string; startAt: string; status: Status; consultationType: 'online' | 'in_person'; reason?: string; doctorName: string; specialty: string }[];
  monthly: { month: string; count: number }[];
  vitals: { visitAt: string; systolicBP?: number; diastolicBP?: number; heartRate?: number }[];
}
export interface ClinicOps {
  generatedAt: string; unconfirmed7: number; doctors: number; cancellationRate90: number;
  today: { _id: string; startAt: string; status: Status; consultationType: 'online' | 'in_person'; doctorName: string; specialty: string }[];
  daily: { date: string; count: number }[]; utilisation: { name: string; specialty: string; booked: number; capacity: number; pct: number }[];
}
