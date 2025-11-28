// Emoji shortcuts mapping
export const emojiShortcuts = {
  ':)': '😊',
  ':-)': '😊',
  ':D': '😃',
  ':-D': '😃',
  ';)': '😉',
  ';-)': '😉',
  ':(': '😞',
  ':-(': '😞',
  ':P': '😛',
  ':-P': '😛',
  ':p': '😛',
  ':-p': '😛',
  ':O': '😮',
  ':-O': '😮',
  ':o': '😮',
  ':-o': '😮',
  '<3': '❤️',
  '</3': '💔',
  ':*': '😘',
  ':-*': '😘',
  'xD': '😆',
  'XD': '😆',
  ':\'(': '😢',
  ':-(': '😞',
  ':|': '😐',
  ':-|': '😐',
  ':/')': '😕',
  ':-/': '😕',
  '>:(': '😠',
  '>:-(': '😠',
  ':3': '😺',
  'o.o': '😳',
  'O.O': '😳',
  '^_^': '😊',
  '-_-': '😑',
  'T_T': '😭',
  '>_<': '😣',
  ':thumbsup:': '👍',
  ':thumbsdown:': '👎',
  ':heart:': '❤️',
  ':fire:': '🔥',
  ':star:': '⭐',
  ':100:': '💯',
  ':clap:': '👏',
  ':pray:': '🙏',
  ':rainbow:': '🌈',
  ':sparkles:': '✨',
  ':tada:': '🎉',
  ':eyes:': '👀',
  ':thinking:': '🤔',
  ':laugh:': '😂',
  ':cry:': '😭',
  ':love:': '😍',
  ':kiss:': '😘',
  ':wink:': '😉',
  ':smile:': '😊',
  ':grin:': '😁',
  ':cool:': '😎',
  ':angry:': '😠',
  ':sad:': '😢',
  ':shocked:': '😱',
  ':confused:': '😕',
  ':neutral:': '😐',
  ':sleepy:': '😴',
  ':sick:': '🤢',
  ':party:': '🥳',
  ':sunglasses:': '😎',
  ':nerd:': '🤓',
  ':devil:': '😈',
  ':angel:': '😇',
  ':poop:': '💩',
  ':ghost:': '👻',
  ':alien:': '👽',
  ':robot:': '🤖',
  ':cat:': '🐱',
  ':dog:': '🐶',
  ':monkey:': '🐵',
  ':pizza:': '🍕',
  ':burger:': '🍔',
  ':beer:': '🍺',
  ':wine:': '🍷',
  ':coffee:': '☕',
  ':cake:': '🍰',
  ':gift:': '🎁',
  ':balloon:': '🎈',
  ':music:': '🎵',
  ':camera:': '📷',
  ':phone:': '📱',
  ':computer:': '💻',
  ':book:': '📖',
  ':money:': '💰',
  ':crown:': '👑',
  ':gem:': '💎',
  ':ring:': '💍',
  ':lipstick:': '💄',
  ':dress:': '👗',
  ':shoe:': '👠',
  ':bag:': '👜',
  ':umbrella:': '☂️',
  ':sun:': '☀️',
  ':moon:': '🌙',
  ':cloud:': '☁️',
  ':rain:': '🌧️',
  ':snow:': '❄️',
  ':lightning:': '⚡',
  ':tree:': '🌲',
  ':flower:': '🌸',
  ':rose:': '🌹',
  ':earth:': '🌍',
  ':rocket:': '🚀',
  ':plane:': '✈️',
  ':car:': '🚗',
  ':bike:': '🚲',
  ':house:': '🏠',
  ':office:': '🏢',
  ':hospital:': '🏥',
  ':school:': '🏫',
  ':flag:': '🚩',
  ':check:': '✅',
  ':x:': '❌',
  ':warning:': '⚠️',
  ':question:': '❓',
  ':exclamation:': '❗',
  ':plus:': '➕',
  ':minus:': '➖',
  ':left:': '⬅️',
  ':right:': '➡️',
  ':up:': '⬆️',
  ':down:': '⬇️',
};

// Convert emoji shortcuts to actual emojis
export const convertEmojiShortcuts = (text) => {
  let result = text;
  
  // Sort shortcuts by length (longest first) to avoid partial replacements
  const sortedShortcuts = Object.keys(emojiShortcuts).sort((a, b) => b.length - a.length);
  
  sortedShortcuts.forEach(shortcut => {
    const emoji = emojiShortcuts[shortcut];
    // Use word boundaries for text shortcuts like :smile:
    if (shortcut.startsWith(':') && shortcut.endsWith(':')) {
      const regex = new RegExp(shortcut.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      result = result.replace(regex, emoji);
    } else {
      // For symbol shortcuts like :) or <3, replace with word boundaries
      const regex = new RegExp('(^|\\s)' + shortcut.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$)', 'g');
      result = result.replace(regex, '$1' + emoji);
    }
  });
  
  return result;
};

// Format text with hashtags and mentions highlighted
export const formatTextWithLinks = (text) => {
  if (!text) return '';
  
  // Convert emoji shortcuts first
  let formattedText = convertEmojiShortcuts(text);
  
  // Split by spaces to process each word
  const parts = formattedText.split(/(\s+)/);
  
  return parts.map((part, index) => {
    // Check for hashtags
    if (part.match(/^#[\w]+$/)) {
      const tag = part.substring(1);
      return `<a href="/hashtag/${tag}" class="hashtag-link" key="${index}">${part}</a>`;
    }
    
    // Check for mentions
    if (part.match(/^@[\w]+$/)) {
      const username = part.substring(1);
      return `<span class="mention-link" data-username="${username}" key="${index}">${part}</span>`;
    }
    
    // Check for URLs
    if (part.match(/^https?:\/\/.+/)) {
      return `<a href="${part}" target="_blank" rel="noopener noreferrer" class="url-link" key="${index}">${part}</a>`;
    }
    
    return part;
  }).join('');
};

