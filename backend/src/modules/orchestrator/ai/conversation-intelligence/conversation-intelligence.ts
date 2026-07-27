import { injectable } from "tsyringe";
import {
  conversationContextSchema,
  type ConversationContext,
} from "../contracts/conversation-context";
import {
  analyzeConversationDeterministic,
  type ConversationIntelligenceInput,
} from "./pipeline/analyze-deterministic";

export type { ConversationIntelligenceInput };

/**
 * Conversation Intelligence facade (doc 19).
 * Interprets only — never invokes Skills/Tools or writes belief Mongo.
 */
@injectable()
export class ConversationIntelligenceService {
  async analyze(input: ConversationIntelligenceInput): Promise<ConversationContext> {
    const raw = analyzeConversationDeterministic(input);
    return conversationContextSchema.parse(raw);
  }
}
