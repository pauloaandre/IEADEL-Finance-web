import { auth } from './auth'
import { NextResponse } from 'next/server'
import type { NextAuthRequest } from 'next-auth'
import { checkRateLimit } from '@/lib/rate-limit'

// Rotas completamente públicas — equivalente ao .permitAll() do Spring Security
const PUBLIC_PREFIXES = [
  '/api/auth',          // Auth.js handler (login, session, etc.)
  '/api/health',        // GET /health → .permitAll()
  '/api/usuarios/novo', // POST /auth/novo → .permitAll()
  '/api/cadastro',      // POST /api/cadastro -> Cadastro
  '/api/verify-email',  // GET /api/verify-email -> Verificação de email
]

const PUBLIC_ROUTES = [
  '/',                  // Página inicial (Login)
  '/cadastro',          // Página de cadastro
]

// Rotas exclusivas para SUPER_ADMIN — equivalente ao .hasRole("SUPER_ADMIN")
const SUPER_ADMIN_ROUTES = [
  '/api/superadmin',
]

// auth() do NextAuth v5 envolve o handler e injeta req.auth (session | null)
export default auth(function middleware(req: NextAuthRequest) {
  const { pathname } = req.nextUrl
  const method = req.method
  // Cast para ignorar erro de tipo no NextAuthRequest que as vezes omite req.ip
  const ip = req.headers.get('x-forwarded-for') || (req as any).ip || '127.0.0.1'

  // ===========================================================================
  // RATE LIMITING
  // ===========================================================================
  
  // 1. Limite de Login (Brute Force Protection): 5 tentativas / 5 minutos
  if (pathname === '/api/auth/callback/credentials' && method === 'POST') {
    const rateLimit = checkRateLimit(`login_${ip}`, 5, 5 * 60 * 1000)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Muitas tentativas de login. Tente novamente mais tarde.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) } }
      )
    }
  }

  // 2. Limite de Cadastro Público (Spam Protection): 3 tentativas / 15 minutos
  if (pathname === '/api/usuarios/novo' && method === 'POST') {
    const rateLimit = checkRateLimit(`register_${ip}`, 3, 15 * 60 * 1000)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Muitos cadastros a partir deste IP. Tente novamente mais tarde.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) } }
      )
    }
  }

  // ===========================================================================
  // REGRAS DE AUTORIZAÇÃO
  // ===========================================================================

  // 1. Verificar rotas públicas sem verificação de sessão
  // GET /api/congregacoes é estritamente público (listagem)
  if (pathname === '/api/congregacoes' && method === 'GET') {
    return NextResponse.next()
  }

  // 2. Obter a sessão atual
  const session = req.auth

  // 3. Se o usuário acessar a página de login (/) já logado, redirecioná-lo para seu painel
  if (pathname === '/' && session?.user) {
    switch (session.user.perfil) {
      case 'SUPER_ADMIN':
        return NextResponse.redirect(new URL('/homesuperadmin', req.url))
      case 'ADMIN':
        return NextResponse.redirect(new URL('/homeadmin', req.url))
      case 'USER':
      default:
        return NextResponse.redirect(new URL('/homeuser', req.url))
    }
  }

  // 4. Se a rota for pública (ex: /, /cadastro, ou prefixos públicos), libera o acesso
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)
  const isPublicPrefix = PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))
  
  if (isPublicRoute || isPublicPrefix) {
    return NextResponse.next()
  }

  // 5. Bloquear acesso a rotas privadas se não houver sessão
  if (!session?.user) {
    // API routes → retornar 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }
    // Páginas → redirecionar para login
    return NextResponse.redirect(new URL('/', req.url))
  }

  // 3. Regra de autorização para POST /api/congregacoes -> exclusivo SUPER_ADMIN
  if (pathname === '/api/congregacoes' && method === 'POST') {
    if (session.user.perfil !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Requer perfil SUPER_ADMIN.' },
        { status: 403 }
      )
    }
  }

  // 4. Verificar rotas exclusivas do SUPER_ADMIN
  const isSuperAdminRoute = SUPER_ADMIN_ROUTES.some(route => pathname.startsWith(route))
  if (isSuperAdminRoute && session.user.perfil !== 'SUPER_ADMIN') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Acesso negado. Requer perfil SUPER_ADMIN.' },
        { status: 403 }
      )
    }
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Corresponde a todas as rotas exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     * - arquivos públicos com extensão
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
