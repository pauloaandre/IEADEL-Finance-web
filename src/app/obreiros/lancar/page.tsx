"use client";
import { useState, useEffect } from "react";
import NavBar from "@/components/navbar";
import { buscarUsuariosPorNomeAction } from "@/actions/usuarios";
import { criarMovimentacaoAction } from "@/actions/movimentacoes";
import { listarCongregacoesAction } from "@/actions/congregacoes";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useRouter } from "next/navigation";

type Pessoa = { id_usuario: string; nome: string; tipoContribuinte: string | null | undefined; idCongregacao: number };
type Congregacao = { idCongregacao: number; nome: string };

export default function LançarDizimoObreiro() {
  const router = useRouter();
  const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];

  const [descricao, setDescricao] = useState("");
  const [idUsuario, setIdUsuario] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [idCongregacaoOrigem, setIdCongregacaoOrigem] = useState<number | "">("");

  const [sugestoes, setSugestoes] = useState<Pessoa[]>([]);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadCongregacoes() {
      const res = await listarCongregacoesAction();
      if (res.success) {
        setCongregacoes(res.data as unknown as Congregacao[]);
      }
    }
    loadCongregacoes();
  }, []);

  async function handleSearchObreiro(e: React.ChangeEvent<HTMLInputElement>) {
    const valorInput = e.target.value;
    setDescricao(valorInput);
    setIdUsuario(null);

    if (valorInput.length > 2) {
      const res = await buscarUsuariosPorNomeAction(valorInput);
      if (res.success) {
        // Filtrar apenas OBREIROS
        const obreiros = res.data.filter(u => u.tipoContribuinte === 'OBREIRO');
        const mapped = obreiros.map(u => ({
          id_usuario: u.id,
          nome: u.nome,
          tipoContribuinte: u.tipoContribuinte,
          idCongregacao: u.idCongregacao ?? 0
        }));
        setSugestoes(mapped);
      } else {
        setSugestoes([]);
      }
    } else {
      setSugestoes([]);
    }
  }

  function handleSelectObreiro(pessoa: Pessoa) {
    setDescricao(pessoa.nome);
    setIdUsuario(pessoa.id_usuario);
    setIdCongregacaoOrigem(pessoa.idCongregacao > 0 ? pessoa.idCongregacao : "");
    setSugestoes([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idUsuario) {
      alert("Selecione um obreiro válido na lista.");
      return;
    }
    if (!idCongregacaoOrigem) {
      alert("Selecione a congregação de origem.");
      return;
    }
    
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const payload = {
        descricao: `Dízimo de Obreiro - ${descricao}`,
        valor: Number(valor) || 0,
        data,
        tipo: "DIZIMO" as const,
        isVisitante: false,
        usuarioId: idUsuario,
        idCongregacaoDestino: Number(idCongregacaoOrigem), // GESTOR enviando a origem real
      };

      const res = await criarMovimentacaoAction(payload);

      if (res.success) {
        alert("Dízimo de Obreiro lançado com sucesso!");
        router.push("/obreiros");
      } else {
        alert("Erro ao salvar dízimo: " + res.error);
      }
    } catch (err) {
        alert("Erro inesperado ao salvar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <title>Lançar Dízimo de Obreiro</title>
      <div className="min-h-screen bg-slate-50 pb-10">
        <NavBar />
        
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mt-8 mb-6">
            <Link 
                href="/homegestor" 
                className="flex items-center gap-2 text-gray-500 hover:text-purple-600 transition-colors font-medium text-sm"
            >
                <ArrowLeft size={18} />
                Voltar para o Painel do Gestor
            </Link>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Registrar Dízimo de Obreiro</h1>
            <p className="text-sm text-gray-500 mb-8">
              Este lançamento será registrado na congregação de origem selecionada e não aumentará o saldo da filial e nem o saldo da Sede. Apenas constará para relatório da Convenção.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Obreiro</label>
                <input
                  type="text"
                  value={descricao}
                  onChange={handleSearchObreiro}
                  placeholder="Busque o nome do obreiro..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all bg-gray-50 focus:bg-white"
                  required
                />
                {sugestoes.length > 0 && (
                  <ul className="absolute z-10 bg-white border border-gray-200 rounded-xl mt-1 w-full max-h-60 overflow-y-auto shadow-lg">
                    {sugestoes.map((p) => (
                      <li
                        key={p.id_usuario}
                        onClick={() => handleSelectObreiro(p)}
                        className="px-4 py-3 hover:bg-purple-50 cursor-pointer border-b border-gray-50 last:border-0"
                      >
                        <div className="font-medium text-gray-900">{p.nome}</div>
                        <div className="text-xs text-gray-500">
                          Congregação vinculada: {congregacoes.find(c => c.idCongregacao === p.idCongregacao)?.nome || 'Não definida'}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {descricao.length > 2 && !idUsuario && sugestoes.length === 0 && (
                   <p className="text-xs text-red-500 mt-2">Selecione um obreiro sugerido na lista. (Se não aparecer, o usuário pode não estar classificado como OBREIRO).</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Congregação de Origem</label>
                <select
                  value={idCongregacaoOrigem}
                  onChange={(e) => setIdCongregacaoOrigem(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all bg-gray-50 focus:bg-white"
                  required
                >
                  <option value="" disabled>Selecione a congregação</option>
                  {congregacoes.map((cong) => (
                    <option key={cong.idCongregacao} value={cong.idCongregacao}>
                      {cong.nome}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">A congregação onde o dízimo será contabilizado para a Convenção.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Valor (R$)</label>
                  <input
                    type="number"
                    value={valor}
                    inputMode="decimal" 
                    step="0.01"
                    placeholder="0,00"
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all bg-gray-50 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Data / Competência</label>
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all bg-gray-50 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={isSubmitting || !idUsuario || idCongregacaoOrigem === ""}
                  className={`w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-white transition-all shadow-md
                    ${(isSubmitting || !idUsuario || idCongregacaoOrigem === "") 
                      ? "bg-gray-400 cursor-not-allowed shadow-none" 
                      : "bg-purple-600 hover:bg-purple-700 hover:shadow-lg"
                    }`}
                >
                  <Save size={20} />
                  {isSubmitting ? "Salvando..." : "Salvar Dízimo de Obreiro"}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </>
  );
}
