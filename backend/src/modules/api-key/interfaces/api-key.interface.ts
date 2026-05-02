export interface CreateApiKeyInput {
  name: string;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  accessKeyId: string;
  secretKey: string;
  sitePublicId: string;
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

export interface ApiKeyListItem {
  id: string;
  name: string;
  accessKeyId: string;
  /** Decrypted secret for dashboard display (encrypted at rest in DB). */
  secretKey: string;
  sitePublicId: string;
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}
