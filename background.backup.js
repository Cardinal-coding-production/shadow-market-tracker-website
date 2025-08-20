/* global chrome */

chrome.runtime.onInstalled.addListener(() => {
    console.log("Shadow Market Tracker installed.");
});

// Listen for AI analysis requests
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.command === 'analyzeWithAI') {
        const { pageContext } = msg;
        // Compose a prompt for ChatGPT
        const prompt = `You are a market research ninja. Given the following web page context, provide a concise market research summary and list 3 potential market opportunities.\n\nTitle: ${pageContext.title}\nDescription: ${pageContext.metaDescription}\nHeadings: ${pageContext.headings?.join('; ') || ''}\nKeywords: ${pageContext.metaKeywords}\n\nRespond in markdown with a summary and a bullet list of opportunities.`;

        // --- INSERT YOUR OPENAI API KEY BELOW ---
        const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY_HERE'; // <-- Replace with your key
        if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
            sendResponse({ error: 'OpenAI API key not set in background.js.' });
            return true;
        }

        fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a market research ninja assistant.' },
                    { role: 'user', content: prompt },
                ],
                max_tokens: 400,
                temperature: 0.7,
            }),
        })
        .then(res => res.json())
        .then(data => {
            if (data.choices && data.choices[0]?.message?.content) {
                sendResponse({ aiInsights: data.choices[0].message.content });
            } else {
                sendResponse({ error: 'No response from OpenAI.' });
            }
        })
        .catch(err => {
            sendResponse({ error: 'OpenAI API error: ' + err.message });
        });
        return true; // Indicates async response
    }
}); 