export interface SessionInitResult {
  referenceNumber: string;
  sessionToken: string;
}

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
