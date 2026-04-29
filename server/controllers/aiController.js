const getDestinationSuggestions = async (req, res) => {
  const { destination } = req.body;
  if (!destination) {
    return res.status(400).json({ success: false, message: 'Destination is required' });
  }

  const endpoint   = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey     = process.env.AZURE_AI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
  const apiVersion = '2024-10-21';

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a friendly local guide. Give concise, useful suggestions. Use plain text only — no asterisks, no bold, no markdown.' },
          { role: 'user', content: `I'm taking a rideshare to "${destination}". Suggest 4-5 fun things to do, see, or eat near this destination. Keep each item to one short sentence. Format as a plain numbered list with no special formatting.` },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    const raw = await response.text();

    if (!response.ok) {
      return res.status(502).json({ success: false, message: 'AI service error', detail: raw.slice(0, 200) });
    }

    const data = JSON.parse(raw);
    const suggestions = data.choices?.[0]?.message?.content?.trim() || '';
    res.json({ success: true, suggestions });
  } catch (err) {
    console.error('Azure OpenAI request failed:', err.message);
    res.status(500).json({ success: false, message: 'Failed to get suggestions' });
  }
};

const RIDEFLOW_SYSTEM_PROMPT = `You are the RideFlow Assistant, a helpful support bot for the RideFlow rideshare platform. Answer questions accurately and concisely using only the information below. If a question is outside this knowledge, say you don't have that information and suggest contacting support at hello@rideflow.app.

PLATFORM OVERVIEW
RideFlow is a rideshare web app built with React/Vite frontend, Node.js/Express backend, PostgreSQL database, and Clerk authentication. Users: Riders (book rides), Drivers (complete rides), Admins (manage platform). Based in Austin, Texas.

PRICING FORMULA
Base fare: $2.50 | Per mile: $1.75 (real driving distance via OSRM routing) | Service fee: $1.20 | Minimum subtotal: $5.00 | Texas tax: 8.25% on subtotal | Total = subtotal + tax. No surge pricing — rates never change. Example 6-mile ride: $2.50 + $10.50 + $1.20 = $14.20 + $1.17 tax = $15.37 total.

PAYMENT METHODS
Credit card, debit card, PayPal, Apple Pay, Google Pay. Payment is initiated (Pending) when ride is requested. Moves to Completed when ride finishes. Cancellation fee: $2.00 only if a driver already accepted. Free if still in Requested status.

RIDE STATUSES
Requested → Accepted → En Route → In Progress → Completed | Also: Cancelled

BOOKING A RIDE
Enter pickup and dropoff addresses (US only, min 3 chars, use autocomplete dropdown). Map shows real driving route. Fare breakdown shows before confirming. Click Request Ride. Redirected to Active Ride tab to track driver.

SAFETY FEATURES
Safety Help button on Active Ride tab: Call 911 directly, Share ride details (copies driver name/vehicle/plate/location to clipboard), Report driver concern, Cancel ride immediately. Always verify license plate before getting in.

DRIVER REQUIREMENTS
Background check (criminal + driving record), vehicle inspection, document upload (license, registration, insurance), ~30-min onboarding module. Approval takes 3–5 business days. Drivers keep 65% of every fare (platform takes 35%).

DRIVER PORTAL
4 tabs: Dashboard (stats + current ride + weekly chart), Find Rides (open requests to accept), My Rides (full history), Earnings (today/week/month/year totals + payment records). Toggle Available/Not Available in navbar to go online.

RIDER PORTAL
5 tabs: Book a Ride, Active Ride (live tracking), Ride History, Transactions, Profile. Profile includes ride preferences (temperature, music, conversation) shown to drivers before accepting. Rider rating starts at 5.00/5.00.

AI DESTINATION ASSISTANT
Powered by Azure OpenAI. Suggests things to do near your destination. Available on Book a Ride tab and Active Ride tab. Optional — does not affect booking.

CONTACT & SUPPORT
Email: hello@rideflow.app | Phone: (512) 448-0193 | Hours: Mon–Fri 9AM–6PM CT`;

const chatWithAssistant = async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, message: 'messages array is required' });
  }

  const endpoint   = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey     = process.env.AZURE_AI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
  const apiVersion = '2024-10-21';

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: RIDEFLOW_SYSTEM_PROMPT },
          ...messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 500,
        temperature: 0.4,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      return res.status(502).json({ success: false, message: 'AI service error', detail: raw.slice(0, 200) });
    }

    const data  = JSON.parse(raw);
    const reply = data.choices?.[0]?.message?.content?.trim() || '';
    res.json({ success: true, reply });
  } catch (err) {
    console.error('RideFlow Assistant error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to get response' });
  }
};

module.exports = { getDestinationSuggestions, chatWithAssistant };