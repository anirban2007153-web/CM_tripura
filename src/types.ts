export type Screen =
  | 'login'
  | 'citizen-login'
  | 'authority-login'
  | 'citizen-dashboard'
  | 'authority-dashboard'
  | 'access-denied'
  | 'home'
  | 'report-a-problem'
  | 'track-a-report';

export type TransitionDirection = 'forward' | 'back';

export type UserRole = 'citizen' | 'authority';

export interface AuthenticatedUser {
  id: string;
  displayName: string;
  role: UserRole;
}

export interface AuthSession {
  user: AuthenticatedUser;
}

export interface SelectedLocation {
  lat: number;
  lng: number;
  ward?: string;
  landmark?: string;
}

export interface TimelineEntry {
  id: string;
  title: string;
  status: string;
  statusType: 'submitted' | 'under-review' | 'action-reported' | 'evidence-submitted' | 'evidence-verified';
  date: string;
  description: string;
  reviewerNotes?: string;
  reviewerName?: string;
  imageFileName?: string;
  gpsCoords?: string;
  signedNode?: string;
}

export interface ReportItem {
  id: string;
  title: string;
  category: string;
  ward: string;
  location: string;
  coordinates: string;
  lat?: number;
  lng?: number;
  submittedAt: string;
  status:
    | 'Submitted'
    | 'Under Review'
    | 'In Progress'
    | 'Needs Information'
    | 'Resolved'
    | 'Rejected'
    | 'Evidence Verified'
    | 'Action Reported';
  triageTurnaround: string;
  resolutionSpan: string;
  geostampAccuracy: string;
  attestations: string;
  originalImage: string;
  originalImageTag: string;
  clearImage?: string;
  clearImageTag?: string;
  siteAssessment: string;
  severity?: 'low' | 'moderate' | 'severe';
  locationNotes?: string;
  verificationResult?: string;
  timeline: TimelineEntry[];
  reporterEmail?: string;
  isUserSubmitted?: boolean;
  hasLocalImage?: boolean;
}
