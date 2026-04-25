// Telegram Username Verification Service
// Checks if a @username exists on Telegram by scraping t.me profile page
// Extracts: display name, bio, type, profile image

export interface TelegramAccount {
  exists: boolean;
  displayName: string;
  bio: string;
  type: 'user' | 'bot' | 'channel' | 'group' | 'unknown';
  profileImage: string;
}

export async function verifyTelegramUsername(username: string): Promise<TelegramAccount> {
  const empty: TelegramAccount = { exists: false, displayName: '', bio: '', type: 'unknown', profileImage: '' };

  try {
    const cleanUsername = username.replace(/^@/, '');

    const res = await fetch(`https://t.me/${cleanUsername}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    const html = await res.text();

    // If the page has "tgme_page_title" class, the profile exists
    if (!html.includes('tgme_page_title')) {
      return empty;
    }

    // Extract display name
    const nameMatch = html.match(/<span dir="auto">([^<]+)<\/span>/);
    const ogNameMatch = html.match(/"og:title"\s+content="([^"]+)"/);
    let displayName = nameMatch ? nameMatch[1] : (ogNameMatch ? ogNameMatch[1] : cleanUsername);
    displayName = decodeHtmlEntities(displayName);

    // Extract bio/description
    const bioMatch = html.match(/"og:description"\s+content="([^"]+)"/);
    let bio = bioMatch ? bioMatch[1] : '';
    bio = decodeHtmlEntities(bio);

    // Extract profile image
    const imgMatch = html.match(/"og:image"\s+content="([^"]+)"/);
    const profileImage = imgMatch ? imgMatch[1] : '';

    // Determine type
    let type: TelegramAccount['type'] = 'user';
    if (cleanUsername.toLowerCase().endsWith('bot')) {
      type = 'bot';
    } else if (html.includes('tgme_channel_info') || html.includes('channel_join_')) {
      type = 'channel';
    } else if (html.match(/\d+\s*(subscribers)/i)) {
      type = 'channel';
    } else if (html.match(/\d+\s*(members)/i)) {
      type = 'group';
    }

    return { exists: true, displayName, bio, type, profileImage };
  } catch (error) {
    console.error('[TELEGRAM] Verification error:', error);
    return { exists: true, displayName: username, bio: '', type: 'unknown', profileImage: '' };
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}
