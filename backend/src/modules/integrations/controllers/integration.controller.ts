import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import { IntegrationConnectionService } from "../services/connection.service";

@injectable()
export class IntegrationController {
  constructor(private connections: IntegrationConnectionService) {}

  private siteId(req: Request): string {
    return (req.validatedParams as { id: string }).id;
  }

  listDestinations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const destinations = await this.connections.listPublishDestinations(this.siteId(req), userId);
      sendSuccess(res, "Publish destinations retrieved", { destinations });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const catalog = await this.connections.listCatalog(this.siteId(req), userId);
      sendSuccess(res, "Integrations retrieved", { integrations: catalog });
    } catch (error) {
      next(error);
    }
  };

  testFramer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const body = req.validatedBody as { projectUrl: string; apiKey: string };
      const result = await this.connections.testFramer(this.siteId(req), userId, body);
      sendSuccess(res, "Framer connection verified", result);
    } catch (error) {
      next(error);
    }
  };

  saveFramer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const connection = await this.connections.saveFramer(
        this.siteId(req),
        userId,
        req.validatedBody as Parameters<IntegrationConnectionService["saveFramer"]>[2]
      );
      sendCreated(res, "Framer connected", { connection });
    } catch (error) {
      next(error);
    }
  };

  getFramer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const data = await this.connections.getFramer(this.siteId(req), userId);
      sendSuccess(res, "Framer integration retrieved", data);
    } catch (error) {
      next(error);
    }
  };

  syncFramer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const data = await this.connections.syncFramer(this.siteId(req), userId);
      sendSuccess(res, "Framer posts synced", data);
    } catch (error) {
      next(error);
    }
  };

  disconnectFramer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      await this.connections.disconnectFramer(this.siteId(req), userId);
      sendNoContent(res, "Framer disconnected");
    } catch (error) {
      next(error);
    }
  };
}
