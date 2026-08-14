export interface AuthorisationChallengeRequest {
  contextIdentifier: {
    type: 'onip';
    identifier: string;
  };
}

export interface AuthorisationChallengeResponse {
  timestamp: string;
  challenge: string;
}

export interface InitSignedRequest {
  xml: string;
}

export interface InitSignedResponse {
  referenceNumber: string;
  timestamp: string;
}
