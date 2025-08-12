const TOKEN = '3137091:cfd971100ea47eac889755f70f02e3a8';
const SUBSCRIBER_ID = '33968862';

async function testWithTag() {
  try {
    const res = await fetch('https://api.manychat.com/fb/sending/sendContent', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscriber_id: SUBSCRIBER_ID,
        data: {
          version: 'v2',
          content: {
            messages: [{ type: 'text', text: 'Test with message tag - should work!' }]
          }
        },
        message_tag: 'CONFIRMED_EVENT_UPDATE'
      })
    });

    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testWithTag();
