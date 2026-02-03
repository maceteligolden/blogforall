"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth.store";
import { LandingHeader } from "@/components/layout/landing-header";
import { LandingFooter } from "@/components/layout/landing-footer";
import { Sparkles, Calendar, Users, Zap, Code, BarChart3, Clock, Target, FileText, Globe, Key, Wand2 } from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-black text-white">
      <LandingHeader />

      {/* Enhanced Hero Section */}
      <section className="relative py-32 px-6 lg:px-8 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-black to-black pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,64,175,0.1),transparent_50%)] pointer-events-none" />
        
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-primary/10 border border-primary/30 rounded-full">
            <span className="text-primary text-sm font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              AI-Powered Content Creation
            </span>
          </div>
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-8 tracking-tight leading-tight">
            Create, Schedule &{" "}
            <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
              Publish
            </span>
            <br />
            with AI-Powered Intelligence
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            The complete blog management platform with AI content generation, marketing campaigns, 
            and automated scheduling. Build, manage, and grow your content effortlessly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!isAuthenticated && (
              <>
                <Link href="/auth/signup">
                  <Button className="bg-primary hover:bg-primary/90 text-white px-10 py-7 text-lg font-semibold shadow-lg shadow-primary/50 hover:shadow-xl hover:shadow-primary/50 transition-all">
                    Start Free Trial
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button
                    variant="outline"
                    className="border-2 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white hover:border-gray-600 px-10 py-7 text-lg font-semibold transition-all"
                  >
                    Sign In
                  </Button>
                </Link>
              </>
            )}
            {isAuthenticated && (
              <Link href="/dashboard">
                <Button className="bg-primary hover:bg-primary/90 text-white px-10 py-7 text-lg font-semibold shadow-lg shadow-primary/50 hover:shadow-xl hover:shadow-primary/50 transition-all">
                  Go to Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* AI-Powered Features Section */}
      <section className="py-32 px-6 lg:px-8 bg-gradient-to-b from-black via-gray-950 to-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Powered by <span className="text-primary">AI Intelligence</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Leverage cutting-edge AI to create, review, and optimize your content automatically
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-primary/20 border border-purple-500/30 flex items-center justify-center">
                  <Wand2 className="w-7 h-7 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">AI Blog Generation</h3>
                  <p className="text-gray-400 leading-relaxed">
                    Generate complete blog posts from simple prompts. Our AI analyzes your topic, 
                    understands context, and creates well-structured, engaging content ready to publish. 
                    Perfect for scaling your content production.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-green-500/20 to-primary/20 border border-green-500/30 flex items-center justify-center">
                  <FileText className="w-7 h-7 text-green-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">AI Content Review</h3>
                  <p className="text-gray-400 leading-relaxed">
                    Get comprehensive AI-powered reviews of your content. Check readability, SEO optimization, 
                    grammar, style, and more. Receive actionable suggestions with line-by-line improvements 
                    and automatically apply them with one click.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-primary/20 border border-blue-500/30 flex items-center justify-center">
                  <Target className="w-7 h-7 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">AI Campaign Strategy</h3>
                  <p className="text-gray-400 leading-relaxed">
                    Let AI help you create effective marketing campaigns. Get suggested topics, optimal posting 
                    times, content themes, and strategic recommendations tailored to your goals and audience.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-8 shadow-2xl">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div className="ml-4 text-sm text-gray-500">AI Review Dashboard</div>
                  </div>
                  <div className="bg-black rounded-lg p-6 border border-gray-800">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                          <Wand2 className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="h-3 bg-gray-800 rounded w-3/4 mb-2"></div>
                          <div className="h-2 bg-gray-800 rounded w-1/2"></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 bg-green-500/30 rounded w-full"></div>
                        <div className="h-2 bg-green-500/30 rounded w-4/5"></div>
                        <div className="h-2 bg-yellow-500/30 rounded w-3/4"></div>
                        <div className="h-2 bg-green-500/30 rounded w-5/6"></div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-800">
                        <div className="flex gap-2">
                          <span className="px-2 py-1 text-xs rounded bg-green-900/30 text-green-400 border border-green-800">SEO: 95%</span>
                          <span className="px-2 py-1 text-xs rounded bg-green-900/30 text-green-400 border border-green-800">Readability: 88%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl blur-xl opacity-50 -z-10"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Campaign Management Showcase */}
      <section className="py-32 px-6 lg:px-8 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Marketing Campaigns & <span className="text-primary">Automated Scheduling</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Plan, schedule, and automate your content marketing with powerful campaign tools
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="group bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
              <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-6 group-hover:bg-primary/30 transition-colors">
                <Target className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Campaign Templates</h3>
              <p className="text-gray-400 leading-relaxed">
                Start with pre-built campaign templates for product launches, holidays, brand awareness, 
                and more. Customize goals, schedules, and content themes to match your needs.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
              <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-6 group-hover:bg-primary/30 transition-colors">
                <Calendar className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Smart Scheduling</h3>
              <p className="text-gray-400 leading-relaxed">
                Schedule posts individually or as part of campaigns. View everything in a beautiful calendar, 
                set optimal posting times, and let our system automatically publish at the right moment.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
              <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-6 group-hover:bg-primary/30 transition-colors">
                <Zap className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Auto-Publishing</h3>
              <p className="text-gray-400 leading-relaxed">
                Set it and forget it. Our automated system publishes your scheduled posts at the exact time 
                you specify. Supports both existing posts and AI-generated content on demand.
              </p>
            </div>
          </div>

          {/* Calendar Preview */}
          <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-8">
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="w-5 h-5 text-primary" />
              <h3 className="text-xl font-semibold">Calendar View</h3>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-gray-400 py-2">
                  {day}
                </div>
              ))}
              {Array.from({ length: 35 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`min-h-[60px] border border-gray-800 rounded-md p-2 ${
                    idx === 15 || idx === 22 || idx === 29
                      ? "bg-primary/10 border-primary/30"
                      : "bg-gray-900/50"
                  }`}
                >
                  {idx === 15 && (
                    <div className="text-xs bg-primary/20 text-primary px-1 py-0.5 rounded truncate">
                      Product Launch
                    </div>
                  )}
                  {idx === 22 && (
                    <div className="text-xs bg-green-500/20 text-green-400 px-1 py-0.5 rounded truncate">
                      Blog Post
                    </div>
                  )}
                  {idx === 29 && (
                    <div className="text-xs bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded truncate">
                      Campaign
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Site & Collaboration Section */}
      <section className="py-32 px-6 lg:px-8 bg-gradient-to-b from-black via-gray-950 to-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Multi-Site Management & <span className="text-primary">Team Collaboration</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Manage multiple sites, collaborate with your team, and organize content efficiently
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Globe className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">Multiple Sites</h3>
                  <p className="text-gray-400 leading-relaxed">
                    Manage multiple blogs from a single account. Each site has its own content, 
                    categories, and settings. Perfect for agencies, businesses with multiple brands, 
                    or content creators managing several projects.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Users className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">Team Collaboration</h3>
                  <p className="text-gray-400 leading-relaxed">
                    Invite team members with role-based access. Owners, admins, editors, and viewers 
                    each have appropriate permissions. Collaborate seamlessly with email invitations 
                    and real-time updates.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <FileText className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">Site-Specific Content</h3>
                  <p className="text-gray-400 leading-relaxed">
                    Keep content organized by site. Blogs, categories, and campaigns are isolated 
                    per site, ensuring clean separation and easy management across all your projects.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-8 shadow-2xl">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div className="ml-4 text-sm text-gray-500">Site Management</div>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-4 bg-gray-700 rounded w-24"></div>
                        <div className="h-3 bg-primary/30 rounded w-16"></div>
                      </div>
                      <div className="h-2 bg-gray-700 rounded w-full"></div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-4 bg-gray-700 rounded w-32"></div>
                        <div className="h-3 bg-green-500/30 rounded w-16"></div>
                      </div>
                      <div className="h-2 bg-gray-700 rounded w-full"></div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-4 bg-gray-700 rounded w-28"></div>
                        <div className="h-3 bg-yellow-500/30 rounded w-16"></div>
                      </div>
                      <div className="h-2 bg-gray-700 rounded w-full"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-2xl blur-xl opacity-50 -z-10"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Features Grid */}
      <section className="py-32 px-6 lg:px-8 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Everything You Need to <span className="text-primary">Power Your Blog</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              A comprehensive platform with all the tools you need for modern content management
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Content Creation */}
            <div className="group bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
              <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-6 group-hover:bg-primary/30 transition-colors">
                <FileText className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Rich Content Editor</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Create stunning blog posts with HTML and Markdown support. Add images, format text, 
                and create engaging content with our powerful editor.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
              <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-6 group-hover:bg-primary/30 transition-colors">
                <Clock className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Draft Management</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Save drafts, preview before publishing, and manage your content workflow. 
                Publish and unpublish posts with full version control.
              </p>
            </div>

            {/* Campaign & Scheduling */}
            <div className="group bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
              <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-6 group-hover:bg-primary/30 transition-colors">
                <Target className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Marketing Campaigns</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Create and manage marketing campaigns with templates, goals, and automated scheduling. 
                Track performance and optimize your content strategy.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
              <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-6 group-hover:bg-primary/30 transition-colors">
                <Calendar className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Post Scheduling</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Schedule posts individually or as part of campaigns. View in calendar format, 
                set optimal times, and automate publishing.
              </p>
            </div>

            {/* Collaboration */}
            <div className="group bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
              <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-6 group-hover:bg-primary/30 transition-colors">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Team Collaboration</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Invite team members with role-based permissions. Collaborate on content, 
                manage sites together, and streamline your workflow.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
              <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-6 group-hover:bg-primary/30 transition-colors">
                <Globe className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Multi-Site Support</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Manage multiple blogs from one account. Each site has isolated content, 
                categories, and settings for complete organization.
              </p>
            </div>

            {/* Integration */}
            <div className="group bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
              <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-6 group-hover:bg-primary/30 transition-colors">
                <Code className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">RESTful API</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Build custom frontends, mobile apps, or integrate with existing systems using 
                our comprehensive REST API with secure API key management.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
              <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-6 group-hover:bg-primary/30 transition-colors">
                <Key className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">API Key Management</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Generate and manage secure API keys. Control access, monitor usage, 
                and integrate your blog with any application or service.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
              <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-6 group-hover:bg-primary/30 transition-colors">
                <BarChart3 className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Analytics & Insights</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Track campaign performance, monitor scheduled posts, and gain insights 
                into your content strategy with built-in analytics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-32 px-6 lg:px-8 bg-gradient-to-b from-black via-gray-950 to-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Perfect for <span className="text-primary">Every Use Case</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Whether you&apos;re a solo creator or a large team, BlogForAll adapts to your needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-6 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Personal Bloggers</h3>
              <p className="text-gray-400 text-sm">
                Create and manage your personal blog with AI assistance and easy scheduling
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-6 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Marketing Teams</h3>
              <p className="text-gray-400 text-sm">
                Run campaigns, schedule content, and collaborate with your team seamlessly
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-6 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Content Agencies</h3>
              <p className="text-gray-400 text-sm">
                Manage multiple client sites, collaborate with teams, and scale your operations
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl border border-gray-800 p-6 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                <Code className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Developers</h3>
              <p className="text-gray-400 text-sm">
                Build custom frontends and integrate with any stack using our powerful API
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Updated Pricing Section */}
      <section className="py-32 px-6 lg:px-8 bg-black relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(30,64,175,0.1),transparent_50%)] pointer-events-none" />
        
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Simple, Transparent <span className="text-primary">Pricing</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Choose the plan that fits your needs. All plans include AI features and API access.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-8 relative hover:border-primary/50 transition-all duration-300">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Starter</h3>
                <p className="text-gray-400 text-sm mb-6">Perfect for personal blogs</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">$5</span>
                  <span className="text-gray-400">/month</span>
                </div>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Up to 10 blog posts</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">AI blog generation</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">AI content review</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">1 site</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Basic campaigns</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">API access</span>
                </li>
              </ul>

              {!isAuthenticated ? (
                <Link href="/auth/signup">
                  <Button className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-gray-700">
                    Get Started
                  </Button>
                </Link>
              ) : (
                <Link href="/dashboard">
                  <Button className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-gray-700">
                    Current Plan
                  </Button>
                </Link>
              )}
            </div>

            {/* Professional Plan */}
            <div className="bg-gradient-to-br from-primary/10 via-gray-900 to-black rounded-2xl border-2 border-primary p-8 relative transform scale-105 hover:scale-110 transition-all duration-300 shadow-xl shadow-primary/20">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </span>
              </div>
              
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Professional</h3>
                <p className="text-gray-400 text-sm mb-6">For growing blogs</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">$10</span>
                  <span className="text-gray-400">/month</span>
                </div>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Up to 50 blog posts</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Advanced AI features</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">3 sites</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Unlimited campaigns</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Team collaboration</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Campaign templates</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Priority support</span>
                </li>
              </ul>

              {!isAuthenticated ? (
                <Link href="/auth/signup">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/50">
                    Get Started
                  </Button>
                </Link>
              ) : (
                <Link href="/dashboard">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/50">
                    Upgrade Now
                  </Button>
                </Link>
              )}
            </div>

            {/* Enterprise Plan */}
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-8 relative hover:border-primary/50 transition-all duration-300">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
                <p className="text-gray-400 text-sm mb-6">For power users & businesses</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">$20</span>
                  <span className="text-gray-400">/month</span>
                </div>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Unlimited blog posts</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">All AI features</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Unlimited sites</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Advanced API features</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Unlimited team members</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Custom integrations</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">24/7 priority support</span>
                </li>
              </ul>

              {!isAuthenticated ? (
                <Link href="/auth/signup">
                  <Button className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-gray-700">
                    Get Started
                  </Button>
                </Link>
              ) : (
                <Link href="/dashboard">
                  <Button className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-gray-700">
                    Upgrade Now
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="mt-16 text-center">
            <p className="text-gray-400 mb-4">All plans include a 14-day free trial. No credit card required.</p>
            <p className="text-sm text-gray-500">Cancel anytime. No hidden fees.</p>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-32 px-6 lg:px-8 bg-gradient-to-b from-black via-gray-950 to-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Compare <span className="text-primary">Plans</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                See what&apos;s included in each plan to find the perfect fit
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-4 px-6 text-gray-400 font-semibold">Features</th>
                  <th className="text-center py-4 px-6 text-gray-300 font-semibold">Starter</th>
                  <th className="text-center py-4 px-6 text-primary font-semibold">Professional</th>
                  <th className="text-center py-4 px-6 text-gray-300 font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-6 text-gray-300">Blog Posts</td>
                  <td className="py-4 px-6 text-center text-gray-400">Up to 10</td>
                  <td className="py-4 px-6 text-center text-gray-300">Up to 50</td>
                  <td className="py-4 px-6 text-center text-gray-300">Unlimited</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-6 text-gray-300">AI Blog Generation</td>
                  <td className="py-4 px-6 text-center text-gray-400">✓</td>
                  <td className="py-4 px-6 text-center text-gray-300">✓</td>
                  <td className="py-4 px-6 text-center text-gray-300">✓</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-6 text-gray-300">AI Content Review</td>
                  <td className="py-4 px-6 text-center text-gray-400">✓</td>
                  <td className="py-4 px-6 text-center text-gray-300">✓</td>
                  <td className="py-4 px-6 text-center text-gray-300">✓</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-6 text-gray-300">Sites</td>
                  <td className="py-4 px-6 text-center text-gray-400">1</td>
                  <td className="py-4 px-6 text-center text-gray-300">3</td>
                  <td className="py-4 px-6 text-center text-gray-300">Unlimited</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-6 text-gray-300">Campaigns</td>
                  <td className="py-4 px-6 text-center text-gray-400">Basic</td>
                  <td className="py-4 px-6 text-center text-gray-300">Unlimited</td>
                  <td className="py-4 px-6 text-center text-gray-300">Unlimited</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-6 text-gray-300">Campaign Templates</td>
                  <td className="py-4 px-6 text-center text-gray-400">-</td>
                  <td className="py-4 px-6 text-center text-gray-300">✓</td>
                  <td className="py-4 px-6 text-center text-gray-300">✓</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-6 text-gray-300">Team Members</td>
                  <td className="py-4 px-6 text-center text-gray-400">-</td>
                  <td className="py-4 px-6 text-center text-gray-300">Up to 5</td>
                  <td className="py-4 px-6 text-center text-gray-300">Unlimited</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-6 text-gray-300">API Access</td>
                  <td className="py-4 px-6 text-center text-gray-400">✓</td>
                  <td className="py-4 px-6 text-center text-gray-300">✓</td>
                  <td className="py-4 px-6 text-center text-gray-300">Advanced</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 text-gray-300">Support</td>
                  <td className="py-4 px-6 text-center text-gray-400">Basic</td>
                  <td className="py-4 px-6 text-center text-gray-300">Priority</td>
                  <td className="py-4 px-6 text-center text-gray-300">24/7 Priority</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 lg:px-8 bg-gradient-to-b from-black to-gray-950">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Transform Your Content Strategy?
          </h2>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Join creators and businesses who trust BlogForAll to power their content with AI intelligence, 
            automated campaigns, and seamless collaboration.
          </p>
          {!isAuthenticated && (
            <Link href="/auth/signup">
              <Button className="bg-primary hover:bg-primary/90 text-white px-12 py-8 text-lg font-semibold shadow-lg shadow-primary/50 hover:shadow-xl hover:shadow-primary/50 transition-all">
                Start Your Free Trial
              </Button>
            </Link>
          )}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
