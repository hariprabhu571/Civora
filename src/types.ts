export type CivicCategory = 
  | 'Pothole'
  | 'Streetlight'
  | 'Garbage/Waste'
  | 'Water Leakage'
  | 'Damaged Public Property'
  | 'Other';

export type SeverityLevel = 'Low' | 'Medium' | 'High';

export type ReportStatus = 'Reported' | 'Under Review' | 'Resolved';

export interface LocationCoordinates {
  lat: number;
  lng: number;
  address?: string;
}

export interface CivicReport {
  id: string; // matches document ID in firestore
  photoUrl: string;
  category: CivicCategory;
  severity: SeverityLevel;
  severityReasoning?: string;
  responsible_department: string;
  formal_complaint_text: string;
  userNotes: string;
  location: LocationCoordinates;
  status: ReportStatus;
  timestamp: any; // Firestore Timestamp
  confirmations: number;
  confirmedUsers: string[]; // local storage UUIDs of users who confirmed this report
}

export interface AIDraftData {
  category: CivicCategory;
  severity: SeverityLevel;
  severity_reasoning: string;
  responsible_department: string;
  formal_complaint_text: string;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  confidence: number;
  reasoning: string;
  matchedReportId?: string;
}
