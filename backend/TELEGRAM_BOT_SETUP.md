# Telegram Bot Setup for Profile Pictures

## Overview
The backend now supports fetching Telegram profile pictures for users when they register. This enhances the visual experience by showing actual user photos instead of generic avatars.

## Setup Instructions

### 1. Create a Telegram Bot
1. Message @BotFather on Telegram
2. Use `/newbot` command
3. Choose a name and username for your bot
4. Copy the bot token provided

### 2. Configure Environment Variable
Add your bot token to your environment configuration:

```bash
# In your .env file or environment
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### 3. Bot Permissions
Your bot needs to be able to:
- Access user profile photos (this is allowed by default)
- The bot doesn't need to be added to any groups

### 4. How it works
1. When a user registers with Telegram data including their `telegramId`
2. The backend automatically fetches their profile picture using the Bot API
3. The profile picture URL is cached for 1 hour to avoid repeated API calls
4. The `telegramPhotoUrl` field is included in user data and sent to the frontend
5. The frontend displays the profile picture in player cards

### 5. Frontend Integration
The profile picture is automatically used in the `SimpleCarousel.js` component:

```javascript
{player.telegramPhotoUrl ? (
  <img
    src={player.telegramPhotoUrl}
    alt={`${player.username} profile`}
    className="player-avatar telegram-avatar"
    onError={(e) => {
      e.target.style.display = 'none';
      e.target.nextSibling.style.display = 'flex';
    }}
  />
) : (
  <div className="player-avatar">{player.username.charAt(0)}</div>
)}
```

### 6. Error Handling
- If the bot token is not configured, profile pictures won't be fetched
- If a user has no profile picture, it falls back to the first letter of their username
- Failed requests are cached for 10 minutes to avoid spamming the API
- All errors are logged but don't affect the core functionality

### 7. Rate Limiting
- Profile pictures are cached for 1 hour per user
- Failed requests are cached for 10 minutes
- The system respects Telegram's API rate limits

## Testing
1. Set up your bot token
2. Register a user with Telegram data
3. Check the console logs for profile picture fetch messages
4. Verify the `telegramPhotoUrl` field in user data
5. Confirm the profile picture displays in the frontend 