"use client";
import { useState, useEffect, useCallback } from "react";
import NavBar from "@/components/navbar";
import MonthSelector from "@/components/monthselector";
import { getSessionUserAction } from "@/actions/auth";
import { listarCongregacoesAction } from "@/actions/congregacoes";
import { calcularTotaisMensaisAction } from "@/actions/movimentacoes";
import { fecharCompetenciaGeralAction, reabrirFilialAction } from "@/actions/fechamentos";
import { listarFechamentosAction } from "@/actions/fechamentos";
import { Building2, Lock, LockOpen, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface Congregacao {
  idCongregacao: number;
  nome: string;
}

interface FechamentoRow {
  id: number;
  mes: number;
  ano: number;
  id_congregacao: number;
  status: string;
}

interface CongregacaoResumo {
  idCongregacao: number;
  nome: string;
  status: "ABERTO" | "FECHADO";
  dizimoNormal: number;
  dizimoObreiro: number;
  oferta: number;
  despesa: number;
  repasse10: number;
}

const mesesNomes = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function FechamentoPage() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [user, setUser] = useState<any>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [fechamentos, setFechamentos] = useState<FechamentoRow[]>([]);
  const [resumos, setResumos] = useState<CongregacaoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    getSessionUserAction().then(setUser);
  }, []);

  const carregarDados = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setFeedback(null);
    try {
      // Congregações
      const congRes = await listarCongregacoesAction();
      const congs: Congregacao[] = congRes.success
        ? (congRes.data as unknown as Congregacao[])
        : [];
      setCongregacoes(congs);

      // Fechamentos da competência
      const fechRes = await listarFechamentosAction(mes, ano);
      const fechs: FechamentoRow[] = fechRes.success ? (fechRes.data as FechamentoRow[]) : [];
      setFechamentos(fechs);

      // Para cada congregação, buscar totais
      const resumosTemp: CongregacaoResumo[] = [];
      for (const c of congs) {
        const mesStr = String(mes).padStart(2, "0");
        const anoStr = String(ano);

        const totaisRes = await calcularTotaisMensaisAction(mesStr, anoStr, c.idCongregacao);
        const fech = fechs.find(f => f.id_congregacao === c.idCongregacao);
        const status = fech?.status === "FECHADO" ? "FECHADO" : "ABERTO";

        let dizimoNormal = 0;
        let dizimoObreiro = 0;
        let oferta = 0;
        let despesa = 0;

        if (totaisRes.success) {
          // calcularTotaisMensais already excludes obreiro tithes from dizimo total
          // for branches. We use it directly.
          dizimoNormal = Number(totaisRes.data.dizimo);
          oferta = Number(totaisRes.data.oferta);
          despesa = Number(totaisRes.data.despesa);
        }

        // Calculate 10% on normal tithes (for branches only, not Sede)
        const repasse10 = c.idCongregacao !== 1 ? dizimoNormal * 0.10 : 0;

        resumosTemp.push({
          idCongregacao: c.idCongregacao,
          nome: c.nome,
          status,
          dizimoNormal,
          dizimoObreiro,
          oferta,
          despesa,
          repasse10,
        });
      }
      setResumos(resumosTemp);
    } catch (err) {
      console.error("Erro ao carregar dados de fechamento:", err);
    } finally {
      setLoading(false);
    }
  }, [user, mes, ano]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleFecharGeral = async () => {
    if (actionLoading) return;
    const confirmado = window.confirm(
      `Deseja fechar a competência ${mesesNomes[mes - 1]}/${ano} para TODAS as congregações?\n\nEsta ação irá calcular e lançar os repasses de 10%.`
    );
    if (!confirmado) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fecharCompetenciaGeralAction(mes, ano);
      if (res.success) {
        setFeedback({ type: "success", msg: `Competência ${mesesNomes[mes - 1]}/${ano} fechada com sucesso.` });
        await carregarDados();
      } else {
        setFeedback({ type: "error", msg: res.error });
      }
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Erro ao fechar competência." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReabrir = async (idCongregacao: number, nomeCong: string) => {
    if (actionLoading) return;
    const confirmado = window.confirm(
      `Deseja reabrir a filial "${nomeCong}" na competência ${mesesNomes[mes - 1]}/${ano}?\n\nO repasse de 10% desta filial será desfeito e a Sede também será reaberta.`
    );
    if (!confirmado) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await reabrirFilialAction(mes, ano, idCongregacao);
      if (res.success) {
        setFeedback({ type: "success", msg: `Filial "${nomeCong}" reaberta com sucesso.` });
        await carregarDados();
      } else {
        setFeedback({ type: "error", msg: res.error });
      }
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Erro ao reabrir filial." });
    } finally {
      setActionLoading(false);
    }
  };

  function formatBRL(value: number) {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  // Authorization guard
  if (user && user.perfil !== "GESTOR" && user.perfil !== "SUPER_ADMIN") {
    return (
      <>
        <NavBar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-red-500 font-medium">Acesso negado. Somente GESTOR pode acessar esta tela.</p>
        </div>
      </>
    );
  }

  const todasFechadas = resumos.length > 0 && resumos.every(r => r.status === "FECHADO");
  const algumaAberta = resumos.some(r => r.status === "ABERTO");

  // Separate Sede and branches
  const sede = resumos.find(r => r.idCongregacao === 1);
  const filiais = resumos.filter(r => r.idCongregacao !== 1);

  return (
    <>
      <title>Fechamento Mensal</title>
      <div className="min-h-screen bg-gray-50">
        <NavBar />

        <main className="max-w-7xl mx-auto p-4 md:p-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Fechamento Mensal</h1>
              <p className="text-sm text-gray-500 mt-1">Controle de competência por congregação</p>
            </div>
          </div>

          {/* Month Selector */}
          <div className="mb-6">
            <MonthSelector
              initialMonth={mes}
              initialYear={ano}
              onChange={(novoMes, novoAno) => {
                setMes(novoMes);
                setAno(novoAno);
              }}
            />
          </div>

          {/* Feedback */}
          {feedback && (
            <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
              feedback.type === "success"
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}>
              {feedback.type === "success" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
              <span className="text-sm font-medium">{feedback.msg}</span>
            </div>
          )}

          {/* Action Button */}
          {!loading && algumaAberta && (
            <div className="mb-8 flex justify-center">
              <button
                onClick={handleFecharGeral}
                disabled={actionLoading}
                className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {actionLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Lock size={20} />
                )}
                {actionLoading ? "Processando..." : `Fechar Competência - ${mesesNomes[mes - 1]}/${ano}`}
              </button>
            </div>
          )}

          {todasFechadas && !loading && (
            <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-center gap-3">
              <CheckCircle2 size={20} className="text-green-600" />
              <span className="text-green-800 font-semibold text-sm">
                Todas as congregações estão fechadas para {mesesNomes[mes - 1]}/{ano}.
              </span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              {/* Sede Card */}
              {sede && (
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Building2 size={20} className="text-blue-600" />
                    Sede
                  </h2>
                  <div className={`bg-white rounded-2xl shadow-sm border-l-4 ${
                    sede.status === "FECHADO" ? "border-green-500" : "border-blue-500"
                  } p-6`}>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{sede.nome}</h3>
                        <span className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          sede.status === "FECHADO"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {sede.status === "FECHADO" ? <Lock size={12} /> : <LockOpen size={12} />}
                          {sede.status}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold">Dízimos</p>
                        <p className="text-lg font-bold text-gray-900">{formatBRL(sede.dizimoNormal)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold">Ofertas</p>
                        <p className="text-lg font-bold text-gray-900">{formatBRL(sede.oferta)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold">Despesas</p>
                        <p className="text-lg font-bold text-gray-900">{formatBRL(sede.despesa)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold">Saldo</p>
                        <p className={`text-lg font-bold ${(sede.dizimoNormal + sede.oferta - sede.despesa) >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatBRL(sede.dizimoNormal + sede.oferta - sede.despesa)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Branch Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Building2 size={20} className="text-gray-500" />
                    <h2 className="font-bold text-gray-800">Filiais ({filiais.length})</h2>
                  </div>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b text-left">
                        <th className="px-4 py-3 font-semibold text-gray-600">Congregação</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Dízimos Normais</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Ofertas</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Despesas</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">10% Repasse</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-center">Status</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filiais.map(f => (
                        <tr key={f.idCongregacao} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-800">{f.nome}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatBRL(f.dizimoNormal)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatBRL(f.oferta)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatBRL(f.despesa)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-700">{formatBRL(f.repasse10)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                              f.status === "FECHADO"
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {f.status === "FECHADO" ? <Lock size={10} /> : <LockOpen size={10} />}
                              {f.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {f.status === "FECHADO" && (
                              <button
                                onClick={() => handleReabrir(f.idCongregacao, f.nome)}
                                disabled={actionLoading}
                                className="text-xs font-semibold text-orange-600 hover:text-orange-800 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                              >
                                Reabrir
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filiais.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            Nenhuma filial encontrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y">
                  {filiais.map(f => (
                    <div key={f.idCongregacao} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-800">{f.nome}</h3>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                          f.status === "FECHADO"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {f.status === "FECHADO" ? <Lock size={10} /> : <LockOpen size={10} />}
                          {f.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500 text-xs">Dízimos</span>
                          <p className="font-semibold text-gray-800">{formatBRL(f.dizimoNormal)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Ofertas</span>
                          <p className="font-semibold text-gray-800">{formatBRL(f.oferta)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Despesas</span>
                          <p className="font-semibold text-gray-800">{formatBRL(f.despesa)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">10% Repasse</span>
                          <p className="font-bold text-blue-700">{formatBRL(f.repasse10)}</p>
                        </div>
                      </div>
                      {f.status === "FECHADO" && (
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => handleReabrir(f.idCongregacao, f.nome)}
                            disabled={actionLoading}
                            className="text-sm font-semibold text-orange-600 hover:text-orange-800 hover:bg-orange-50 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Reabrir
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
