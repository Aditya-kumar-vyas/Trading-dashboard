"use client";

import { PageLayout } from "@/components/layout/page-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, BarChart2, Clock, Search, Shield, Zap } from "lucide-react";

export default function AboutPage() {
  return (
    <PageLayout>
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            About OHLCV.com
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            A powerful real-time stock market dashboard for technical traders
            and analysts
          </p>
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Our Mission</CardTitle>
            <CardDescription className="max-w-3xl mx-auto text-base">
              OHLCV.com provides institutional-grade technical analysis tools in
              a simple, accessible interface. Our goal is to empower traders
              with accurate data and powerful analysis capabilities.
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs defaultValue="features" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="data">Data Sources</TabsTrigger>
            <TabsTrigger value="tech">Technology</TabsTrigger>
          </TabsList>

          <TabsContent value="features" className="space-y-4">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<Clock />}
                title="Multi-Timeframe Analysis"
                description="View OHLC data across multiple timeframes from intraday to yearly."
              />
              <FeatureCard
                icon={<BarChart2 />}
                title="Technical Indicators"
                description="Calculate and visualize moving averages, ATR, and other key indicators."
              />
              <FeatureCard
                icon={<Activity />}
                title="Live Updates"
                description="Get real-time price updates when markets are open."
              />
              <FeatureCard
                icon={<Search />}
                title="Stock Scanner"
                description="Screen for stocks meeting specific technical criteria."
              />
              <FeatureCard
                icon={<Zap />}
                title="Instant Calculations"
                description="All calculations are performed instantly for rapid analysis."
              />
              <FeatureCard
                icon={<Shield />}
                title="Secure & Private"
                description="Your API keys never leave your browser and are securely stored."
              />
            </div>
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Data Sources</CardTitle>
                <CardDescription>
                  OHLCV.com uses high-quality market data from reliable sources
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Upstox API</h3>
                  <p className="text-muted-foreground">
                    We use the Upstox API to provide real-time and historical
                    market data. This ensures accurate and low-latency data for
                    all your analysis needs.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium">Data Quality</h3>
                  <p className="text-muted-foreground">
                    Our platform incorporates data validation and correction
                    mechanisms to ensure you always work with clean, accurate
                    market data.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium">API Integration</h3>
                  <p className="text-muted-foreground">
                    Simply add your Upstox API key to access comprehensive
                    market data for Indian equities, indices, and other
                    instruments.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tech" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Technology Stack</CardTitle>
                <CardDescription>
                  OHLCV.com is built with modern web technologies for optimal
                  performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Next.js & React</h3>
                  <p className="text-muted-foreground">
                    Built with Next.js for server-side rendering and React for a
                    responsive and intuitive user interface.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium">WebSocket Connections</h3>
                  <p className="text-muted-foreground">
                    Real-time data is delivered via WebSockets, ensuring instant
                    updates with minimal latency.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium">
                    Tailwind CSS & shadcn/ui
                  </h3>
                  <p className="text-muted-foreground">
                    Our UI is built with Tailwind CSS and shadcn/ui components,
                    providing a clean, responsive design that works on all
                    devices.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium">
                    Technical Analysis Library
                  </h3>
                  <p className="text-muted-foreground">
                    We use specialized libraries for calculating technical
                    indicators, ensuring accurate and efficient analysis.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <div className="h-8 w-8 text-primary">{icon}</div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
