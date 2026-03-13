require('dotenv').config();
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@notionhq/client');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: false }));

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// WhatsApp webhook endpoint
app.post('/webhook/whatsapp', async (req, res) => {
  try {
    const from = req.body.From;
    const to = req.body.To;
    const messageBody = req.body.Body;
    const messageId = req.body.MessageSid;
    const mediaUrl = req.body.MediaUrl0;

    // Save message to Supabase
    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          from_number: from,
          to_number: to,
          message_text: messageBody,
          media_url: mediaUrl || null,
          message_type: mediaUrl ? 'media' : 'text',
          whatsapp_message_id: messageId,
          synced_to_notion: false,
        },
      ])
      .select();

    if (error) throw error;

    console.log('Message saved:', data);

    // Return TwiML response
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message('Messaggio ricevuto. Grazie!');
    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET endpoint to retrieve messages
app.get('/api/messages', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
