import { Router } from "express";
import { container } from "tsyringe";
import OrchestratorV2controller from "./orchestrator.controller";

const OrchestV2router = Router();
const controller = container.resolve(OrchestratorV2controller);

OrchestV2router.post("/chat", controller.chat);

export { OrchestV2router };
