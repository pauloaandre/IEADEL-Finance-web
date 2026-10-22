"use client";
import { useState, useEffect } from "react";
import NavBar from "@/components/navbar";
import MonthSelector from "@/components/monthselector";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { listarDizimosObreirosGestorAction, excluirMovimentacaoAction } from "@/actions/movimentacoes";
import { listarCongregacoesAction } from "@/actions/congregacoes";
import { parseDateLocal } from "@/utils/date";

interface ObreiroTithe {
  id: number;
  descricao: string | null;
  valor: string;
  data: string;
  nomeUsuario: string | null;
  nomeCongregacao?: string | null;
  idCongregacao: number;
}

export default function ConsultarObreirosPage() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [idCongregacaoFiltro, setIdCongregacaoFiltro] = useState<number | "">("");
  const [congregacoes, setCongregacoes] = useState<{idCongregacao: number, nome: string}[]>([]);
  
  const [dizimos, setDizimos] = useState<ObreiroTithe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCongregacoes() {
      const res = await listarCongregacoesAction();
      if (res.success) {
        setCongregacoes(res.data as any);
      }
    }
    loadCongregacoes();
  }, []);

  useEffect(() => {
    async function fetchDizimos() {
      setLoading(true);
      try {
        const res = await listarDizimosObreirosGestorAction(
            mes.toString(), 
            ano.toString(), 
            idCongregacaoFiltro === "" ? undefined : Number(idCongregacaoFiltro)
        );
        if (res.success) {
          setDizimos(res.data);
        } else {
          setDizimos([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchDizimos();
  }, [mes, ano, idCongregacaoFiltro]);

  async function handleExcluir(id: number) {
    if (!confirm("Tem certeza que deseja excluir este dízimo de obreiro?")) return;
    
    const res = await excluirMovimentacaoAction(id);
    if (res.success) {
      setDizimos(dizimos.filter((d) => d.id !== id));
      alert("Excluído com sucesso!");
    } else {
      alert("Erro ao excluir: " + res.error);
    }
  }

  function formatBRL(value: string | number) {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return isNaN(num) ? "R$ 0,00" : num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  const totalValor = dizimos.reduce((acc, curr) => acc + parseFloat(curr.valor), 0);

  return (
    <>
      <title>Painel da Convenção - Obreiros</title>
      <div className="min-h-screen bg-slate-50 pb-10">
        <NavBar />
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mt-8 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Link 
                href="/homegestor" 
                className="flex items-center gap-2 text-gray-500 hover:text-purple-600 transition-colors font-medium text-sm"
            >
                <ArrowLeft size={18} />
                Voltar para o Painel do Gestor
            </Link>

            <Link
                href="/obreiros/lancar"
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-5 rounded-xl shadow-sm transition-all text-sm"
            >
                <Plus size={16} />
                Novo Lançamento
            </Link>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Dízimos de Obreiros (Convenção)</h1>
            <p className="text-sm text-gray-500 mb-8">
              Consulte todos os dízimos de obreiros registrados no mês, independentemente da congregação. Estes valores não compõem o saldo das filiais e nem o saldo da Sede.
            </p>

            <div className="flex flex-col md:flex-row gap-6 mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
              <div className="flex-1">
                 <MonthSelector
                    initialMonth={mes}
                    initialYear={ano}
                    onChange={(m, a) => { setMes(m); setAno(a); }}
                 />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Filtrar por Congregação</label>
                <select
                  value={idCongregacaoFiltro}
                  onChange={(e) => setIdCongregacaoFiltro(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="">Todas as Congregações</option>
                  {congregacoes.map(c => (
                      <option key={c.idCongregacao} value={c.idCongregacao}>{c.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-10 text-gray-500">Buscando registros...</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Obreiro</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Congregação de Origem</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Valor</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dizimos.map((d) => (
                      <tr key={d.id} className="hover:bg-purple-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                           {parseDateLocal(d.data).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                           {d.nomeUsuario || "Desconhecido"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                           {d.nomeCongregacao || "Não informada"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                           {formatBRL(d.valor)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                           <button 
                             onClick={() => handleExcluir(d.id)}
                             className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                             title="Excluir lançamento"
                           >
                              <Trash2 size={16} />
                           </button>
                        </td>
                      </tr>
                    ))}
                    {dizimos.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                          Nenhum dízimo de obreiro registrado neste período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {dizimos.length > 0 && (
                     <tfoot className="bg-gray-50">
                        <tr>
                            <td colSpan={3} className="px-6 py-4 text-right text-sm font-bold text-gray-700 uppercase">
                                Total do Mês:
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-bold text-purple-700">
                                {formatBRL(totalValor)}
                            </td>
                            <td></td>
                        </tr>
                     </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
