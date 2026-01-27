"use client";

import { PaymentMethodsCard } from "@/components/billing/payment-methods-card";
import { Breadcrumb } from "@/components/layout/breadcrumb";

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Billing" }]} />
        
        <div className="py-8">
          <h1 className="text-4xl font-bold mb-2">Billing & Payment</h1>
          <p className="text-gray-400 text-lg mb-8">Manage your payment methods and billing information</p>

          <div className="mb-8">
            <PaymentMethodsCard />
          </div>

          <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-semibold text-yellow-400 mb-2">Payment Security</h3>
                <p className="text-sm text-gray-300">
                  Your payment information is securely processed by Stripe. We never store your full card details.
                  All transactions are encrypted and PCI compliant.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
