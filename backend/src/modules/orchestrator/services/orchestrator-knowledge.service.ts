import fs from "fs/promises";
import path from "path";
import { injectable } from "tsyringe";
import { BadRequestError } from "../../../shared/errors";
import { env } from "../../../shared/config/env";
import type { KnowledgeFileRef } from "../../../shared/schemas/workspace-knowledge-source.schema";
import GoogleDriveTokenModel from "../../../shared/schemas/google-drive-token.schema";
import { WorkspaceKnowledgeSourceRepository } from "../repositories/workspace-knowledge-source.repository";
import { DocumentIngestionService } from "../../memory/services/document-ingestion.service";
import KnowledgeChunkModel from "../../../shared/schemas/knowledge-chunk.schema";

const MAX_EXTRACT_CHARS = 8000;

async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    const raw = await fs.readFile(filePath, "utf8");
    return raw.slice(0, MAX_EXTRACT_CHARS);
  }
  if (filePath.endsWith(".txt") || filePath.endsWith(".md")) {
    const raw = await fs.readFile(filePath, "utf8");
    return raw.slice(0, MAX_EXTRACT_CHARS);
  }
  return "";
}

function publicUrl(filename: string): string {
  const base = env.backendUrl || `http://localhost:${env.port}`;
  return `${base.replace(/\/$/, "")}/uploads/${filename}`;
}

@injectable()
export class OrchestratorKnowledgeService {
  constructor(
    private readonly repository: WorkspaceKnowledgeSourceRepository,
    private readonly documentIngestion: DocumentIngestionService
  ) {}

  async listSources(siteId: string) {
    return this.repository.listForSite(siteId);
  }

  async uploadSource(
    siteId: string,
    userId: string,
    file: Express.Multer.File
  ): Promise<{ source: Awaited<ReturnType<WorkspaceKnowledgeSourceRepository["create"]>> }> {
    const extracted = await extractTextFromFile(file.path, file.mimetype);
    const fileRef: KnowledgeFileRef = {
      name: file.originalname,
      url: publicUrl(path.basename(file.path)),
      mime_type: file.mimetype,
      extracted_text: extracted || undefined,
    };
    const source = await this.repository.create({
      site_id: siteId,
      user_id: userId,
      provider: "upload",
      name: file.originalname,
      file_refs: [fileRef],
    });
    if (extracted) {
      await this.documentIngestion.ingestKnowledgeSource(siteId, source._id!.toString(), extracted);
    }
    return { source };
  }

  async uploadContextFile(file: Express.Multer.File): Promise<KnowledgeFileRef> {
    const extracted = await extractTextFromFile(file.path, file.mimetype);
    return {
      name: file.originalname,
      url: publicUrl(path.basename(file.path)),
      mime_type: file.mimetype,
      extracted_text: extracted || undefined,
    };
  }

  async deleteSource(siteId: string, id: string): Promise<void> {
    const ok = await this.repository.delete(id, siteId);
    if (!ok) throw new BadRequestError("Knowledge source not found");
    await KnowledgeChunkModel.deleteMany({ site_id: siteId, source_id: id });
  }

  async buildKnowledgeSummary(siteId: string): Promise<string> {
    const sources = await this.repository.listForSite(siteId);
    if (!sources.length) return "";
    const lines: string[] = [];
    for (const src of sources) {
      lines.push(`Source: ${src.name} (${src.provider})`);
      for (const ref of src.file_refs.slice(0, 5)) {
        const snippet = (ref.extracted_text ?? "").slice(0, 1500);
        if (snippet) lines.push(`  File "${ref.name}": ${snippet}`);
        else lines.push(`  File "${ref.name}" (${ref.mime_type})`);
      }
    }
    return lines.join("\n").slice(0, 6000);
  }

  getGoogleDriveAuthUrl(siteId: string): string | null {
    const clientId = env.googleDrive.clientId;
    const redirectUri = env.googleDrive.redirectUri;
    if (!clientId || !redirectUri) return null;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive.readonly",
      access_type: "offline",
      state: siteId,
      prompt: "consent",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGoogleDriveCallback(siteId: string, code: string): Promise<void> {
    const { clientId, clientSecret, redirectUri } = env.googleDrive;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestError("Google Drive is not configured");
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      throw new BadRequestError("Failed to exchange Google Drive authorization code");
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    await GoogleDriveTokenModel.findOneAndUpdate(
      { site_id: siteId },
      {
        site_id: siteId,
        user_id: "oauth",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        scope: tokens.scope,
        updated_at: new Date(),
      },
      { upsert: true, new: true }
    );

    await this.repository.create({
      site_id: siteId,
      user_id: "oauth",
      provider: "google_drive",
      name: "Google Drive",
      file_refs: [],
    });
  }
}
