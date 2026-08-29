CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone_number text,
  role text NOT NULL DEFAULT 'user',
  plan text NOT NULL DEFAULT 'free',
  session_token text,
  reset_password_token text,
  reset_password_expires timestamptz,
  reset_password_attempts integer NOT NULL DEFAULT 0,
  stripe_customer_id text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  terms_accepted_at timestamptz,
  terms_version text,
  referral_code text,
  referred_by_user_id uuid,
  workspace_invite_prompt_dismissed_at timestamptz,
  plan_selection_completed_at timestamptz,
  strategist_ready_acknowledged_at timestamptz,
  email_verified boolean NOT NULL DEFAULT false,
  email_verification_token text,
  email_verification_expires timestamptz,
  email_verification_attempts integer NOT NULL DEFAULT 0,
  company_role text,
  company_role_detail text,
  account_type text NOT NULL DEFAULT 'standard',
  is_approved boolean NOT NULL DEFAULT true,
  beta_rejected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique ON users (referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_stripe_customer_id_idx ON users (stripe_customer_id);
CREATE INDEX IF NOT EXISTS users_onboarding_completed_idx ON users (onboarding_completed);
CREATE INDEX IF NOT EXISTS users_email_verified_idx ON users (email_verified);
CREATE INDEX IF NOT EXISTS users_referred_by_user_id_idx ON users (referred_by_user_id);

CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  slug text NOT NULL,
  public_id text NOT NULL,
  owner uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sites_slug_unique ON sites (slug);
CREATE UNIQUE INDEX IF NOT EXISTS sites_public_id_unique ON sites (public_id);
CREATE INDEX IF NOT EXISTS sites_owner_idx ON sites (owner);
CREATE INDEX IF NOT EXISTS sites_status_idx ON sites (status);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS website_url text;

CREATE TABLE IF NOT EXISTS site_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer',
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_members_site_user_unique ON site_members (site_id, user_id);
CREATE INDEX IF NOT EXISTS site_members_user_id_idx ON site_members (user_id);
CREATE INDEX IF NOT EXISTS site_members_site_role_idx ON site_members (site_id, role);

CREATE TABLE IF NOT EXISTS site_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  token text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_invitations_token_unique ON site_invitations (token);
CREATE INDEX IF NOT EXISTS site_invitations_site_email_status_idx ON site_invitations (site_id, email, status);
CREATE INDEX IF NOT EXISTS site_invitations_email_status_idx ON site_invitations (email, status);
CREATE INDEX IF NOT EXISTS site_invitations_expires_at_idx ON site_invitations (expires_at);

CREATE TABLE IF NOT EXISTS workspace_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  access_key_id text NOT NULL,
  hashed_secret text NOT NULL,
  secret_encrypted text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used timestamptz,
  is_active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS workspace_api_keys_access_key_id_unique ON workspace_api_keys (access_key_id);
CREATE INDEX IF NOT EXISTS workspace_api_keys_site_access_idx ON workspace_api_keys (site_id, access_key_id);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  parent uuid,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_site_slug_unique ON categories (site_id, slug);
CREATE INDEX IF NOT EXISTS categories_site_parent_idx ON categories (site_id, parent);
CREATE INDEX IF NOT EXISTS categories_site_active_idx ON categories (site_id, is_active);

CREATE TABLE IF NOT EXISTS campaign_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  type text NOT NULL,
  default_goal text NOT NULL,
  default_duration_days integer NOT NULL,
  default_frequency text NOT NULL,
  default_posts_count integer NOT NULL,
  suggested_topics text[] NOT NULL DEFAULT '{}',
  content_themes text[] NOT NULL DEFAULT '{}',
  ai_prompts jsonb,
  metadata jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_templates_type_active_idx ON campaign_templates (type, is_active);

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  goal text NOT NULL,
  target_audience text,
  status text NOT NULL DEFAULT 'draft',
  lifecycle_status text NOT NULL DEFAULT 'draft',
  campaign_type text,
  health_status text,
  health_computed_at timestamptz,
  health_reasons text[] NOT NULL DEFAULT '{}',
  is_default boolean NOT NULL DEFAULT false,
  strategy_id text,
  messaging text,
  desired_transformation text,
  funnel_focus text,
  guardrails text[] NOT NULL DEFAULT '{}',
  assumptions text[] NOT NULL DEFAULT '{}',
  hypotheses text[] NOT NULL DEFAULT '{}',
  related_products text[] NOT NULL DEFAULT '{}',
  supporting_evidence text[] NOT NULL DEFAULT '{}',
  intelligence jsonb,
  content_autonomy text,
  publishing_mode text,
  approval_policy text,
  primary_topics text[] NOT NULL DEFAULT '{}',
  cta_strategy jsonb,
  notifications jsonb,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  posting_frequency text NOT NULL,
  custom_schedule text,
  timezone text NOT NULL DEFAULT 'UTC',
  total_posts_planned integer,
  posts_published integer NOT NULL DEFAULT 0,
  budget real,
  success_metrics jsonb,
  ai_strategy jsonb,
  template_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_default_campaign_per_site ON campaigns (site_id) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS campaigns_site_user_status_idx ON campaigns (site_id, user_id, status);
CREATE INDEX IF NOT EXISTS campaigns_site_lifecycle_idx ON campaigns (site_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS campaigns_site_dates_idx ON campaigns (site_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS blogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  strategy_id text,
  title text NOT NULL,
  content text NOT NULL,
  content_type text NOT NULL DEFAULT 'html',
  content_blocks jsonb,
  slug text NOT NULL,
  excerpt text,
  featured_image text,
  images text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  category uuid REFERENCES categories(id) ON DELETE SET NULL,
  likes integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  dynamic_forms jsonb,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS blogs_site_slug_unique ON blogs (site_id, slug);
CREATE INDEX IF NOT EXISTS blogs_site_author_status_idx ON blogs (site_id, author, status);
CREATE INDEX IF NOT EXISTS blogs_site_status_published_idx ON blogs (site_id, status, published_at);
CREATE INDEX IF NOT EXISTS blogs_site_category_status_idx ON blogs (site_id, category, status);
CREATE INDEX IF NOT EXISTS blogs_site_campaign_idx ON blogs (site_id, campaign_id);

CREATE TABLE IF NOT EXISTS blog_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id uuid NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS blog_likes_blog_actor_unique ON blog_likes (blog_id, actor);

CREATE TABLE IF NOT EXISTS blog_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id uuid NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content text NOT NULL,
  title text NOT NULL,
  excerpt text,
  review_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS blog_versions_blog_version_unique ON blog_versions (blog_id, version);

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blog uuid NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_email text,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  content text NOT NULL,
  parent_comment uuid,
  is_approved boolean NOT NULL DEFAULT true,
  likes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_blog_created_idx ON comments (blog, created_at);
CREATE INDEX IF NOT EXISTS comments_parent_idx ON comments (parent_comment);

CREATE TABLE IF NOT EXISTS comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS comment_likes_comment_actor_unique ON comment_likes (comment_id, actor);

CREATE TABLE IF NOT EXISTS waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  source text NOT NULL DEFAULT 'landing_page',
  brevo_synced boolean NOT NULL DEFAULT false,
  brevo_contact_id integer,
  brevo_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_entries_email_unique ON waitlist_entries (email);
CREATE INDEX IF NOT EXISTS waitlist_entries_brevo_synced_idx ON waitlist_entries (brevo_synced);

CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'signed_up',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_user_id_unique ON referrals (referred_user_id);
CREATE INDEX IF NOT EXISTS referrals_referrer_user_id_idx ON referrals (referrer_user_id);

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_price_id text,
  name text NOT NULL,
  price real NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  interval text NOT NULL DEFAULT 'month',
  metadata jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  features text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS plans_name_unique ON plans (name);
CREATE INDEX IF NOT EXISTS plans_stripe_price_id_idx ON plans (stripe_price_id);
CREATE INDEX IF NOT EXISTS plans_is_active_idx ON plans (is_active);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id),
  pending_plan_id uuid REFERENCES plans(id),
  status text NOT NULL DEFAULT 'free',
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  grace_period_ends_at timestamptz,
  payment_provider text,
  provider_subscription_id text,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_user_status_idx ON subscriptions (user_id, status);
CREATE INDEX IF NOT EXISTS subscriptions_provider_subscription_id_idx ON subscriptions (provider_subscription_id);

CREATE TABLE IF NOT EXISTS cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_card_token text NOT NULL,
  last_digits text NOT NULL,
  expire_date text NOT NULL,
  type text NOT NULL,
  stripe_customer_id text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cards_stripe_card_token_idx ON cards (stripe_card_token);
CREATE INDEX IF NOT EXISTS cards_stripe_customer_id_idx ON cards (stripe_customer_id);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  type text NOT NULL,
  recipient_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  recipient_email text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL,
  correlation_id text NOT NULL,
  read_at timestamptz,
  email_message_id text,
  template_key text,
  sent_at timestamptz,
  failed_at timestamptz,
  title text,
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx ON notifications (recipient_user_id, created_at);
CREATE INDEX IF NOT EXISTS notifications_recipient_read_idx ON notifications (recipient_user_id, read_at);
CREATE INDEX IF NOT EXISTS notifications_correlation_id_idx ON notifications (correlation_id);
CREATE INDEX IF NOT EXISTS notifications_status_channel_idx ON notifications (status, channel);

CREATE TABLE IF NOT EXISTS campaign_post_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  sequence_index integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  objective text NOT NULL,
  strategic_intent text NOT NULL,
  target_keywords text[] NOT NULL DEFAULT '{}',
  content_angle text,
  narrative_phase text,
  status text NOT NULL DEFAULT 'planned',
  scheduled_at timestamptz,
  timezone text NOT NULL DEFAULT 'UTC',
  blog_id uuid REFERENCES blogs(id) ON DELETE SET NULL,
  scheduled_post_id uuid,
  generated_by text NOT NULL DEFAULT 'ai',
  manually_added boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  dependencies text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_post_items_campaign_seq_idx ON campaign_post_items (campaign_id, sequence_index);
CREATE INDEX IF NOT EXISTS campaign_post_items_campaign_status_idx ON campaign_post_items (campaign_id, status);

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  blog_id uuid REFERENCES blogs(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  title text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  status text NOT NULL DEFAULT 'pending',
  publish_attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  error_message text,
  published_at timestamptz,
  auto_generate boolean NOT NULL DEFAULT false,
  generation_prompt text,
  metadata jsonb,
  prepared_at timestamptz,
  approved_at timestamptz,
  approved_by_user_id uuid,
  rework_comments text,
  rework_round integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scheduled_posts_site_user_status_idx ON scheduled_posts (site_id, user_id, status);
CREATE INDEX IF NOT EXISTS scheduled_posts_site_scheduled_status_idx ON scheduled_posts (site_id, scheduled_at, status);
CREATE INDEX IF NOT EXISTS scheduled_posts_status_scheduled_idx ON scheduled_posts (status, scheduled_at);
CREATE INDEX IF NOT EXISTS scheduled_posts_blog_id_idx ON scheduled_posts (blog_id);
CREATE INDEX IF NOT EXISTS scheduled_posts_campaign_scheduled_idx ON scheduled_posts (campaign_id, scheduled_at);

CREATE TABLE IF NOT EXISTS scheduled_post_review_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  scheduled_post_id uuid NOT NULL REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_lookup text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_action text,
  rework_round integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_tokens_lookup_used_idx ON scheduled_post_review_tokens (token_lookup, used_at);
CREATE INDEX IF NOT EXISTS review_tokens_site_post_used_idx ON scheduled_post_review_tokens (site_id, scheduled_post_id, used_at);
CREATE INDEX IF NOT EXISTS review_tokens_expires_at_idx ON scheduled_post_review_tokens (expires_at);

ALTER TABLE users ADD COLUMN IF NOT EXISTS strategist_ready_acknowledged_at timestamptz;
ALTER TABLE users DROP COLUMN IF EXISTS welcome_tour_dismissed_at;
ALTER TABLE users DROP COLUMN IF EXISTS show_welcome_tour;
UPDATE users
SET strategist_ready_acknowledged_at = COALESCE(workspace_invite_prompt_dismissed_at, now())
WHERE plan_selection_completed_at IS NOT NULL
  AND workspace_invite_prompt_dismissed_at IS NOT NULL
  AND strategist_ready_acknowledged_at IS NULL;

CREATE TABLE IF NOT EXISTS orchestrator_threads (
  id text PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  title_source text NOT NULL DEFAULT 'default',
  status text NOT NULL DEFAULT 'active',
  channel text NOT NULL DEFAULT 'chat',
  is_onboarding boolean NOT NULL DEFAULT false,
  topic text,
  intent text,
  roadmap_sequence_index integer,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orchestrator_threads_site_activity_idx ON orchestrator_threads (site_id, last_activity_at);
CREATE INDEX IF NOT EXISTS orchestrator_threads_site_status_idx ON orchestrator_threads (site_id, status);
CREATE INDEX IF NOT EXISTS orchestrator_threads_site_created_by_idx ON orchestrator_threads (site_id, created_by);

CREATE TABLE IF NOT EXISTS thread_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL REFERENCES orchestrator_threads(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS thread_associations_thread_entity_unique
  ON thread_associations (thread_id, entity_type, entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS thread_associations_one_blog
  ON thread_associations (entity_id)
  WHERE entity_type = 'blog';
CREATE INDEX IF NOT EXISTS thread_associations_site_entity_idx
  ON thread_associations (site_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS thread_associations_thread_id_idx ON thread_associations (thread_id);
