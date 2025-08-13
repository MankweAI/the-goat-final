// Debug version to see what ManyChat sends
export default async function handler(req, res) {
  console.log('🔍 MANYCHAT DEBUG - Full Request:');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Query params:', JSON.stringify(req.query, null, 2));

  // Log to see what fields ManyChat actually sends
  const possibleUserMessage =
    req.body.message || req.body.text || req.body.last_input_text || req.body.content;
  const possiblePsid = req.body.psid || req.body.subscriber_id || req.body.user_id;

  console.log('🎯 Extracted fields:');
  console.log('User message:', possibleUserMessage);
  console.log('User PSID:', possiblePsid);

  return res.status(200).json({
    status: 'debug_success',
    received_at: new Date().toISOString(),
    extracted: {
      message: possibleUserMessage,
      psid: possiblePsid
    },
    full_request: {
      headers: req.headers,
      body: req.body,
      query: req.query
    }
  });
}


