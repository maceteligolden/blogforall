import { injectable } from "tsyringe";
import { Request, Response } from "express";
import { container } from "tsyringe";
import { OrchestratorKnowledgeService } from "../../orchestrator/services/orchestrator-knowledge.service";
import { env } from "../../../shared/config/env";

@injectable()
export class GoogleDriveCallbackController {
  constructor(private readonly knowledgeService: OrchestratorKnowledgeService) {}

  callback = async (req: Request, res: Response): Promise<void> => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const siteId = typeof req.query.state === "string" ? req.query.state : "";
    const error = typeof req.query.error === "string" ? req.query.error : "";

    const frontend = env.frontend.baseUrl.replace(/\/$/, "");

    if (error || !code || !siteId) {
      res.redirect(`${frontend}/dashboard/library?google_drive=error`);
      return;
    }

    try {
      await this.knowledgeService.handleGoogleDriveCallback(siteId, code);
      res.redirect(`${frontend}/dashboard/library?google_drive=connected`);
    } catch {
      res.redirect(`${frontend}/dashboard/library?google_drive=error`);
    }
  };
}

export function registerGoogleDriveCallbackRoute(app: import("express").Express): void {
  const controller = container.resolve(GoogleDriveCallbackController);
  app.get("/api/v1/integrations/google-drive/callback", controller.callback);
}
