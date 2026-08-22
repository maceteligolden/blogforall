import { Router, type RequestHandler } from "express";
import { container } from "tsyringe";
import { OrchestratorController } from "../controllers/orchestrator.controller";
import OrchestratorV2controller from "../../orchestratorv2/orchestrator.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { siteParamMiddleware } from "../../../shared/middlewares/site-access.middleware";
import { validateBody, validateParams, validateQuery } from "../../../shared/middlewares/validate.middleware";
import * as V from "../validations/orchestrator-route.validation";
import { uploadContextSingle } from "../../../shared/middlewares/context-upload.middleware";

/**
 * Workspace Orchestrator Agent router. Mounted at `/sites/:siteId/orchestrator`
 * so every endpoint is automatically tenant-scoped via the JWT + siteId param.
 *
 * Chat turns are handled by orchestratorv2. Threads/onboarding/approvals/knowledge
 * remain on the v1 controller.
 */
const router = Router({ mergeParams: true });

router.use(authMiddleware, validateParams(V.siteIdParamSchema), siteParamMiddleware);

const controller = container.resolve(OrchestratorController);
const v2Controller = container.resolve(OrchestratorV2controller);

router.post("/chat", validateBody(V.orchestratorChatBodySchema), v2Controller.chat);
router.post("/chat/stream", validateBody(V.orchestratorChatBodySchema), v2Controller.chatStream);
router.post("/onboarding/chat", validateBody(V.orchestratorOnboardingChatBodySchema), controller.onboardingChat);
router.post("/onboarding/start", controller.startOnboardingInterview);
router.post("/voice/tts", validateBody(V.voiceTtsBodySchema), v2Controller.voiceTts);

router.post("/threads/open", validateBody(V.openThreadBodySchema), controller.openThread);
router.post("/threads", validateBody(V.createThreadBodySchema), controller.createThread);
router.get("/threads", validateQuery(V.threadListQuerySchema), controller.listThreads);
router.get("/threads/:threadId", validateParams(V.threadIdParamSchema), controller.getThread);
router.patch(
  "/threads/:threadId",
  validateParams(V.threadIdParamSchema),
  validateBody(V.renameThreadBodySchema),
  controller.renameThread
);
router.delete("/threads/:threadId", validateParams(V.threadIdParamSchema), controller.deleteThread);

router.get("/approvals", validateQuery(V.approvalListQuerySchema), controller.listApprovals);
router.post(
  "/approvals/:approvalId/decide",
  validateParams(V.approvalIdParamSchema),
  validateBody(V.orchestratorApprovalDecisionBodySchema),
  controller.decideApproval
);

router.post("/context/upload", uploadContextSingle as unknown as RequestHandler, controller.uploadContextFile);

router.get("/knowledge", controller.listKnowledgeSources);
router.post("/knowledge", uploadContextSingle as unknown as RequestHandler, controller.uploadKnowledgeSource);
router.delete("/knowledge/:id", validateParams(V.knowledgeSourceIdParamSchema), controller.deleteKnowledgeSource);
router.get("/knowledge/google/auth", controller.googleDriveAuth);

export default router;
