"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-black/80 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">BlogForAll</h1>
            </Link>
            <div className="flex items-center space-x-6">
              <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
                Home
              </Link>
              <Link href="/docs" className="text-sm text-gray-400 hover:text-white transition-colors">
                Docs
              </Link>
              <Link href="/contact" className="text-sm text-gray-400 hover:text-white transition-colors">
                Contact
              </Link>
              <Link href="/auth/signup">
                <Button className="bg-primary hover:bg-primary/90 text-white">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-20">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            About <span className="text-primary">BlogForAll</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Empowering creators and businesses to share their stories with the world through a powerful, 
            flexible blog management platform.
          </p>
        </div>

        {/* Mission Section */}
        <section className="mb-20">
          <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-8 md:p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-primary">Our Mission</h2>
            <p className="text-lg text-gray-300 leading-relaxed mb-6">
              At BlogForAll, we believe that everyone should have the power to create, manage, and share 
              their content without the complexity of traditional content management systems. Our mission is 
              to provide a simple yet powerful platform that gives you complete control over your blog content 
              while making it easy to integrate with any frontend or application.
            </p>
            <p className="text-lg text-gray-300 leading-relaxed">
              Whether you're a solo creator, a growing business, or an enterprise, BlogForAll adapts to your 
              needs and scales with you. We're committed to building tools that make content management 
              effortless, so you can focus on what matters most: creating amazing content.
            </p>
          </div>
        </section>

        {/* What We Offer Section */}
        <section className="mb-20">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">What We Offer</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:border-primary/50 transition-all">
              <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Powerful Content Editor</h3>
              <p className="text-gray-400">
                Create rich, engaging blog posts with our intuitive editor supporting HTML and Markdown. 
                Add images, format text, and craft beautiful content with ease.
              </p>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:border-primary/50 transition-all">
              <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">RESTful API</h3>
              <p className="text-gray-400">
                Build custom frontends, mobile apps, or integrate with existing systems using our 
                comprehensive REST API. Full control over how your content is displayed.
              </p>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:border-primary/50 transition-all">
              <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Community Engagement</h3>
              <p className="text-gray-400">
                Foster meaningful conversations with guest comments and likes. Build a vibrant 
                community around your content without requiring user registration.
              </p>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:border-primary/50 transition-all">
              <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Secure & Reliable</h3>
              <p className="text-gray-400">
                Your content and data are protected with industry-standard security practices. 
                We're committed to keeping your information safe and your blog running smoothly.
              </p>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="mb-20">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">Our Values</h2>
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-xl font-semibold mb-3 text-primary">Simplicity</h3>
              <p className="text-gray-400">
                We believe in making complex things simple. BlogForAll is designed to be intuitive 
                and easy to use, whether you're a beginner or an experienced developer.
              </p>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-xl font-semibold mb-3 text-primary">Flexibility</h3>
              <p className="text-gray-400">
                Your content, your way. BlogForAll gives you the flexibility to use your content 
                however you want, with full API access and no vendor lock-in.
              </p>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-xl font-semibold mb-3 text-primary">Innovation</h3>
              <p className="text-gray-400">
                We're constantly improving and adding new features based on user feedback. 
                BlogForAll evolves with your needs.
              </p>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-xl font-semibold mb-3 text-primary">Transparency</h3>
              <p className="text-gray-400">
                Clear pricing, honest communication, and no hidden fees. We believe in building 
                trust through transparency.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-2xl border border-primary/30 p-8 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Join the BlogForAll Community</h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto text-lg">
            Start creating and sharing your content today. Join thousands of creators and businesses 
            who trust BlogForAll to power their blogs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg">
                Get Started Free
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                variant="outline"
                className="border-2 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white hover:border-gray-600 px-8 py-6 text-lg"
              >
                Contact Us
              </Button>
            </Link>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 px-6 lg:px-8 mt-20">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-400 text-sm">© 2024 BlogForAll. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
