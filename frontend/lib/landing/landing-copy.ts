export const LANDING_SEO = {
  title: "Bloggr — AI content strategist that knows your business",
  description:
    "Plan, research, write, and publish on-brand blog content through conversation—not endless prompts. Full access free.",
} as const;

export const LANDING_CTAS = {
  startFree: "Start free",
  startFreeFull: "Start free — full access",
  seeHow: "See how it works",
  logIn: "Log in",
  dashboard: "Go to Dashboard",
  switchToBloggr: "Switch to Bloggr",
  watchOverview: "Watch 90s overview",
  contact: "Contact us",
  readDocs: "Read the docs →",
  trustLine: "Full access on Free. No waitlist. No credit card.",
} as const;

export const HERO = {
  eyebrow: "AI content strategist",
  h1: "Talk about your business. Ship content that sounds like you.",
  subhead:
    "Bloggr remembers your positioning, researches with sources, and turns natural conversation into on-brand posts—planned, drafted, and ready to publish.",
} as const;

export const PROOF_STRIP = "Built for founders and marketers who are done prompting.";

export const PROBLEM = {
  h2: "The blank page isn’t the problem. The workflow is.",
  lead: "ChatGPT can write a paragraph. It can’t remember your business, plan the month, or ship the post.",
  leftTitle: "The prompt treadmill",
  leftBullets: [
    "Re-brief your brand for every post.",
    "Jump between chat, docs, and your CMS.",
    "Generic drafts that need hours of cleanup.",
    "No campaign. No calendar. No memory.",
  ],
  rightTitle: "The hidden cost",
  rightBullets: [
    "Brand drift across posts.",
    "Strategy replaced by prompt engineering.",
    "Missed publish dates.",
    "Content you can’t defend to a cofounder or client.",
  ],
} as const;

export const PRODUCT_INTRO = {
  eyebrow: "The product",
  h2: "Meet the strategist that stays briefed.",
  body: "One conversation surface. Your business context stays loaded. Drafts, sources, and next steps appear beside the chat—so strategy and execution never split apart.",
} as const;

export const WALKTHROUGH = {
  h2: "From a sentence about your business to a publish plan.",
  steps: [
    {
      id: "goal",
      number: "01",
      title: "Say the goal",
      body: "“We’re targeting early-stage founders. Explain payment infrastructure this month.”",
    },
    {
      id: "context",
      number: "02",
      title: "Context loads",
      body: "Voice, audience, and offers stay attached—no re-brief.",
    },
    {
      id: "research",
      number: "03",
      title: "Research with sources",
      body: "Bloggr gathers evidence before it writes. You can see what informed the draft.",
    },
    {
      id: "draft",
      number: "04",
      title: "Draft you can steer",
      body: "On-brand HTML ready to refine in conversation—not a dump of generic paragraphs.",
    },
    {
      id: "calendar",
      number: "05",
      title: "Put it on the calendar",
      body: "Series and dates live next to the work, so shipping isn’t a separate project.",
    },
  ],
} as const;

export const HOW_IT_WORKS = {
  h2: "How Bloggr works",
  steps: [
    {
      number: "01",
      title: "Onboard once",
      body: "Tell Bloggr your positioning, voice, and audience. It remembers.",
    },
    {
      number: "02",
      title: "Plan in conversation",
      body: "Describe the month. Bloggr proposes angles, a series, and where posts fit.",
    },
    {
      number: "03",
      title: "Draft with sources",
      body: "Because context stays loaded, you talk like a teammate—not a prompt engineer—and get researched drafts back.",
    },
    {
      number: "04",
      title: "Ship from one place",
      body: "Draft, review, schedule, and publish without hopping ChatGPT → Docs → CMS.",
    },
  ],
} as const;

export const MEMORY = {
  eyebrow: "Business memory",
  h2: "Brief once. Every post starts informed.",
  body: "Audience, offers, voice, and objections don’t vanish after one chat. Bloggr keeps your business loaded so the next draft stays consistent without another brief.",
  bullets: [
    "Positioning and voice that persist.",
    "Preferences that stick (“shorter, more casual”).",
    "Per-workspace isolation—brands don’t bleed.",
  ],
  annotation: "Stays loaded across every post",
} as const;

export const RESEARCH = {
  eyebrow: "Research & quality",
  h2: "Not vibes—evidence.",
  body: "Before Bloggr writes, it researches. Sources and coverage show up with the draft so you can defend claims to a cofounder or client.",
  dual: ["Built to earn attention in search.", "Structured to be citable in AI answers."],
  footnote: "You steer. You approve before anything destructive publishes.",
  annotation: "Defend every claim",
} as const;

export const CAMPAIGNS = {
  eyebrow: "Campaigns & calendar",
  h2: "This month has a plan—not a pile of drafts.",
  body: "Campaigns carry messaging and goals. The calendar shows what ships when. Bloggr knows what you published last week and what you’re targeting next.",
  bullets: [
    "Default evergreen plus focused campaigns.",
    "Schedule and prepare posts in one view.",
    "Approvals when the team needs a gate.",
  ],
  annotation: "A plan, not a pile",
} as const;

export const PUBLISH = {
  h2: "Ship without the tool hop.",
  body: "Draft, review, schedule, and publish inside Bloggr—or pull content into your own frontend with the API.",
  pillarA: {
    title: "In-app publishing",
    body: "Schedule posts, review from email when needed, keep the calendar honest.",
  },
  pillarB: {
    title: "Your site, your frontend",
    body: "API keys and docs so Bloggr is the content brain and your site stays yours.",
  },
  microcopy:
    "Google Drive can feed your Library with brand docs. Native WordPress or social connectors aren’t the story—honesty is.",
} as const;

export const WHY_DIFFERENT = {
  h2: "Why Bloggr is different",
  pillars: [
    {
      title: "Conversation OS",
      body: "You talk about the business. Bloggr starts the work—not another chat that waits for the perfect prompt.",
    },
    {
      title: "Business memory",
      body: "Context stays loaded across posts, campaigns, and teammates in the workspace.",
    },
    {
      title: "Strategist pipeline",
      body: "Research → draft → quality → calendar → publish. One loop. One place.",
    },
  ],
} as const;

export const COMPARE = {
  h2: "ChatGPT writes. Bloggr runs content.",
  intro: "Use the best model when you need an answer. Use Bloggr when you need a content system.",
  headers: ["Capability", "ChatGPT", "Typical AI writer", "Bloggr"] as const,
  rows: [
    ["Remembers your business across posts", "Session-bound", "Brand voice profile", "Workspace business memory"],
    ["Research with visible sources before writing", "You paste links", "Sometimes", "Built into the draft loop"],
    ["Campaign + publishing calendar", "No", "Partial", "Yes"],
    ["Draft → schedule → publish in one place", "No", "Export elsewhere", "Yes"],
    ["You steer in natural conversation", "Prompt craft", "Templates + chat", "Collaborative strategist"],
    ["Full access to start", "Paid plans", "Trials / paid", "Free plan, full product"],
  ] as const,
} as const;

export const AUDIENCE = {
  h2: "Who Bloggr is for",
  personas: [
    {
      title: "Founders & creators",
      body: "Ship consistent, on-brand posts without a content hire.",
    },
    {
      title: "Marketers on small teams",
      body: "Turn a messy brief into a month you can defend—and publish.",
    },
    {
      title: "Agencies",
      body: "Keep each client’s voice and knowledge isolated in its own workspace.",
    },
  ],
  closing: "If you’d rather talk about the business than wrestle a blank doc, you’re in the right place.",
} as const;

export const SOCIAL_PROOF = {
  h2: "What we’re optimizing for",
  quotes: [
    "A strategist that already knows the business—not another blank chat.",
    "If the UI only shows the draft, we look like every other writer. Sources and memory have to stay visible.",
    "Full access on Free. Earn the upgrade when the work compounds.",
  ],
  attribution: "— Bloggr product principles",
} as const;

export const PRICING = {
  h2: "Simple pricing. Full access to start.",
  subhead: "Full product on Free. Upgrade when you outgrow limits.",
  plans: [
    {
      name: "Free",
      price: "$0",
      period: "",
      badge: "Full access",
      featured: true,
      bullets: ["Up to 3 blog posts", "1 workspace", "API access", "AI strategist workspace", "No credit card"],
    },
    {
      name: "Starter",
      price: "$5",
      period: "/month",
      badge: null,
      featured: false,
      bullets: ["Up to 10 posts", "AI generation & review", "1 workspace", "Basic campaigns", "API access"],
    },
    {
      name: "Professional",
      price: "$10",
      period: "/month",
      badge: "Most popular",
      featured: false,
      bullets: ["Up to 50 posts", "3 workspaces", "Unlimited campaigns", "Team collaboration", "Campaign templates"],
    },
    {
      name: "Enterprise",
      price: "$20",
      period: "/month",
      badge: null,
      featured: false,
      bullets: ["Unlimited posts & workspaces", "Advanced API", "Unlimited members", "Priority support"],
    },
  ],
} as const;

export const FAQ_ITEMS = [
  {
    q: "Is this just ChatGPT with a UI?",
    a: "No. Bloggr remembers your business, researches before it writes, plans in campaigns, and publishes from one workspace.",
  },
  {
    q: "Do I need a credit card?",
    a: "No. Start on Free with full product access. Upgrade when you need higher limits.",
  },
  {
    q: "Will it publish without my approval?",
    a: "Destructive publish actions ask for confirmation. You stay in control of what goes live.",
  },
  {
    q: "How is this different from Jasper or other AI writers?",
    a: "Those tools optimize for generating assets. Bloggr optimizes for running a content strategy—memory, research, campaigns, calendar, and publish—in one loop.",
  },
  {
    q: "Can I use my own site?",
    a: "Yes. Publish and manage in Bloggr, and deliver to your frontend with the public API.",
  },
  {
    q: "What does Bloggr remember?",
    a: "Business context for your workspace—audience, voice, offers, and preferences—so you don’t re-brief every post. Memory stays scoped to the workspace.",
  },
  {
    q: "What if the AI gets something wrong?",
    a: "You steer in conversation, review sources with the draft, and approve before publish. Treat it like a strategist on your team—not an autopilot.",
  },
  {
    q: "Is there a waitlist?",
    a: "No. Full access is open—create an account and start.",
  },
  {
    q: "Can my team join?",
    a: "Yes. Invite teammates with roles. Approvals help when you want a gate on risky actions.",
  },
  {
    q: "Who owns my content?",
    a: "You do. Your workspace content remains yours.",
  },
] as const;

export const FINAL_CTA = {
  h2: "Start with full access. Brief your business once.",
  body: "Your business, already briefed—every draft after that gets easier.",
  trust: "No waitlist. No credit card.",
} as const;

export const FOOTER_TAGLINE = "Context-aware blog posts from conversation, not prompts.";
