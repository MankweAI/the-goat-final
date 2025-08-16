export default function Home() {
  return (
    <div
      style={{
        padding: '40px',
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '800px',
        margin: '0 auto',
        lineHeight: '1.6'
      }}
    >
      <h1>🐐 The GOAT - Educational Support Platform</h1>

      <div
        style={{
          background: '#f5f5f5',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}
      >
        <h2>🚀 Status: ACTIVE</h2>
        <p>
          <strong>Webhook Endpoint:</strong> <code>/api/manychat</code>
        </p>
        <p>
          <strong>Platform Focus:</strong> Stress Support + Confidence Building + Practice
        </p>
        <p>
          <strong>Target:</strong> South African Grades 10-11 Mathematics
        </p>
      </div>

      <h3>✨ Core Features</h3>
      <ul>
        <li>
          <strong>Zero Friction Entry:</strong> No registration, PSID-only authentication
        </li>
        <li>
          <strong>Stress Support:</strong> Gentle intake → Study plans → Micro-lessons
        </li>
        <li>
          <strong>Confidence Boost:</strong> Psychological support → Confidence ladder → Growth
          tracking
        </li>
        <li>
          <strong>Immediate Practice:</strong> Instant questions → Detailed feedback → Continue
          flows
        </li>
        <li>
          <strong>WhatsApp Optimized:</strong> Mobile-first, calm tone, short interactions
        </li>
      </ul>

      <h3>🎯 User Journey</h3>
      <ol>
        <li>Welcome Menu → 3 options (Stressed / Doubt / Practice)</li>
        <li>
          <strong>Stressed:</strong> Grade → Stress level → Subject → Exam date → Study plan
        </li>
        <li>
          <strong>Confidence:</strong> Reason → Pre-confidence → Micro-support → Ladder →
          Post-confidence
        </li>
        <li>
          <strong>Practice:</strong> Immediate question → Answer → Feedback → Continue menu
        </li>
      </ol>

      <h3>🧠 Psychological Framework</h3>
      <ul>
        <li>
          <strong>Validation First:</strong> &quot;It&#39;s okay to feel this way&quot;
        </li>
        <li>
          <strong>Small Steps:</strong> Manageable actions, no overwhelming plans
        </li>
        <li>
          <strong>Growth Mindset:</strong> Process over performance
        </li>
        <li>
          <strong>Gentle Authority:</strong> Confident but patient guidance
        </li>
      </ul>

      <h3>📊 Analytics Tracking</h3>
      <ul>
        <li>Welcome → Action conversion rates</li>
        <li>Stress flow completion by stress level</li>
        <li>Confidence delta improvements (pre→post)</li>
        <li>Practice completion and accuracy trends</li>
        <li>Daily plan opt-in and adherence rates</li>
      </ul>

      <div
        style={{ background: '#e8f5e8', padding: '15px', borderRadius: '8px', marginTop: '30px' }}
      >
        <p>
          <strong>🌱 Mission:</strong> Transform academic stress into sustainable learning habits
          through intelligent, empathetic support.
        </p>
      </div>
    </div>
  );
}
