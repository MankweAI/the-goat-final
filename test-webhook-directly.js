async function testWebhookDirectly() {
  try {
    const res = await fetch('http://localhost:3000/api/webhook/manychat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        psid: '33968862',
        message: 'test question'
      })
    });

    console.log('Webhook Status:', res.status);
    const text = await res.text();
    console.log('Webhook Response:', text);
  } catch (e) {
    console.error('Webhook Error:', e.message);
  }
}

testWebhookDirectly();
