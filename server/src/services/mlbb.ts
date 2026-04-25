// MLBB ID Verification Service
// Uses synnmlbb.com's ML Checker API (with session + CSRF handling)

export interface MLBBAccount {
  username: string;
  region: string;
  found: boolean;
}

export async function verifyMLBBAccount(userId: string, zoneId: string): Promise<MLBBAccount> {
  try {
    // Step 1: Get CSRF token and session cookies from the checker page
    const pageRes = await fetch('https://www.synnmlbb.com/ml-checker', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    const html = await pageRes.text();
    const cookies = pageRes.headers.getSetCookie?.() || [];

    // Extract CSRF token from HTML meta tag or hidden input
    const tokenMatch = html.match(/meta\s+name="csrf-token"\s+content="([^"]+)"/)
      || html.match(/_token.*?value="([^"]+)"/)
      || html.match(/csrf[_-]token['":\s]+['"]([^'"]+)/i);

    if (!tokenMatch) {
      console.error('[MLBB] Could not extract CSRF token');
      return { username: '', region: '', found: false };
    }

    const csrfToken = tokenMatch[1];

    // Build cookie string
    const cookieStr = cookies.map((c: string) => c.split(';')[0]).join('; ');

    // Also extract XSRF-TOKEN from cookies for the header
    const xsrfMatch = cookieStr.match(/XSRF-TOKEN=([^;]+)/);
    const xsrfToken = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : '';

    // Step 2: Call the ML check API
    const checkRes = await fetch('https://www.synnmlbb.com/ml-check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.synnmlbb.com/ml-checker',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookieStr,
        ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
      },
      body: new URLSearchParams({
        '_token': csrfToken,
        'data[zone_id]': zoneId,
        'data[user_id]': userId,
        'data[ip_address]': '127.0.0.1',
      }).toString(),
    });

    const data = await checkRes.json() as {
      success: boolean;
      data?: {
        nickname?: string;
        account_created_from?: string;
        account_login_from?: string;
      };
    };

    if (data.success && data.data?.nickname) {
      return {
        username: data.data.nickname,
        region: data.data.account_created_from || data.data.account_login_from || 'Unknown',
        found: true,
      };
    }

    return { username: '', region: '', found: false };
  } catch (error) {
    console.error('[MLBB] Verification error:', error);
    return { username: '', region: '', found: false };
  }
}
