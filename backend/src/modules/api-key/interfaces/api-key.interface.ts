export interface CreateApiKeyInput {
  name: string;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  accessKeyId: string;
  secretKey: string; // Only returned once on creation
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

export interface ApiKeyListItem {
  id: string;
  name: string;
  accessKeyId: string;
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

