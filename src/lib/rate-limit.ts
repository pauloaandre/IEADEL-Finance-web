/**
 * Implementação Simples de Rate Limiting em Memória.
 * Atenção: Funciona perfeitamente em ambientes contínuos (VPS/Docker) ou em single-region.
 * Em ambientes Serverless (como Vercel Edge), o estado pode ser resetado a cada isolado V8,
 * mas ainda oferece proteção significativa contra ataques de rajada (burst attacks).
 */

type RateLimitRecord = {
  count: number;
  resetAt: number; // timestamp em ms
};

// Armazenamento em memória (IP -> Record)
const store = new Map<string, RateLimitRecord>();

/**
 * Verifica e incrementa o rate limit para um dado identificador (ex: IP + rota).
 *
 * @param identifier Identificador único (IP + Rota)
 * @param maxRequests Máximo de requisições permitidas
 * @param windowMs Janela de tempo em milissegundos
 * @returns { success: boolean, remaining: number, reset: number }
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const record = store.get(identifier);

  // Se não existe ou se a janela já expirou, cria um novo
  if (!record || now > record.resetAt) {
    store.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      success: true,
      remaining: maxRequests - 1,
      reset: now + windowMs,
    };
  }

  // Se já existe e está dentro da janela
  if (record.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      reset: record.resetAt,
    };
  }

  // Incrementa contagem
  record.count += 1;
  store.set(identifier, record);

  return {
    success: true,
    remaining: maxRequests - record.count,
    reset: record.resetAt,
  };
}

/**
 * Utilitário opcional para limpar IPs velhos da memória para evitar memory leak.
 * Chamado passivamente a cada x requisições, por exemplo.
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now > record.resetAt) {
      store.delete(key);
    }
  }
}
