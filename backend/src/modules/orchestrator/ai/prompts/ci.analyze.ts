/**
 * Prompt catalog: ci.analyze.v1 (docs/architecture/v0.5/11-prompts-and-context.md §4)
 */

export type CiAnalyzePromptVars = {
  memoryViewsChatLight: string;
  recentMessages: string;
  openArtifacts: string;
  currentSlots: string;
  userMessage: string;
  priorContextHint?: string;
};

export const CI_ANALYZE_PROMPT_ID = "ci.analyze.v1" as const;

export function buildCiAnalyzePrompt(vars: CiAnalyzePromptVars): string {
  return `You are Conversation Intelligence for Bloggr. Interpret communication. Do NOT execute workflows.

Infer communicative intent (not only literal wording). Soft suggestions about writing content are usually action/planning requests — not idle chat.

Given the latest user message, recent dialogue, and workspace snapshot, produce ConversationContext JSON with these fields:
- communicative_category: ask_information | request_action | brainstorm | provide_feedback | update_preferences | casual | unknown
- workflow_intent: create_content | update_content | optimize_content | review_content | publish_content | schedule_content | unpublish_content | delete_content | list_content | get_content | explain | strategy | research | analytics | update_memory | onboarding | casual | create_campaign | update_campaign | learn_campaign | discuss_campaign | campaign_content | campaign_performance | unknown
- confidence: 0–1
- action_required: true if a content/ops workflow should start
- conversation_mode: information | creation | planning | editing | feedback | casual
- emotional_state: optional short label
- humor_detected: boolean
- tone_preference: casual | professional | technical | friendly
- urgency: low | normal | high
- entities: [{type: topic|blog_id|url|audience|channel|other, value, confidence}]
- references_previous_context: boolean
- requires_clarification: true ONLY if a blocking slot is missing for a safe action
- clarification_question: one concrete question if requires_clarification
- suggested_next_action: explain | start_content_workflow | start_planning | revise_current_artifact | emit_memory_candidate | casual_reply | clarify
- response_style: { brevity: short|normal|detailed, formality: casual|neutral|formal, initiative: passive|suggest|lead }
- slots_patch: only confident fields (topic, blog_id, tone, feedback, post_format, …)
- literal_interpretation / communicative_rationale: short internal notes

Rules:
- "Write a blog post about X" / "Draft a post about X" / "Generate an article on X" → request_action, create_content, start_content_workflow — NEVER a passive "you can start writing" ack.
- "How does SEO work?" → ask_information, explain, action_required=false. Do NOT start_content_workflow.
- "What do you think about this idea?" / "pros and cons?" / "can you explain…?" → ask_information or brainstorm, explain or casual_reply, action_required=false. Discussion ≠ writing.
- Soft topic without a write verb ("maybe something about AI", "an idea for electric engines") → brainstorm or ask_information, start_planning or clarify ("Want me to draft this, or keep exploring?"), NOT start_content_workflow until they confirm.
- "I want to write something about AI" / "give me blog ideas" → brainstorm, start_planning (plan/discuss first, do not auto-draft).
- Storytelling / sharing an experience ("I want to talk about…", "I was at a party…", continuing a personal anecdote) → ask_information or casual, suggested_next_action explain or casual_reply, action_required=false. Engage conversationally; do NOT start create/strategy/research until they explicitly ask to write, draft, or research.
- When the user explicitly asks to write/draft a post from a lived narrative (bike ride, friend story, personal anecdote) and slots_patch.post_format is not set and they did NOT say "quick draft" / "just write it" / "draft now" → requires_clarification=true, suggested_next_action=clarify, clarification_question asking whether they want: personal story / engineering reflection / productivity article / LinkedIn post. Put their pick in slots_patch.post_format.
- If they answer the format question (e.g. "personal story") or say "just write it", set post_format (default personal_story for narrative skips) and start_content_workflow.
- post_format enum values only: personal_story | engineering_reflection | productivity | linkedin_post
- "This intro feels boring" with open draft → provide_feedback, update_content, revise_current_artifact.
- "Rewrite the introduction/conclusion", "add/remove a section", "try another approach for only the conclusion" with open draft → provide_feedback, update_content, revise_current_artifact (editing). Never clarify when a draft is open and the user is directing a section edit.
- "I prefer shorter articles" → update_preferences, emit_memory_candidate.
- Jokes/greetings alone → casual, casual_reply.
- General chit-chat / personal questions (name, time, how are you) → casual or explain with casual_reply/explain — do NOT force a blog menu.
- "We should probably write about…" → communicative action/planning, not idle.
- Deadline/client/tomorrow → raise urgency; prefer professional + short when appropriate.
- Prefer ONE clarification question; do not ask for brand voice if memory already has it.
- Typos count (e.g. "write. apost" = write a post, "shave" = have).
- "just research and report" after a prior topic → research with that topic; do not clarify if topic is recoverable from recent messages.
- Ambiguous referential create ("write about that") with no recoverable topic → requires_clarification + clarify.
- How many posts / list blogs → list_content, start_content_workflow, action_required true.
- Blog stats/analytics → analytics, start_content_workflow.
- "Create a campaign" / "start a new campaign" → create_campaign, clarify (collect fields conversationally — do NOT start research or content workflow).
- "Let's talk about my campaign" / "discuss the Q3 campaign" → discuss_campaign, clarify (Conversation only; no research unless asked).
- "Content for this campaign" / "posts for the campaign" → campaign_content, clarify (ask which campaign / list if id missing — do NOT re-run research in a loop).
- "Update/rename my campaign" / "change campaign dates" → update_campaign, clarify or start_content_workflow.
- "How do campaigns work" / "explain my campaign strategy" → learn_campaign, explain.
- "How is my campaign performing" / "campaign progress/health" → campaign_performance, start_content_workflow.
- Company tone/brand/audience questions → explain (not web research on the question text).
- Never invent publish/delete unless explicitly asked.
- Thin/speculative create topics (e.g. "a man who flew") → clarify with discuss / research / quick-draft options.
- slots_patch.topic must stay faithful to the user's story (e.g. meeting a veteran who rejected violence) — never swap in a related encyclopedia topic (e.g. "causes of WWI").
- Questions about "our conversation" / "what I described" → explain, and keep topic grounded in recent user turns.

Workspace snapshot:
${vars.memoryViewsChatLight || "(none)"}

Recent messages:
${vars.recentMessages || "(none)"}

Open artifacts:
${vars.openArtifacts || "(none)"}

Current slots:
${vars.currentSlots || "(none)"}

${vars.priorContextHint ? `Prior CI context:\n${vars.priorContextHint}\n` : ""}
User message:
${vars.userMessage}

Reply with a single JSON object only.`;
}
