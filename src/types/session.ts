export interface SessionInitResult {
  referenceNumber: string;
  sessionToken: string;
}

export type SessionStatus =
  | { status: 'pending'; referenceNumber: string }
  | { status: 'active'; sessionToken: string; referenceNumber: string }
  | { status: 'terminated'; referenceNumber: string; terminatedAt: string };

export interface SessionStatusResponse {
  processingCode: number;
  processingDescription: string;
  referenceNumber: string;
  timestamp: string;
}

export interface SessionTerminateResponse {
  referenceNumber: string;
  timestamp: string;
}
