require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@notionhq/client');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

async function syncToNotion() {
  try {
    console.log('Starting sync to Notion...');

    // Get unsynced messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('synced_to_notion', false)
      .order('created_at', { ascending: true });

    if (error) throw error;

    console.log(`Found ${messages.length} unsynced messages`);

    for (const message of messages) {
      try {
        const notionPage = await notion.pages.create({
          parent: { database_id: process.env.NOTION_DATABASE_ID },
          properties: {
            'From': {
              title: [{ text: { content: message.from_number } }],
            },
            'Message': {
              rich_text: [{ text: { content: message.message_text || '' } }],
            },
            'Type': {
              select: { name: message.message_type },
            },
            'Created': {
              date: { start: message.created_at },
            },
          },
        });

        // Update Supabase with Notion page ID
        await supabase
          .from('messages')
          .update({
            synced_to_notion: true,
            notion_page_id: notionPage.id,
          })
          .eq('id', message.id);

        console.log(`Synced message ${message.id} to Notion`);
      } catch (err) {
        console.error(`Error syncing message ${message.id}:`, err);
      }
    }

    console.log('Sync complete!');
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

syncToNotion();

module.exports = syncToNotion;
