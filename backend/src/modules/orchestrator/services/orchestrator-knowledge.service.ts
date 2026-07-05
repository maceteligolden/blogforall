import fs from "fs/promises";
import path from "path";
import { injectable } from "tsyringe";
import { BadRequestError } from "../../../shared/errors";
import { env } from "../../../shared/config/env";
import type { KnowledgeFileRef } from "../../../shared/schemas/workspace-knowledge-source.schema";
import { WorkspaceKnowledgeSourceRepository } from "../repositories/workspace-knowledge-source.repository";

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
  constructor(private readonly repository: WorkspaceKnowledgeSourceRepository) {}

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
}
