const TelegramBot = require("node-telegram-bot-api");
const crypto = require("crypto");
const config = require("./botconfig.json");
const { saveUser, getUserByTelegramId } = require("./apis");

class TelegramBotHandler {
  constructor() {
    this.bot = new TelegramBot(config.bot.token, { polling: true });
    this.initializeCommands();
  }

  createToken(userId) {
    return crypto.createHmac("sha256", config.server.secret_key)
      .update(String(userId))
      .digest("hex");
  }

  generateUniqueCode() {
    return crypto.randomBytes(8).toString('hex').toUpperCase();
  }

  initializeCommands() {
    // Handle /start command with optional referral
    this.bot.onText(/\/start(.*)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const params = match[1] ? match[1].trim() : '';
      
      let referralCode = null;
      
      // Parse start parameters for referral
      if (params) {
        const urlParams = new URLSearchParams(params.replace(/^[\s=]/, ''));
        referralCode = urlParams.get('referral');
      }

      await this.handleStart(chatId, referralCode);
    });

    // Handle /play command
    this.bot.onText(/\/play/, async (msg) => {
      const chatId = msg.chat.id;
      await this.handlePlay(chatId);
    });
  }

  // handleStart method ko replace karo
async handleStart(chatId, referralCode = null) {
    try {
        let user = await getUserByTelegramId(chatId);
        
        if (!user) {
            // Create new user with userid
            const uniqueCode = String(chatId);
            user = await saveUser({
                telegramId: chatId,
                uniqueCode: uniqueCode,
                referredBy: referralCode || null,
                newUser: true,
                name: null,
                createdAt: new Date().toISOString()
            });
        }

        const token = this.createToken(chatId);
        
        // Check if user needs to register (no name or new_user = 1)
        const needsRegistration = !user.name || user.new_user === 1;
        
        const targetUrl = needsRegistration
            ? `/new?uid=${chatId}&token=${token}${referralCode ? `&ref=${referralCode}` : ''}`
            : `/game?uid=${chatId}&token=${token}`;

        const gameUrl = `${config.server.domain}${targetUrl}`;

        const keyboard = {
            reply_markup: {
                inline_keyboard: [[{
                    text: config.commands.start.button_text,
                    web_app: { url: gameUrl }
                }]]
            }
        };

        await this.bot.sendMessage(chatId, config.messages.welcome, keyboard);

    } catch (error) {
        console.error('Error handling start command:', error);
        await this.bot.sendMessage(chatId, "❌ An error occurred. Please try again.");
    }
}

  async handlePlay(chatId) {
    try {
      // Check if user exists, if not create one
      let user = await getUserByTelegramId(chatId);
      
      if (!user) {
        const uniqueCode = this.generateUniqueCode();
        user = await saveUser({
          telegramId: chatId,
          uniqueCode: uniqueCode,
          referredBy: null,
          newUser: true,
          name: null,
          createdAt: new Date().toISOString()
        });
      }

      const token = this.createToken(chatId);
      const gameUrl = `${config.server.domain}/game?uid=${chatId}&token=${token}`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [[{
            text: config.commands.play.button_text,
            web_app: { url: gameUrl }
          }]]
        }
      };

      await this.bot.sendMessage(chatId, config.messages.play_prompt, keyboard);

    } catch (error) {
      console.error('Error handling play command:', error);
      await this.bot.sendMessage(chatId, "âŒ An error occurred. Please try again.");
    }
  }

  checkToken(uid, token) {
    const expected = this.createToken(uid);
    return expected === token;
  }
}

module.exports = TelegramBotHandler;