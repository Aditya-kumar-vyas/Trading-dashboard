"use client";

import { PageLayout } from "@/components/layout/page-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Privacy Policy
          </h1>
          <p className="text-xl text-muted-foreground">
            How we protect your data and privacy
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Introduction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              At OHLCV.com, we take your privacy seriously. This Privacy Policy
              explains how we collect, use, and protect your personal
              information when you use our application.
            </p>
            <p>
              By using OHLCV.com, you agree to the collection and use of
              information in accordance with this policy.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Information Collection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <h3 className="text-lg font-medium">API Keys</h3>
            <p>
              When you use OHLCV.com, you may provide your Upstox API key to
              access market data. This API key is stored locally in your browser
              and is never transmitted to our servers.
            </p>

            <h3 className="text-lg font-medium">Usage Data</h3>
            <p>
              We collect anonymous usage data such as page views, features used,
              and error reports to improve our service. This data does not
              include personal information or trading data.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              We use industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>API keys are stored only in your browser's local storage</li>
              <li>
                All communication with our servers uses encrypted HTTPS
                connections
              </li>
              <li>
                We do not store your trading data or market queries on our
                servers
              </li>
              <li>
                Our application is regularly audited for security
                vulnerabilities
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Third-Party Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>OHLCV.com uses the following third-party services:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Upstox API - for market data (subject to Upstox's own privacy
                policy)
              </li>
              <li>Analytics services - for anonymous usage statistics</li>
            </ul>
            <p>
              We do not sell or share your personal information with any other
              third parties.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Changes to this Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              We may update our Privacy Policy from time to time. We will notify
              you of any changes by posting the new Privacy Policy on this page
              and updating the "last updated" date.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Last updated:{" "}
              {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Us</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              If you have any questions or concerns about our Privacy Policy,
              please contact us at:
            </p>
            <p className="mt-2 font-medium">privacy@ohlcv.com</p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
