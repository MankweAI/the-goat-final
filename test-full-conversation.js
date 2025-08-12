async function testFullConversation() {
  const baseUrl = 'http://localhost:3000/api/webhook/manychat';
  const psid = '33968862';

  console.log('=== TESTING FULL CONVERSATION ===\n');

  // Step 1: Initial message
  console.log('1. Sending initial message...');
  let res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ psid, message: 'hello' })
  });
  let data = await res.json();
  console.log('Response:', data.echo);

  // Step 2: Choose topic
  console.log('\n2. Choosing Algebra...');
  res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ psid, message: 'algebra' })
  });
  data = await res.json();
  console.log('Response:', data.echo);

  // Step 3: Answer question (let's say A)
  console.log('\n3. Answering with A...');
  res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ psid, message: 'A' })
  });
  data = await res.json();
  console.log('Response:', data.echo);

  // Step 4: Ask for another question
  console.log('\n4. Asking for another question...');
  res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ psid, message: 'more' })
  });
  data = await res.json();
  console.log('Response:', data.echo);

  console.log('\n=== CONVERSATION TEST COMPLETE ===');
}

testFullConversation();
