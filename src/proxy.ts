import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Skip: mobile routes, API, Next.js internals, static files, admin
  if (
    pathname.startsWith('/m/') ||
    pathname === '/m' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // ?mobile=true → set cookie + redirect (strip query param)
  if (searchParams.get('mobile') === 'true') {
    const url = request.nextUrl.clone();
    url.searchParams.delete('mobile');
    const response = NextResponse.redirect(url);
    response.cookies.set('view', 'mobile', {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
      sameSite: 'lax',
    });
    return response;
  }

  // ?mobile=false → clear cookie + redirect
  if (searchParams.get('mobile') === 'false') {
    const url = request.nextUrl.clone();
    url.searchParams.delete('mobile');
    const response = NextResponse.redirect(url);
    response.cookies.set('view', 'desktop', {
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
      sameSite: 'lax',
    });
    return response;
  }

  // Check cookie
  const viewCookie = request.cookies.get('view')?.value;
  const isMobile = viewCookie === 'mobile';

  if (isMobile) {
    // Rewrite to /m/* transparently — URL in browser stays the same
    const url = request.nextUrl.clone();
    const mobilePath = pathname === '/' ? '/m' : `/m${pathname}`;
    url.pathname = mobilePath;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
