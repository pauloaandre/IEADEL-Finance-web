"use client";
import { useEffect, useState } from "react";
import NavBar from "@/components/navbar";
import Link from "next/link";
import Image from "next/image";
import { Building2, TrendingUp, Eye, Lock, BookOpen, Landmark, Users, ChevronRight } from "lucide-react";
import { listarCongregacoesAction } from "@/actions/congregacoes";
import { calcularTotalGeralAction, calcularTotaisMensaisAction } from "@/actions/movimentacoes";
import MonthSelector from "@/components/monthselector";

interface Congregacao {
  idCongregacao: number;
  nome: string;
  quantidadeMembros?: number;
}

export default function HomeGestor() {
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());

  // Totais da Sede (congregação 1)
  const [saldoSede, setSaldoSede] = useState(0);
  const [dizimoSede, setDizimoSede] = useState(0);
  const [ofertaSede, setOfertaSede] = useState(0);
  const [despesaSede, setDespesaSede] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const congRes = await listarCongregacoesAction();
        if (congRes.success) {
          setCongregacoes(congRes.data as unknown as Congregacao[]);
        }
      } catch (error) {
        console.error("Erro ao carregar dados do gestor:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Saldo da Sede
  useEffect(() => {
    async function fetchSaldo() {
      try {
        const res = await calcularTotalGeralAction(1);
        if (res.success) {
          setSaldoSede(Number(res.data.total));
        }
      } catch (err) {
        console.error("Erro ao carregar saldo da Sede:", err);
      }
    }
    fetchSaldo();
  }, []);

  // Totais mensais da Sede
  useEffect(() => {
    async function fetchTotais() {
      try {
        const res = await calcularTotaisMensaisAction(mes.toString(), ano.toString(), 1);
        if (res.success) {
          setDizimoSede(Number(res.data.dizimo));
          setOfertaSede(Number(res.data.oferta));
          setDespesaSede(Number(res.data.despesa));
        }
      } catch (err) {
        console.error("Erro ao carregar totais:", err);
      }
    }
    fetchTotais();
  }, [mes, ano]);

  function formatBRL(value: number) {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  const mesesNomes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const filiais = congregacoes.filter(c => c.idCongregacao !== 1);

  if (loading) {
    return (
      <>
        <NavBar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-500">Carregando dados...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <title>Dashboard Gestor</title>
      <div className="min-h-screen bg-gray-50">
        <NavBar />

        <main className="max-w-7xl mx-auto p-4 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Painel do Gestor</h1>
              <p className="text-sm text-gray-500 mt-1">Gestão financeira, obreiros e acompanhamento das congregações</p>
            </div>
          </div>

          {/* Seletor de Mês */}
          <div className="mb-8">
            <MonthSelector
              initialMonth={mes}
              initialYear={ano}
              onChange={(novoMes, novoAno) => {
                setMes(novoMes);
                setAno(novoAno);
              }}
            />
          </div>

          {/* ========================================================= */}
          {/* SEÇÃO 1 — SEDE */}
          {/* ========================================================= */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Landmark size={22} className="text-blue-600" />
              <h2 className="text-xl font-bold text-gray-800">Sede</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {/* Dízimos Card */}
              <Link href="/dizimos" className="group">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-[#008eff] hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                          <div>
                              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Dízimos</h2>
                              <p className="mt-2 text-2xl md:text-3xl font-bold text-gray-900">{formatBRL(dizimoSede)}</p>
                          </div>
                          <div className="p-3 bg-blue-50 rounded-xl group-hover:scale-110 transition-transform duration-200">
                              <Image alt="Dízimos" src="/dizimo.png" width={32} height={32} />
                          </div>
                      </div>
                      <div className="mt-4 flex items-center text-sm text-blue-600 font-medium">
                          Ver detalhes
                          <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 5l7 7-7 7" />
                          </svg>
                      </div>
                  </div>
              </Link>

              {/* Ofertas Card */}
              <Link href="/ofertas" className="group">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-[#f5dd02] hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                          <div>
                              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Ofertas</h2>
                              <p className="mt-2 text-2xl md:text-3xl font-bold text-gray-900">{formatBRL(ofertaSede)}</p>
                          </div>
                          <div className="p-3 bg-yellow-50 rounded-xl group-hover:scale-110 transition-transform duration-200">
                              <Image alt="Ofertas" src="/oferta.png" width={32} height={32} />
                          </div>
                      </div>
                      <div className="mt-4 flex items-center text-sm text-yellow-600 font-medium">
                          Ver detalhes
                          <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 5l7 7-7 7" />
                          </svg>
                      </div>
                  </div>
              </Link>

              {/* Despesas Card */}
              <Link href="/despesas" className="group">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-[#ff2200] hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                          <div>
                              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Despesas</h2>
                              <p className="mt-2 text-2xl md:text-3xl font-bold text-gray-900">{formatBRL(despesaSede)}</p>
                          </div>
                          <div className="p-3 bg-red-50 rounded-xl group-hover:scale-110 transition-transform duration-200">
                              <Image alt="Despesas" src="/despesa.png" width={32} height={32} />
                          </div>
                      </div>
                      <div className="mt-4 flex items-center text-sm text-red-600 font-medium">
                          Ver detalhes
                          <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 5l7 7-7 7" />
                          </svg>
                      </div>
                  </div>
              </Link>

              {/* Saldo Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-[#00cf40] h-full flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                      <div>
                          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Saldo Sede</h2>
                          <p className={`mt-2 text-2xl md:text-3xl font-bold ${saldoSede >= 0 ? "text-[#00cf40]" : "text-red-500"}`}>
                            {formatBRL(saldoSede)}
                          </p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-xl">
                          <Image alt="Saldo" src="/saldo.png" width={32} height={32} />
                      </div>
                  </div>
                  <div className="mt-4 text-xs text-gray-400">
                      Acumulado total
                  </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/relatorio?id=1`}
                className="flex items-center gap-2 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 font-medium py-2.5 px-5 rounded-xl shadow-sm transition-all text-sm"
              >
                <TrendingUp size={16} className="text-blue-500" />
                Relatório da Sede
              </Link>
              <Link
                href="/fechamento"
                className="flex items-center gap-2 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 font-medium py-2.5 px-5 rounded-xl shadow-sm transition-all text-sm"
              >
                <Lock size={16} className="text-blue-500" />
                Fechamento
              </Link>
            </div>
          </section>

          {/* ========================================================= */}
          {/* SEÇÃO 2 — CONVENÇÃO */}
          {/* ========================================================= */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Users size={22} className="text-purple-600" />
              <h2 className="text-xl font-bold text-gray-800">Convenção</h2>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm text-gray-500 mb-4">Registros de dízimos de obreiros destinados à Convenção.</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/obreiros/lancar"
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-5 rounded-xl shadow-sm transition-all text-sm"
                >
                  <BookOpen size={16} />
                  Registrar Dízimo de Obreiro
                </Link>
                <Link
                  href="/obreiros"
                  className="flex items-center gap-2 bg-white border border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700 font-medium py-2.5 px-5 rounded-xl shadow-sm transition-all text-sm"
                >
                  <Eye size={16} className="text-purple-500" />
                  Consultar Dízimos de Obreiros
                </Link>
              </div>
            </div>
          </section>

          {/* ========================================================= */}
          {/* SEÇÃO 3 — CONGREGAÇÕES */}
          {/* ========================================================= */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={22} className="text-gray-600" />
              <h2 className="text-xl font-bold text-gray-800">Congregações ({filiais.length})</h2>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="divide-y">
                {filiais.map(cong => (
                  <Link
                    href={`/homegestor/view?id=${cong.idCongregacao}&nome=${encodeURIComponent(cong.nome)}`}
                    key={cong.idCongregacao}
                    className="block"
                  >
                    <div className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center">
                      <div>
                        <span className="font-medium text-gray-700">{cong.nome}</span>
                        {cong.quantidadeMembros !== undefined && (
                          <span className="ml-3 text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-600">
                            {cong.quantidadeMembros} membros
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                        <Eye size={16} />
                        <span className="hidden md:inline">Visualizar</span>
                        <ChevronRight size={16} className="text-gray-400" />
                      </div>
                    </div>
                  </Link>
                ))}
                {filiais.length === 0 && (
                  <p className="p-8 text-center text-gray-500">Nenhuma filial encontrada.</p>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
