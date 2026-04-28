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

module.exports = { getDestinationSuggestions };