export interface WorkspaceApiKey {
  _id?: string;
  site_id: string;
  user_id: string;
  name: string;
  accessKeyId: string;
  hashedSecret: string;
  secret_encrypted: string;
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}
