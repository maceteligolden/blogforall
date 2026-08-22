import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const timestamps = {
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    password: text("password").notNull(),
    first_name: text("first_name").notNull(),
    last_name: text("last_name").notNull(),
    phone_number: text("phone_number"),
    role: text("role").notNull().default("user"),
    plan: text("plan").notNull().default("free"),
    sessionToken: text("session_token"),
    resetPasswordToken: text("reset_password_token"),
    resetPasswordExpires: timestamp("reset_password_expires", { withTimezone: true }),
    resetPasswordAttempts: integer("reset_password_attempts").notNull().default(0),
    stripe_customer_id: text("stripe_customer_id"),
    onboarding_completed: boolean("onboarding_completed").notNull().default(false),
    terms_accepted_at: timestamp("terms_accepted_at", { withTimezone: true }),
    terms_version: text("terms_version"),
    referral_code: text("referral_code"),
    referred_by_user_id: uuid("referred_by_user_id"),
    workspace_invite_prompt_dismissed_at: timestamp("workspace_invite_prompt_dismissed_at", { withTimezone: true }),
    plan_selection_completed_at: timestamp("plan_selection_completed_at", { withTimezone: true }),
    strategist_ready_acknowledged_at: timestamp("strategist_ready_acknowledged_at", { withTimezone: true }),
    email_verified: boolean("email_verified").notNull().default(false),
    email_verification_token: text("email_verification_token"),
    email_verification_expires: timestamp("email_verification_expires", { withTimezone: true }),
    email_verification_attempts: integer("email_verification_attempts").notNull().default(0),
    company_role: text("company_role"),
    company_role_detail: text("company_role_detail"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_referral_code_unique")
      .on(table.referral_code)
      .where(sql`${table.referral_code} is not null`),
    index("users_stripe_customer_id_idx").on(table.stripe_customer_id),
    index("users_onboarding_completed_idx").on(table.onboarding_completed),
    index("users_email_verified_idx").on(table.email_verified),
    index("users_referred_by_user_id_idx").on(table.referred_by_user_id),
  ]
);

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    slug: text("slug").notNull(),
    public_id: text("public_id").notNull(),
    owner: uuid("owner")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    website_url: text("website_url"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sites_slug_unique").on(table.slug),
    uniqueIndex("sites_public_id_unique").on(table.public_id),
    index("sites_owner_idx").on(table.owner),
    index("sites_status_idx").on(table.status),
  ]
);

export const siteMembers = pgTable(
  "site_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    site_id: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("viewer"),
    joined_at: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("site_members_site_user_unique").on(table.site_id, table.user_id),
    index("site_members_user_id_idx").on(table.user_id),
    index("site_members_site_role_idx").on(table.site_id, table.role),
  ]
);

export const siteInvitations = pgTable(
  "site_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    site_id: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("viewer"),
    token: text("token").notNull(),
    status: text("status").notNull().default("pending"),
    invited_by: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    accepted_at: timestamp("accepted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("site_invitations_token_unique").on(table.token),
    index("site_invitations_site_email_status_idx").on(table.site_id, table.email, table.status),
    index("site_invitations_email_status_idx").on(table.email, table.status),
    index("site_invitations_expires_at_idx").on(table.expires_at),
  ]
);

export const workspaceApiKeys = pgTable(
  "workspace_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    site_id: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    accessKeyId: text("access_key_id").notNull(),
    hashedSecret: text("hashed_secret").notNull(),
    secret_encrypted: text("secret_encrypted").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsed: timestamp("last_used", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    uniqueIndex("workspace_api_keys_access_key_id_unique").on(table.accessKeyId),
    index("workspace_api_keys_site_access_idx").on(table.site_id, table.accessKeyId),
  ]
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    site_id: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    parent: uuid("parent"),
    color: text("color"),
    is_active: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("categories_site_slug_unique").on(table.site_id, table.slug),
    index("categories_site_parent_idx").on(table.site_id, table.parent),
    index("categories_site_active_idx").on(table.site_id, table.is_active),
  ]
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    site_id: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    goal: text("goal").notNull(),
    target_audience: text("target_audience"),
    status: text("status").notNull().default("draft"),
    lifecycle_status: text("lifecycle_status").notNull().default("draft"),
    campaign_type: text("campaign_type"),
    health_status: text("health_status"),
    health_computed_at: timestamp("health_computed_at", { withTimezone: true }),
    health_reasons: text("health_reasons")
      .array()
      .notNull()
      .default(sql`'{}'`),
    is_default: boolean("is_default").notNull().default(false),
    strategy_id: text("strategy_id"),
    messaging: text("messaging"),
    desired_transformation: text("desired_transformation"),
    funnel_focus: text("funnel_focus"),
    guardrails: text("guardrails")
      .array()
      .notNull()
      .default(sql`'{}'`),
    assumptions: text("assumptions")
      .array()
      .notNull()
      .default(sql`'{}'`),
    hypotheses: text("hypotheses")
      .array()
      .notNull()
      .default(sql`'{}'`),
    related_products: text("related_products")
      .array()
      .notNull()
      .default(sql`'{}'`),
    supporting_evidence: text("supporting_evidence")
      .array()
      .notNull()
      .default(sql`'{}'`),
    intelligence: jsonb("intelligence").$type<Record<string, unknown>>(),
    content_autonomy: text("content_autonomy"),
    publishing_mode: text("publishing_mode"),
    approval_policy: text("approval_policy"),
    primary_topics: text("primary_topics")
      .array()
      .notNull()
      .default(sql`'{}'`),
    cta_strategy: jsonb("cta_strategy").$type<Record<string, unknown>>(),
    notifications: jsonb("notifications").$type<Record<string, unknown>>(),
    start_date: timestamp("start_date", { withTimezone: true }).notNull(),
    end_date: timestamp("end_date", { withTimezone: true }).notNull(),
    posting_frequency: text("posting_frequency").notNull(),
    custom_schedule: text("custom_schedule"),
    timezone: text("timezone").notNull().default("UTC"),
    total_posts_planned: integer("total_posts_planned"),
    posts_published: integer("posts_published").notNull().default(0),
    budget: real("budget"),
    success_metrics: jsonb("success_metrics").$type<Record<string, unknown>>(),
    ai_strategy: jsonb("ai_strategy").$type<Record<string, unknown>>(),
    template_id: uuid("template_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("unique_default_campaign_per_site")
      .on(table.site_id)
      .where(sql`${table.is_default} = true`),
    index("campaigns_site_user_status_idx").on(table.site_id, table.user_id, table.status),
    index("campaigns_site_lifecycle_idx").on(table.site_id, table.lifecycle_status),
    index("campaigns_site_dates_idx").on(table.site_id, table.start_date, table.end_date),
  ]
);

export const blogs = pgTable(
  "blogs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    author: uuid("author")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    site_id: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    campaign_id: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    strategy_id: text("strategy_id"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    content_type: text("content_type").notNull().default("html"),
    content_blocks: jsonb("content_blocks").$type<unknown[]>(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt"),
    featured_image: text("featured_image"),
    images: text("images")
      .array()
      .notNull()
      .default(sql`'{}'`),
    status: text("status").notNull().default("draft"),
    category: uuid("category").references(() => categories.id, { onDelete: "set null" }),
    likes: integer("likes").notNull().default(0),
    views: integer("views").notNull().default(0),
    published_at: timestamp("published_at", { withTimezone: true }),
    dynamic_forms: jsonb("dynamic_forms").$type<Record<string, unknown>>(),
    meta: jsonb("meta").$type<{ description?: string; keywords?: string[] }>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("blogs_site_slug_unique").on(table.site_id, table.slug),
    index("blogs_site_author_status_idx").on(table.site_id, table.author, table.status),
    index("blogs_site_status_published_idx").on(table.site_id, table.status, table.published_at),
    index("blogs_site_category_status_idx").on(table.site_id, table.category, table.status),
    index("blogs_site_campaign_idx").on(table.site_id, table.campaign_id),
  ]
);

export const blogLikes = pgTable(
  "blog_likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blog_id: uuid("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    actor: text("actor").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("blog_likes_blog_actor_unique").on(table.blog_id, table.actor)]
);

export const blogVersions = pgTable(
  "blog_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blog_id: uuid("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    review_id: text("review_id"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("blog_versions_blog_version_unique").on(table.blog_id, table.version)]
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blog: uuid("blog")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    author_name: text("author_name").notNull(),
    author_email: text("author_email"),
    author_id: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    content: text("content").notNull(),
    parent_comment: uuid("parent_comment"),
    is_approved: boolean("is_approved").notNull().default(true),
    likes: integer("likes").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("comments_blog_created_idx").on(table.blog, table.created_at),
    index("comments_parent_idx").on(table.parent_comment),
  ]
);

export const commentLikes = pgTable(
  "comment_likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    comment_id: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    actor: text("actor").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("comment_likes_comment_actor_unique").on(table.comment_id, table.actor)]
);

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    first_name: text("first_name").notNull(),
    last_name: text("last_name").notNull(),
    source: text("source").notNull().default("landing_page"),
    brevo_synced: boolean("brevo_synced").notNull().default(false),
    brevo_contact_id: integer("brevo_contact_id"),
    brevo_sync_error: text("brevo_sync_error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("waitlist_entries_email_unique").on(table.email),
    index("waitlist_entries_brevo_synced_idx").on(table.brevo_synced),
  ]
);

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrer_user_id: uuid("referrer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    referred_user_id: uuid("referred_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("signed_up"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("referrals_referred_user_id_unique").on(table.referred_user_id),
    index("referrals_referrer_user_id_idx").on(table.referrer_user_id),
  ]
);

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stripe_price_id: text("stripe_price_id"),
    name: text("name").notNull(),
    price: real("price").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    interval: text("interval").notNull().default("month"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    limits: jsonb("limits")
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    features: text("features")
      .array()
      .notNull()
      .default(sql`'{}'`),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("plans_name_unique").on(table.name),
    index("plans_stripe_price_id_idx").on(table.stripe_price_id),
    index("plans_is_active_idx").on(table.isActive),
  ]
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id),
    pendingPlanId: uuid("pending_plan_id").references(() => plans.id),
    status: text("status").notNull().default("free"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    gracePeriodEndsAt: timestamp("grace_period_ends_at", { withTimezone: true }),
    paymentProvider: text("payment_provider"),
    providerSubscriptionId: text("provider_subscription_id"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("subscriptions_user_status_idx").on(table.userId, table.status),
    index("subscriptions_provider_subscription_id_idx").on(table.providerSubscriptionId),
  ]
);

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stripe_card_token: text("stripe_card_token").notNull(),
    last_digits: text("last_digits").notNull(),
    expire_date: text("expire_date").notNull(),
    type: text("type").notNull(),
    stripe_customer_id: text("stripe_customer_id").notNull(),
    is_default: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("cards_stripe_card_token_idx").on(table.stripe_card_token),
    index("cards_stripe_customer_id_idx").on(table.stripe_customer_id),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: text("channel").notNull(),
    type: text("type").notNull(),
    recipient_user_id: uuid("recipient_user_id").references(() => users.id, { onDelete: "cascade" }),
    recipient_email: text("recipient_email"),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: text("status").notNull(),
    correlation_id: text("correlation_id").notNull(),
    read_at: timestamp("read_at", { withTimezone: true }),
    email_message_id: text("email_message_id"),
    template_key: text("template_key"),
    sent_at: timestamp("sent_at", { withTimezone: true }),
    failed_at: timestamp("failed_at", { withTimezone: true }),
    title: text("title"),
    body: text("body"),
    ...timestamps,
  },
  (table) => [
    index("notifications_recipient_created_idx").on(table.recipient_user_id, table.created_at),
    index("notifications_recipient_read_idx").on(table.recipient_user_id, table.read_at),
    index("notifications_correlation_id_idx").on(table.correlation_id),
    index("notifications_status_channel_idx").on(table.status, table.channel),
  ]
);

export const campaignTemplates = pgTable(
  "campaign_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    type: text("type").notNull(),
    default_goal: text("default_goal").notNull(),
    default_duration_days: integer("default_duration_days").notNull(),
    default_frequency: text("default_frequency").notNull(),
    default_posts_count: integer("default_posts_count").notNull(),
    suggested_topics: text("suggested_topics")
      .array()
      .notNull()
      .default(sql`'{}'`),
    content_themes: text("content_themes")
      .array()
      .notNull()
      .default(sql`'{}'`),
    ai_prompts: jsonb("ai_prompts").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    is_active: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [index("campaign_templates_type_active_idx").on(table.type, table.is_active)]
);

export const campaignPostItems = pgTable(
  "campaign_post_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaign_id: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    site_id: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    sequence_index: integer("sequence_index").notNull().default(0),
    title: text("title").notNull(),
    objective: text("objective").notNull(),
    strategic_intent: text("strategic_intent").notNull(),
    target_keywords: text("target_keywords")
      .array()
      .notNull()
      .default(sql`'{}'`),
    content_angle: text("content_angle"),
    narrative_phase: text("narrative_phase"),
    status: text("status").notNull().default("planned"),
    scheduled_at: timestamp("scheduled_at", { withTimezone: true }),
    timezone: text("timezone").notNull().default("UTC"),
    blog_id: uuid("blog_id").references(() => blogs.id, { onDelete: "set null" }),
    scheduled_post_id: uuid("scheduled_post_id"),
    generated_by: text("generated_by").notNull().default("ai"),
    manually_added: boolean("manually_added").notNull().default(false),
    locked: boolean("locked").notNull().default(false),
    dependencies: text("dependencies")
      .array()
      .notNull()
      .default(sql`'{}'`),
    ...timestamps,
  },
  (table) => [
    index("campaign_post_items_campaign_seq_idx").on(table.campaign_id, table.sequence_index),
    index("campaign_post_items_campaign_status_idx").on(table.campaign_id, table.status),
  ]
);

export const scheduledPosts = pgTable(
  "scheduled_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    site_id: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    blog_id: uuid("blog_id").references(() => blogs.id, { onDelete: "set null" }),
    campaign_id: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    scheduled_at: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    status: text("status").notNull().default("pending"),
    publish_attempts: integer("publish_attempts").notNull().default(0),
    last_attempt_at: timestamp("last_attempt_at", { withTimezone: true }),
    error_message: text("error_message"),
    published_at: timestamp("published_at", { withTimezone: true }),
    auto_generate: boolean("auto_generate").notNull().default(false),
    generation_prompt: text("generation_prompt"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    prepared_at: timestamp("prepared_at", { withTimezone: true }),
    approved_at: timestamp("approved_at", { withTimezone: true }),
    approved_by_user_id: uuid("approved_by_user_id"),
    rework_comments: text("rework_comments"),
    rework_round: integer("rework_round").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("scheduled_posts_site_user_status_idx").on(table.site_id, table.user_id, table.status),
    index("scheduled_posts_site_scheduled_status_idx").on(table.site_id, table.scheduled_at, table.status),
    index("scheduled_posts_status_scheduled_idx").on(table.status, table.scheduled_at),
    index("scheduled_posts_blog_id_idx").on(table.blog_id),
    index("scheduled_posts_campaign_scheduled_idx").on(table.campaign_id, table.scheduled_at),
  ]
);

export const scheduledPostReviewTokens = pgTable(
  "scheduled_post_review_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    site_id: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    scheduled_post_id: uuid("scheduled_post_id")
      .notNull()
      .references(() => scheduledPosts.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token_lookup: text("token_lookup").notNull(),
    token_hash: text("token_hash").notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    used_at: timestamp("used_at", { withTimezone: true }),
    used_action: text("used_action"),
    rework_round: integer("rework_round").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("review_tokens_lookup_used_idx").on(table.token_lookup, table.used_at),
    index("review_tokens_site_post_used_idx").on(table.site_id, table.scheduled_post_id, table.used_at),
    index("review_tokens_expires_at_idx").on(table.expires_at),
  ]
);

export const orchestratorThreads = pgTable(
  "orchestrator_threads",
  {
    id: text("id").primaryKey(),
    site_id: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    created_by: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    title_source: text("title_source").notNull().default("default"),
    status: text("status").notNull().default("active"),
    channel: text("channel").notNull().default("chat"),
    is_onboarding: boolean("is_onboarding").notNull().default(false),
    topic: text("topic"),
    intent: text("intent"),
    roadmap_sequence_index: integer("roadmap_sequence_index"),
    last_activity_at: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    index("orchestrator_threads_site_activity_idx").on(table.site_id, table.last_activity_at),
    index("orchestrator_threads_site_status_idx").on(table.site_id, table.status),
    index("orchestrator_threads_site_created_by_idx").on(table.site_id, table.created_by),
  ]
);

export const threadAssociations = pgTable(
  "thread_associations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    thread_id: text("thread_id")
      .notNull()
      .references(() => orchestratorThreads.id, { onDelete: "cascade" }),
    site_id: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    entity_type: text("entity_type").notNull(),
    entity_id: text("entity_id").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("thread_associations_thread_entity_unique").on(table.thread_id, table.entity_type, table.entity_id),
    uniqueIndex("thread_associations_one_blog")
      .on(table.entity_id)
      .where(sql`${table.entity_type} = 'blog'`),
    index("thread_associations_site_entity_idx").on(table.site_id, table.entity_type, table.entity_id),
    index("thread_associations_thread_id_idx").on(table.thread_id),
  ]
);
