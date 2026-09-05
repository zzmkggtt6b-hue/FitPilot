export default function Home() {
  return (
    <main style={{ maxWidth: 760, margin: "80px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>FitPilot</h1>
      <p>AI Fitness Coach — MVP1 Telegram onboarding.</p>
      <h2>What is implemented</h2>
      <ul>
        <li>Telegram webhook endpoint</li>
        <li>Conversational onboarding state machine</li>
        <li>Structured AI profile extraction</li>
        <li>Supabase persistence</li>
        <li>Profile review and confirmation</li>
      </ul>
      <p>Configure the environment variables and Telegram webhook to start testing.</p>
    </main>
  );
}
