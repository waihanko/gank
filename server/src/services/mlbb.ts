// MLBB Official API Service
// Replaces the old synnmlbb.com scraper with official Moonton APIs

const COMMON_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  "Origin": "https://www.mobilelegends.com",
  "Referer": "https://www.mobilelegends.com/",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
};

export async function sendVc(roleId: string, zoneId: string): Promise<boolean> {
  try {
    const res = await fetch("https://sg-api.mobilelegends.com/base/sendVc", {
      method: "POST",
      headers: COMMON_HEADERS,
      body: new URLSearchParams({
        roleId,
        zoneId
      }).toString()
    });
    
    const data = await res.json() as any;
    if (data.code === 0) {
      return true;
    }
    
    console.warn('[MLBB] sendVc failed:', data);
    return false;
  } catch (error) {
    console.error('[MLBB] sendVc error:', error);
    return false;
  }
}

export interface MLBBLoginResult {
  success: boolean;
  jwt?: string;
  roleId?: string;
  zoneId?: string;
  error?: string;
}

export async function loginWithVc(roleId: string, zoneId: string, vc: string): Promise<MLBBLoginResult> {
  try {
    const res = await fetch("https://sg-api.mobilelegends.com/base/login", {
      method: "POST",
      headers: COMMON_HEADERS,
      body: new URLSearchParams({
        roleId,
        zoneId,
        vc,
        referer: "academy",
        type: "web"
      }).toString()
    });
    
    const data = await res.json() as any;
    if (data.code === 0 && data.data?.jwt) {
      return {
        success: true,
        jwt: data.data.jwt,
        roleId: data.data.roleid?.toString(),
        zoneId: data.data.zoneid?.toString(),
      };
    }
    
    return { success: false, error: data.msg || 'Invalid verification code' };
  } catch (error) {
    console.error('[MLBB] loginWithVc error:', error);
    return { success: false, error: 'Network error' };
  }
}

export interface MLBBProfile {
  success: boolean;
  name?: string;
  avatar?: string;
  level?: number;
  rank_level?: number;
  reg_country?: string;
  error?: string;
}

export async function getBaseInfo(jwt: string): Promise<MLBBProfile> {
  try {
    const res = await fetch("https://sg-api.mobilelegends.com/base/getBaseInfo", {
      method: "POST",
      headers: {
        ...COMMON_HEADERS,
        "authorization": jwt,
        "x-token": jwt,
        "x-actid": "2728785",
        "x-appid": "2713644"
      }
    });
    
    const data = await res.json() as any;
    if (data.code === 0 && data.data) {
      return {
        success: true,
        name: data.data.name,
        avatar: data.data.avatar,
        level: data.data.level,
        rank_level: data.data.rank_level,
        reg_country: data.data.reg_country
      };
    }
    
    return { success: false, error: data.msg || 'Failed to get profile' };
  } catch (error) {
    console.error('[MLBB] getBaseInfo error:', error);
    return { success: false, error: 'Network error' };
  }
}
