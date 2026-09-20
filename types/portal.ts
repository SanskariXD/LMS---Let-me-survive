export interface PortalSession {
  userId: string;
  expires: number;
}

export interface PortalLoginRequest {
  pin: string;
}

export interface PortalSessionResponse {
  unlocked: boolean;
}
