import TradingView from './trading-view'

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-4xl font-bold mb-8 text-center">Trading Analysis Dashboard</h1>
      <TradingView />
    </main>
  );
}