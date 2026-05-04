# Shadow Member Backend Implementation Guide

This document provides reference code for implementing the backend webhook that receives progress updates from WhatsApp/Telegram bots.

## Overview

Shadow Members are team members who don't log into the platform. Instead, they send progress updates via WhatsApp or Telegram. The backend:
1. Receives webhook messages from bot platforms
2. Validates the message is a number (1-100)
3. Updates the member's progress in the database
4. Sends error messages for invalid inputs

## Required Setup

### 1. Database Schema

```sql
-- Create shadow_members table
CREATE TABLE shadow_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50) UNIQUE NOT NULL,
  connection_type VARCHAR(20) NOT NULL CHECK (connection_type IN ('whatsapp', 'telegram')),
  chat_id VARCHAR(255) UNIQUE NOT NULL,
  task_progress INTEGER DEFAULT 0 CHECK (task_progress >= 0 AND task_progress <= 100),
  avatar VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on phone_number for quick lookups
CREATE INDEX idx_shadow_members_phone ON shadow_members(phone_number);
CREATE INDEX idx_shadow_members_chat_id ON shadow_members(chat_id);
```

### 2. Express.js Backend Example

```javascript
// server.js
import express from 'express';
import bodyParser from 'body-parser';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(bodyParser.json());

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// POST /api/members/shadow - Create new shadow member
app.post('/api/members/shadow', async (req, res) => {
  try {
    const { name, role, phoneNumber, connectionType } = req.body;

    // Validate required fields
    if (!name || !role || !phoneNumber || !connectionType) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, role, phoneNumber, connectionType' 
      });
    }

    // Validate connection type
    if (!['whatsapp', 'telegram'].includes(connectionType)) {
      return res.status(400).json({ 
        error: 'connectionType must be "whatsapp" or "telegram"' 
      });
    }

    // Generate unique chat ID
    const chatId = `shadow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate avatar initials
    const avatar = name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    // Insert into database
    const { data, error } = await supabase
      .from('shadow_members')
      .insert({
        name,
        role,
        phone_number: phoneNumber,
        connection_type: connectionType,
        chat_id: chatId,
        task_progress: 0,
        avatar,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to create shadow member' });
    }

    // TODO: Register webhook with WhatsApp/Telegram bot platform
    // This would involve calling the bot API to set up the webhook URL
    // Example for Telegram:
    // await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    //   method: 'POST',
    //   body: JSON.stringify({ url: `${process.env.APP_URL}/api/webhook/bot` })
    // });

    return res.status(201).json({
      success: true,
      member: data,
      chatId,
      instructions: {
        nextSteps: [
          `Configure ${connectionType} bot webhook`,
          `Member can now send numbers 1-100 to ${phoneNumber}`,
          'Progress will update automatically on dashboard',
        ],
      },
    });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/webhook/bot - Receive updates from WhatsApp/Telegram
app.post('/api/webhook/bot', async (req, res) => {
  try {
    // Parse incoming webhook payload
    // Format varies by platform (WhatsApp Business API vs Telegram)
    
    // Example for WhatsApp Business API
    const whatsappPayload = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    
    // Example for Telegram
    const telegramPayload = req.body?.message;

    let phoneNumber, messageText, platform;

    // Detect platform and extract data
    if (whatsappPayload) {
      platform = 'whatsapp';
      phoneNumber = whatsappPayload.from; // Sender's phone number
      messageText = whatsappPayload.text?.body || '';
    } else if (telegramPayload) {
      platform = 'telegram';
      // For Telegram, you'd map chat_id to phone_number in your DB
      const chatId = telegramPayload.chat?.id?.toString();
      messageText = telegramPayload.text || '';
      
      // Look up phone number by Telegram chat_id
      const { data: member } = await supabase
        .from('shadow_members')
        .select('phone_number')
        .eq('chat_id', chatId)
        .single();
      
      phoneNumber = member?.phone_number;
    } else {
      return res.status(400).json({ error: 'Unrecognized webhook format' });
    }

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Could not identify sender' });
    }

    // Find shadow member by phone number
    const { data: member, error: findError } = await supabase
      .from('shadow_members')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (findError || !member) {
      return res.status(404).json({ 
        error: 'Member not found. Please register first.' 
      });
    }

    // Parse message as number
    const progressValue = parseInt(messageText.trim(), 10);

    // Validate number is between 1-100
    if (isNaN(progressValue) || progressValue < 1 || progressValue > 100) {
      // Send bot reply with friendly reminder
      await sendBotMessage(
        member.connection_type,
        phoneNumber,
        'Please send a number between 1 and 100 to update your progress! 📊'
      );

      return res.status(200).json({ 
        success: false,
        message: 'Invalid input, reminder sent to user' 
      });
    }

    // Update progress in database
    const { data: updated, error: updateError } = await supabase
      .from('shadow_members')
      .update({ 
        task_progress: progressValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', member.id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ error: 'Failed to update progress' });
    }

    // Send confirmation to user
    await sendBotMessage(
      member.connection_type,
      phoneNumber,
      `✅ Progress updated to ${progressValue}%! Keep up the great work, ${member.name}!`
    );

    // Broadcast update to connected dashboard clients (WebSocket/SSE)
    // This would trigger real-time UI update
    // broadcastToClients({ type: 'shadow_member_update', data: updated });

    return res.status(200).json({ 
      success: true,
      member: updated,
      previousProgress: member.task_progress,
      newProgress: progressValue,
    });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to send bot messages
async function sendBotMessage(platform, recipient, message) {
  try {
    if (platform === 'whatsapp') {
      // WhatsApp Business API example
      const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
      const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

      await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body: message },
        }),
      });

    } else if (platform === 'telegram') {
      // Telegram Bot API example
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: recipient,
          text: message,
        }),
      });
    }
  } catch (error) {
    console.error('Failed to send bot message:', error);
  }
}

// GET /api/members/shadow - List all shadow members
app.get('/api/members/shadow', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('shadow_members')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch shadow members' });
    }

    return res.status(200).json({ members: data });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Shadow Member webhook server running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/api/webhook/bot`);
});
```

### 3. Environment Variables

```bash
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# WhatsApp Business API (if using WhatsApp)
WHATSAPP_ACCESS_TOKEN=your-whatsapp-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id

# Telegram Bot API (if using Telegram)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# App URL for webhooks
APP_URL=https://your-app-domain.com
PORT=3001
```

### 4. Frontend Integration

Update the frontend to fetch shadow members from the backend:

```typescript
// In TeamManager.tsx
useEffect(() => {
  // Fetch shadow members from backend
  fetch('/api/members/shadow')
    .then(res => res.json())
    .then(data => setShadowMembers(data.members))
    .catch(err => console.error('Failed to fetch shadow members:', err));
}, []);

// Subscribe to real-time updates (WebSocket or Supabase Realtime)
useEffect(() => {
  const subscription = supabase
    .channel('shadow_members')
    .on('postgres_changes', 
      { event: 'UPDATE', schema: 'public', table: 'shadow_members' },
      (payload) => {
        // Update UI when progress changes
        setShadowMembers(prev => 
          prev.map(m => m.id === payload.new.id ? payload.new : m)
        );
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
}, []);
```

## Testing the Webhook

### Using cURL

```bash
# Test valid progress update
curl -X POST http://localhost:3001/api/webhook/bot \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "chat": { "id": 12345 },
      "text": "75"
    }
  }'

# Test invalid input (should trigger reminder)
curl -X POST http://localhost:3001/api/webhook/bot \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "chat": { "id": 12345 },
      "text": "hello"
    }
  }'
```

## Bot Platform Setup

### WhatsApp Business API
1. Create a Meta Business account
2. Set up WhatsApp Business API
3. Configure webhook URL: `https://your-domain.com/api/webhook/bot`
4. Subscribe to `messages` webhook events

### Telegram Bot
1. Create bot via @BotFather on Telegram
2. Get bot token
3. Set webhook: 
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/setWebhook \
     -d url=https://your-domain.com/api/webhook/bot
   ```

## Security Considerations

1. **Webhook Verification**: Verify webhook signatures from WhatsApp/Telegram
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **Phone Number Validation**: Validate phone numbers before storing
4. **HTTPS Only**: Use HTTPS in production for webhook endpoints
5. **Environment Variables**: Never commit tokens/keys to version control

## Next Steps

1. Deploy backend to a hosting service (Heroku, Railway, Fly.io)
2. Set up WhatsApp Business API or Telegram Bot
3. Configure webhook URLs
4. Test with real phone numbers
5. Add monitoring/logging for webhook events
6. Implement WebSocket for real-time dashboard updates
