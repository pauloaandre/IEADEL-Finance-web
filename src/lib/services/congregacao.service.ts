import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import type {
  CreateCongregacaoInput,
  CongregacaoResponse,
} from '@/lib/validations/congregacao'

/**
 * Mapeia uma entidade Congregacao para CongregacaoResponseDTO
 * seguindo a regra de negócio do Spring Boot:
 * Membros só são contados se includeMembers (isSuperAdmin) for true.
 * Membros contados: ativo === true e nome não começa com 'Visitante'.
 */
function toCongregacaoResponse(
  congregacao: {
    idCongregacao: number
    nome: string
    endereco: string | null
    usuarios?: { ativo: boolean; nome: string }[]
  },
  includeMembers: boolean
): CongregacaoResponse {
  const response: CongregacaoResponse = {
    idCongregacao: congregacao.idCongregacao,
    nome: congregacao.nome,
    endereco: congregacao.endereco,
  }

  if (includeMembers && congregacao.usuarios) {
    response.quantidadeMembros = congregacao.usuarios.filter(
      (u) => u.ativo && !u.nome.startsWith('Visitante')
    ).length
  }

  return response
}

/**
 * Lista todas as congregações.
 * Se isSuperAdmin for true, inclui quantidadeMembros de cada uma.
 */
export async function listarCongregacoes(
  isSuperAdmin: boolean
): Promise<CongregacaoResponse[]> {
  const congregacoes = await prisma.congregacao.findMany({
    orderBy: { idCongregacao: 'asc' },
    include: isSuperAdmin
      ? {
          usuarios: {
            select: {
              ativo: true,
              nome: true,
            },
          },
        }
      : undefined,
  })

  return congregacoes.map((c) => toCongregacaoResponse(c, isSuperAdmin))
}

/**
 * Busca uma congregação por ID.
 * Se isSuperAdmin for true, inclui quantidadeMembros.
 */
export async function buscarCongregacaoPorId(
  id: number,
  isSuperAdmin: boolean
): Promise<CongregacaoResponse | null> {
  const congregacao = await prisma.congregacao.findUnique({
    where: { idCongregacao: id },
    include: isSuperAdmin
      ? {
          usuarios: {
            select: {
              ativo: true,
              nome: true,
            },
          },
        }
      : undefined,
  })

  if (!congregacao) return null

  return toCongregacaoResponse(congregacao, isSuperAdmin)
}

/**
 * Cria uma nova congregação e seu usuário visitante correspondente em transação atômica.
 * Replica exatamente CongregacaoService.criarCongregacao() do Spring Boot.
 */
export async function criarCongregacao(
  dados: CreateCongregacaoInput
): Promise<CongregacaoResponse> {
  return await prisma.$transaction(async (tx) => {
    // 1. Cria a congregação
    const novaCongregacao = await tx.congregacao.create({
      data: {
        nome: dados.nome,
        endereco: dados.endereco ?? null,
      },
    })

    // 2. Cria o usuário Visitante atrelado
    const senhaAleatoria = crypto.randomUUID()
    const senhaHash = await bcrypt.hash(senhaAleatoria, 10)

    await tx.usuario.create({
      data: {
        nome: `Visitante - ${novaCongregacao.nome}`,
        email: `visitante.${novaCongregacao.idCongregacao}@ieadel.com`,
        senha: senhaHash,
        perfil: 'USER',
        ativo: false,
        isVerified: true,
        congregacaoId: novaCongregacao.idCongregacao,
      },
    })

    return {
      idCongregacao: novaCongregacao.idCongregacao,
      nome: novaCongregacao.nome,
      endereco: novaCongregacao.endereco,
    }
  })
}
