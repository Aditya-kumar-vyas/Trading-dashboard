"use client";

import { PageLayout } from "@/components/layout/page-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function TermsPage() {
  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Terms of Service
          </h1>
          <p className="text-xl text-muted-foreground">
            Please read these terms carefully before using OHLCV.com
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Acceptance of Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              By accessing or using OHLCV.com, you agree to be bound by these
              Terms of Service and all applicable laws and regulations. If you
              do not agree with any of these terms, you are prohibited from
              using this service.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Use License</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Permission is granted to temporarily use OHLCV.com for personal,
              non-commercial transitory viewing only. This is the grant of a
              license, not a transfer of title, and under this license you may
              not:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose</li>
              <li>
                Attempt to decompile or reverse engineer any software contained
                on OHLCV.com
              </li>
              <li>
                Remove any copyright or other proprietary notations from the
                materials
              </li>
              <li>
                Transfer the materials to another person or "mirror" the
                materials on any other server
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Disclaimer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              The materials on OHLCV.com are provided on an 'as is' basis.
              OHLCV.com makes no warranties, expressed or implied, and hereby
              disclaims and negates all other warranties including, without
              limitation, implied warranties or conditions of merchantability,
              fitness for a particular purpose, or non-infringement of
              intellectual property or other violation of rights.
            </p>
            <p>
              Further, OHLCV.com does not warrant or make any representations
              concerning the accuracy, likely results, or reliability of the use
              of the materials on its website or otherwise relating to such
              materials or on any sites linked to this site.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Disclaimer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              The information provided by OHLCV.com is for informational
              purposes only and should not be considered financial advice. We
              are not a financial advisory service, and we do not provide
              investment recommendations.
            </p>
            <p>
              Trading in financial instruments involves high risk and can result
              in significant losses. You should always consult with a qualified
              financial advisor before making any investment decisions.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Limitations</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              In no event shall OHLCV.com or its suppliers be liable for any
              damages (including, without limitation, damages for loss of data
              or profit, or due to business interruption) arising out of the use
              or inability to use the materials on OHLCV.com, even if OHLCV.com
              or a OHLCV.com authorized representative has been notified orally
              or in writing of the possibility of such damage.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modifications to Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              OHLCV.com may revise these terms of service at any time without
              notice. By using this website, you are agreeing to be bound by the
              then current version of these terms of service.
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
      </div>
    </PageLayout>
  );
}
