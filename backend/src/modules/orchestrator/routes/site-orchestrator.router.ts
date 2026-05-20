import { Router } from "express";
import { container } from "tsyringe";
import { OrchestratorController } from "../controllers/orchestrator.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../../shared/middlewares/validate.middleware";
import * as V from "../validations/orchestrator-route.validation";

/**
 * Workspace Orchestrator Agent router. Mounted at `/sites/:siteId/orchestrator`
 * so every endpoint is automatically tenant-scoped via the JWT + siteId param.
 *
 * v1 endpoints (stubbed; full behavior in Phase 2):
 *  - POST   /chat                       — conversational turn against the supervisor
 *  - POST   /onboarding/chat            — onboarding-mode turn (gates Site.status)
 *  - GET    /threads                    — list user's threads in this workspace
 *  - GET    /threads/:threadId          — fetch thread + messages
 *  - GET    /approvals                  — list pending/decided approvals
 *  - POST   /approvals/:approvalId/decide — approve or reject an approval
 */
const router = Router({ mergeParams: true });

router.use(authMiddleware, validateParams(V.siteIdParamSchema));

const controller = container.resolve(OrchestratorController);

router.post("/chat", validateBody(V.orchestratorChatBodySchema), controller.chat);
router.post(
  "/onboarding/chat",
  validateBody(V.orchestratorOnboardingChatBodySchema),
  controller.onboardingChat
);

router.get("/threads", validateQuery(V.threadListQuerySchema), controller.listThreads);
router.get("/threads/:threadId", validateParams(V.threadIdParamSchema), controller.getThread);
router.patch(
  "/threads/:threadId",
  validateParams(V.threadIdParamSchema),
  validateBody(V.renameThreadBodySchema),
  controller.renameThread
);

router.get("/approvals", validateQuery(V.approvalListQuerySchema), controller.listApprovals);
router.post(
  "/approvals/:approvalId/decide",
  validateParams(V.approvalIdParamSchema),
  validateBody(V.orchestratorApprovalDecisionBodySchema),
  controller.decideApproval
);

export default router;
