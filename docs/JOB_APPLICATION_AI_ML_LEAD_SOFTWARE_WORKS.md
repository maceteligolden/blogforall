# Application: AI / ML Engineer (Lead) – Software Works for You Ltd

**Candidate:** Golden Mac-Eteli  
**Role:** AI / ML Engineer (Lead)  
**Prepared from:** WatchNode (ML observability), job-application-helper (LLM/CV), Houser (conversational AI), and related production experience.

---

## 1. Production AI Experience

I took an **ML-powered log observability feature** from concept to production in **WatchNode**, a SaaS platform for intelligent log monitoring and anomaly detection. My role was end-to-end: architecture, model choice, pipeline design, backend and ML integration, and deployment.

**What I built:** A multi-algorithm anomaly detection system that runs over log streams from sources like AWS CloudWatch. The pipeline does not train from scratch; it orchestrates **HuggingFace Inference API** (sentence-transformers for embeddings) plus handcrafted statistical and temporal logic. I implemented four detection modes: **semantic** (embedding similarity to a per–log-group baseline), **statistical** (message length, word count, log level, error keywords with Z-scores), **temporal** (inter-log intervals, hourly volume, time-of-day patterns), and **sequence** (sliding-window signatures of log flows). I chose this hybrid so we could ship quickly with API-based inference while still supporting optional **domain adaptation**: a Python LoRa fine-tuning script (PyTorch, PEFT on `sentence-transformers/all-MiniLM-L6-v2`) is invoked by the Node backend via `child_process` for per–log-group adapters when users mark anomalies as false positives or resolved—those become “normal” examples for the next training run. Baselines and adapter metadata are versioned and stored on disk (and in DB); we support rollback.

**Stack:** Node.js/Express/TypeScript (API, queues, orchestration), HuggingFace Inference (embeddings), Python (LoRa training), MongoDB (anomalies, log groups, data sources), Redis/BullMQ (pull-and-detect and train-adapter jobs), AWS (CloudWatch, S3, ECS), Terraform. Logs are not stored in our DB; we fetch on demand from connectors (e.g. CloudWatch), run the min-data check (e.g. ≥1,000 logs over ≥24h), then run detection in memory and persist only anomaly records with a small log snapshot.

**Success once live:** We measured success through **operational metrics** (pipeline runs, anomaly volume, time-to-detect), **data-quality gates** (baseline readiness, training status), and **user feedback**: anomaly status (NEW → REVIEWED → RESOLVED / FALSE_POSITIVE) feeds back into the adapter training so the system improves per customer. I didn’t ship a formal offline precision/recall dashboard initially; instead we used clear severity bands (from confidence and anomaly score), model_version on each detection, and the human feedback loop as the primary quality signal—appropriate for an early-stage product where we prioritised shipping and iteration over heavy evaluation infra.

---

## 2. LLM API & RAG Architecture

For a **RAG pipeline over a large, domain-specific knowledge base** (e.g. gas compliance and operational docs), I’d design it as follows, assuming we orchestrate LLM APIs and don’t train base models.

**Embedding strategy:** I’d use a **domain-aware embedding model** rather than a generic one. If the corpus is UK gas compliance text, I’d start with something like `sentence-transformers/all-MiniLM-L6-v2` or a larger model (e.g. `BAAI/bge` variants) for good quality/speed trade-off, and consider **fine-tuning a small adapter** (as I did in WatchNode for log semantics) if we have labelled query–passage pairs or can mine them from usage. Embeddings would be computed in a batch indexing job and updated incrementally when the knowledge base changes. I’d keep embedding and chunking dimensions consistent so we can swap models later without re-chunking.

**Chunking:** I’d use **semantic chunking** with overlap rather than fixed character splits: split on section boundaries (headings, lists, tables) first, then apply a max token limit per chunk (e.g. 512 tokens) with a small overlap (e.g. 50 tokens) to avoid cutting mid-sentence. For compliance, preserving “one regulation = one unit” where possible is important, so I’d prefer **section- or paragraph-based chunks** with optional sub-chunking for very long sections. I’d store chunk metadata (source doc, section, regulation id, date) for citation and filtering.

**Vector database:** I’d choose **pgvector** (PostgreSQL) if the rest of the stack is already on Postgres—simplest ops and ACID with existing data—or **Pinecone/Weaviate** if we need scale and managed infra. For a compliance use case, I’d prioritise **filtering** (by document type, date, regulation) and **hybrid search**: vector similarity plus keyword/BM25 for exact terms (e.g. regulation numbers). So the retrieval step would be: optional filters → vector top-k → optional rerank or keyword fusion.

**Pipeline flow:** Ingest docs → chunk with metadata → embed (batch job, idempotent) → upsert into vector DB. At query time: embed query → vector search (+ filters) → optional rerank (e.g. cross-encoder or LLM) → build context window → call LLM with system prompt (“Answer only from the context; cite sources”) → parse and validate response (e.g. extract citations). I’d version prompts and index config so we can A/B test and roll back.

**Why these choices:** Section-based chunking preserves regulatory context; hybrid search helps with exact references; a single vector store (e.g. pgvector) keeps the system simple to run and audit; and keeping embedding and chunking under our control allows future domain adapters without changing the rest of the RAG stack.

---

## 3. Evaluation & Quality Pipelines

In **WatchNode**, accuracy and reliability are important because we’re flagging anomalies that can drive alerts. I didn’t build a full offline evaluation suite from day one; instead I built **quality and operational guardrails** that fit a compliance-minded mindset and that I’d extend into a formal eval pipeline in a role like yours.

**What I implemented:**  
- **Data-quality gates:** Detection and training only run when we have sufficient data (e.g. ≥1,000 logs over ≥24h). We expose a “baseline readiness” API so the product can tell users when they’re ready for detection.  
- **Anomaly lifecycle and feedback:** Every detection has status (NEW, REVIEWED, RESOLVED, FALSE_POSITIVE). Resolved and false-positive cases are used as “normal” examples for the optional LoRa adapter training, creating a **human-in-the-loop** quality loop.  
- **Traceability:** Each anomaly stores `model_version`, `provider`, and detection config (thresholds, min confidence). Severity is derived from confidence and score (low/medium/high/critical) so we can prioritise and audit.  
- **Training status:** We persist training state (idle / training / completed / failed) with optional error message and adapter version, and support rollback to a previous adapter.

**In a compliance-heavy domain** I would add:  
- **Golden set and regression tests:** A curated set of (query, expected behaviour or expected citation) and run it on every prompt/index change; track precision, recall, and citation accuracy.  
- **Structured metrics:** Per-doc-type or per-regulation accuracy, failure rate, and “refusal” rate (e.g. “I don’t know” or out-of-scope).  
- **Edge cases and failures:** Classify failures (e.g. no retrieval, low confidence, hallucination, wrong citation) and route to a review queue or fallback (e.g. “speak to an expert”); log all model inputs/outputs (redacted if needed) for auditing.  
- **Alerts:** If accuracy or failure rate degrades beyond a threshold, trigger alerts and optionally auto-rollback the prompt or model version.

So: I’ve built production guardrails and feedback loops; in your environment I’d extend that into explicit evaluation pipelines, golden sets, and compliance-oriented metrics and failure handling.

---

## 4. Python & Integration Architecture (Python AI service + PHP/Laravel)

I’ve built a **Node + Python** hybrid in WatchNode (Node for API and queues, Python for LoRa training), so the same patterns apply to **Python AI service alongside a PHP/Laravel monolith**.

**Integration layer:**  
- **Communication:** I’d expose the Python service as an **HTTP REST API** (or gRPC if we need streaming or very low latency). Laravel would call it via HTTP client (e.g. Guzzle) with timeouts and retries. I’d avoid sharing a DB for request/response; keep the contract at the API boundary so we can scale and version the AI service independently.  
- **Contract:** Versioned routes (e.g. `/v1/embed`, `/v1/complete`, `/v1/rag`) with clear request/response schemas (JSON). I’d document and optionally publish an OpenAPI spec so both sides can validate.  
- **Error handling:** Python returns structured errors (e.g. 503 + `{"error": "model_unavailable"}`). Laravel maps these to application-level errors (e.g. “AI service temporarily unavailable”) and, where appropriate, queues a retry or shows a graceful message. I’d use idempotency keys for any non-idempotent AI calls so retries are safe.  
- **Timeouts and backpressure:** Set timeouts (e.g. 30s for RAG, 60s for long generations). If the Python service is overloaded, it should return 503 so Laravel can back off or use a circuit breaker (e.g. after N failures, stop calling for a cooldown period).

**Deployment:**  
- Run the Python service as its own **containerised** service (Docker); deploy with the same orchestration as the rest of the stack (e.g. ECS, Kubernetes, or a PaaS).  
- **Secrets:** API keys (e.g. LLM, embedding) live in env or a secret manager; the Python service reads them at startup, never the Laravel app.  
- **Scaling:** Scale the Python service independently based on queue depth or request latency. Optionally put a **queue** (e.g. Redis/RabbitMQ) between Laravel and Python for async jobs (e.g. “generate report”) so Laravel doesn’t block on long-running AI tasks.

**Why this way:** HTTP keeps the monolith and the AI service decoupled and language-agnostic; versioned APIs allow non-breaking changes; and queues plus timeouts prevent the main app from being blocked by AI latency or outages.

---

## 5. Prompt Engineering at Scale

Two concrete examples from my work:

**WatchNode (implicit “prompts”):** The “prompts” are the **detection config** (thresholds, min confidence, which detection types to run) and the **baseline construction** (e.g. how we aggregate embeddings). We don’t ship a classic LLM prompt there, but we do ship **configuration as code**: thresholds and model types are env-driven and stored with each run so we can reproduce and roll back. That’s the same idea as versioning prompts.

**Job-application-helper & Houser (explicit prompts):**  
- In **job-application-helper** I built a **prompt framework** (see `PROMPT_FRAMEWORK.md`): named templates (e.g. `job-analysis-recruiter`, `cv-generation-optimized`, `cv-match-analysis`) with system/user message builders, **token estimation** (≈4 chars per token) before calling the API, and **response length limits** (e.g. 1500–3000 tokens) to control cost and latency. The “recruiter” persona is encoded in the system prompt to get consistent, structured JSON for job analysis and CV matching. I use a single entry point (`promptFramework.build(templateId, data)`) so we can swap or A/B test templates without changing call sites.  
- In **Houser** I designed **conversational** and **extraction** prompts: a **system prompt** for a UK housing assistant that collects commute, job, hobbies, household, and locations in a few turns, and a separate **extraction prompt** that takes the conversation and returns structured JSON (profession, commute tolerance, hobbies, household, budget, transport, office/hobby/family places). We validate the extracted JSON with Zod and re-prompt or fall back if it’s invalid. The extraction prompt is explicit: “Return ONLY valid JSON with these fields (use null for missing)” to reduce parsing errors.

**Versioning and iteration:**  
- **Templates in code:** Prompts live in versioned files (e.g. `agentSystem.ts`, `agentExtractFromConvo.ts`, framework templates); changes go through code review and deploy.  
- **Testing:** For extraction, we have schema validation (Zod) on every response; for chat, we’d add a small set of canonical conversations and assert that extraction and intent stay correct.  
- **Observability:** I log prompt identifiers and token estimates (and in production I’d add response length and latency) so we can correlate failures and cost with prompt versions.  

So: I’ve done structured prompt frameworks, token control, schema validation, and config-driven behaviour; in your setup I’d add explicit prompt version tags in the API and optional A/B tests by version.

---

## 6. Domain-Specific Data (e.g. 10+ years UK gas compliance data)

If I were given a large, structured dataset in a regulated domain I wasn’t initially familiar with, I’d do the following.

**Understand the data:**  
- **Schema and lineage:** Map tables, fields, keys, and how data flows (ETL, sources). Document what each entity represents in the business (e.g. “inspection”, “certificate”, “asset”).  
- **Domain learning:** Work with subject-matter experts (SMEs) and read a small set of regulations and internal docs to learn the vocabulary and main processes. I’d focus on “what decisions do people make from this data?” and “where do errors or delays hurt most?”  
- **Profiling:** Run basic stats (distributions, nulls, duplicates, time ranges). Look for data quality issues (e.g. legacy codes, changed schemas) and gaps (e.g. missing years, regions).  
- **Compliance constraints:** Clarify what may be used for ML (e.g. PII, audit trails), what must be explainable, and what needs human sign-off.

**Identify high-value AI opportunities:**  
- List **repeated manual tasks** (e.g. classifying documents, checking fields, suggesting next actions) and **bottlenecks** (e.g. expert time, backlog of cases).  
- For each, estimate **impact** (time/cost saved, error reduction) and **feasibility** (data availability, clarity of “correct” outcome, regulatory acceptability).  
- Prioritise **quick wins** that have clear success criteria and low regulatory risk (e.g. draft classifications for human review, not fully automated decisions).

**Prioritise what to build first:**  
- I’d pick one or two **pilot use cases** that: (1) have enough labelled or easily labellable data (or clear rules), (2) have an SME willing to validate outputs, and (3) can be measured (e.g. time per case, agreement rate with experts).  
- I’d deliver a **minimal end-to-end flow** (e.g. “upload document → AI suggests category + confidence → human confirms or corrects”) and use the feedback to improve the model and the process. Then iterate and expand to the next use case.  
- I’d avoid building a “do everything” model first; I’d rather ship a narrow, well-defined feature and then extend.

---

## 7. Shipping Speed & Iteration

In **WatchNode**, we had to ship an end-to-end anomaly detection experience quickly. I **shipped a hybrid design** (API-based inference + optional Python training) rather than training custom models from scratch, so we could get to production in weeks. The trade-off was accepting that the first version used a general-purpose embedding model and simple baselines; we added the LoRa adapter path and human feedback loop as the next iteration so we could improve per customer without blocking the first release.

In **Houser**, we needed a conversational flow that collected lifestyle and locations for property search. I **scoped the agent** to a fixed set of slots (commute, job, hobbies, household, places) and a short system prompt so we could ship with one LLM call for extraction and one for reply, and avoid multi-step planning. We trimmed conversation length (e.g. last N turns, character limit) to keep latency and cost under control. The trade-off was less “open” conversation in return for reliable extraction and a clear path to production.

**Balance of speed and quality:** I use **gates** (e.g. min data, schema validation, confidence thresholds) so we don’t show low-quality outputs; I **version** config and models so we can roll back; and I **iterate** using real user feedback (e.g. anomaly status, extraction errors) so the next version is data-driven. I’m comfortable shipping a “good enough” v1 and improving it with usage.

---

## 8. Working Autonomously

I’m comfortable **operating without an established AI team** and defining technical direction and roadmap. In WatchNode I was responsible for the entire ML design: choosing HuggingFace vs. training from scratch, designing the four detection algorithms, the Node–Python boundary, the queue-based pipeline, and the feedback loop into adapter training. I made the call to keep inference in Node (via HuggingFace API) and reserve Python for training so we could move fast and avoid operating a separate inference service at first. I’ve also driven the prompt framework and agent design in job-application-helper and Houser without a dedicated AI team, and I’ve written PRDs and architecture docs (e.g. auth and flows) in other projects.

I’d treat this role as **building the function from the ground up**: define a small set of initial use cases (aligned with your compliance and data), propose an architecture (e.g. Python microservice, RAG where needed, eval pipeline), and iterate with stakeholders and real usage. I’m used to making choices, documenting them, and adjusting when we learn more.

---

## 9. Cost & Performance Optimisation (LLM API costs)

I’ve managed cost and performance in several ways:

**Token and prompt control:**  
- **Token estimation** before calls (e.g. ~4 chars per token) and **capping response length** (e.g. `max_tokens` / `max_new_tokens`) so we don’t pay for unnecessarily long outputs. In the job-application-helper framework, each template has a target token budget and we trim inputs (e.g. last 8000 chars of context) when needed.  
- **Structured prompts** and “return only JSON” reduce retries and parsing failures, so we don’t burn extra calls.  
- **Smaller/faster models** where possible (e.g. feature extraction with `all-MiniLM-L6-v2` in WatchNode instead of a large LM).

**Caching and batching:**  
- For RAG, I’d **cache embeddings** for the same document chunks and **cache** or **deduplicate** identical queries where safe.  
- For batch jobs (e.g. nightly reports), batch requests where the API allows it to amortise overhead.

**Observability and budgets:**  
- Log **estimated or actual token usage** per request and per feature so we can see which flows dominate cost.  
- Set **alerts** or budget caps (e.g. daily spend or request count) so we notice spikes early.  
- **Fallbacks:** If a premium model fails or is rate-limited, have a cheaper/smaller model or a “degraded” response path so we don’t retry expensive calls blindly.

**Trade-offs:** I’d choose a **slightly smaller or faster model** if latency and cost are tight, and reserve a larger model for tasks that need higher quality (e.g. final compliance summary). I’m used to making these trade-offs explicitly and revisiting them as usage and requirements evolve.

---

## 10. Salary & Availability

[Please fill in your details.]

- **Salary expectations:** [Your range, e.g. “£X–Y depending on scope and benefits.”]  
- **Earliest start date:** [e.g. “Two weeks from offer” or “Immediate.”]  
- **Location / right to work:** [e.g. “I am currently based in [UK/other]. I have the right to work in the UK.”]

---

## Fit summary (for your reference)

- **Production AI:** WatchNode is a strong fit: multi-algorithm anomaly detection, HuggingFace API orchestration, Node+Python hybrid, queues, baselines, and human-in-the-loop improvement.  
- **RAG:** You have embedding and baseline experience (WatchNode); the answers above describe how I’d design RAG for a compliance knowledge base.  
- **Evaluation / compliance:** You have data-quality gates, feedback loops, and traceability; the role would push you to add formal eval pipelines and metrics.  
- **Python + Laravel:** Your Node+Python and API-based integration experience map directly to a Python microservice talking to Laravel over HTTP.  
- **Prompts:** Job-application-helper (framework, token control, templates) and Houser (conversation + extraction, validation) show prompt engineering at a production level.  
- **Domain data:** You’ve worked with log streams and structured product data; the approach in Q6 is how you’d get up to speed on gas compliance data.  
- **Shipping and autonomy:** WatchNode and Houser show shipping under constraints and defining the ML design yourself.

I’d position WatchNode as “ML-powered observability with hybrid detection (semantic, statistical, temporal, sequence), API-driven inference, optional per-customer LoRa adapters, and human feedback integrated into training.” That aligns well with their “orchestrating LLM APIs” and “compliance-heavy” context.
