const { DefaultAzureCredential } = require("@azure/identity");

module.exports = async function (context, req) {
    context.log('Chat function processed a request.');
    
    // CORS headers
    context.res = {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    };
    
    // Handle OPTIONS for CORS preflight
    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        return;
    }
    
    try {
        const message = req.body?.message;
        
        if (!message) {
            context.res.status = 400;
            context.res.body = JSON.stringify({ error: 'Message is required' });
            return;
        }
        
        // Get access token using Managed Identity
        const credential = new DefaultAzureCredential();
        const token = await credential.getToken('https://cognitiveservices.azure.com/.default');
        
        // Call Azure AI Foundry API
        const apiUrl = process.env.AGENT_API_URL || 
            'https://openaisuavetest-resource.services.ai.azure.com/api/projects/openaisuavetest/applications/SuaveSalesAgent/protocols/openai/responses?api-version=2025-11-15-preview';
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token.token}`
            },
            body: JSON.stringify({
                input: [
                    { role: 'user', content: message }
                ]
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            context.log.error('API Error:', response.status, errorText);
            throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        
        // Extract response text
        let responseText = '';
        if (data.output_text) {
            responseText = data.output_text;
        } else if (data.output) {
            responseText = data.output;
        } else if (data.choices && data.choices[0]?.message?.content) {
            responseText = data.choices[0].message.content;
        } else if (data.content) {
            responseText = Array.isArray(data.content) ? data.content[0].text : data.content;
        } else {
            responseText = 'I received your question but couldn\'t process it properly.';
        }
        
        context.res.status = 200;
        context.res.body = JSON.stringify({ 
            response: responseText 
        });
        
    } catch (error) {
        context.log.error('Error:', error);
        context.res.status = 500;
        context.res.body = JSON.stringify({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
};
