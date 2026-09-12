"use client";
import Image from "next/image";
import Head from "next/head";
import NavBar from "@/components/navbar";
import MonthSelector from "@/components/monthselector";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { calcularTotalGeralAction, calcularTotaisMensaisAction } from "@/actions/movimentacoes";

function ViewCongregacaoContent() {
    const searchParams = useSearchParams();
    const idCongregacao = searchParams.get("id");
    const nomeCongregacao = searchParams.get("nome");

    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [ano, setAno] = useState(new Date().getFullYear());
    const [saldo, setSaldo] = useState(0);
    const [dizimo, setDizimo] = useState(0);
    const [oferta, setOferta] = useState(0);
    const [despesa, setDespesa] = useState(0);

    useEffect(() => {
        if (!idCongregacao) return;

        async function fetchSaldoGeral() {
            try {
                const res = await calcularTotalGeralAction(Number(idCongregacao));
                if (res.success) {
                    setSaldo(Number(res.data.total));
                }
            } catch (err) {
                console.error("Erro ao carregar saldo:", err);
            }
        }

        fetchSaldoGeral();
    }, [idCongregacao]);

    useEffect(() => {
        if (!idCongregacao) return;

        async function fetchTotais() {
            try {
                const res = await calcularTotaisMensaisAction(mes.toString(), ano.toString(), Number(idCongregacao));
                if (res.success) {
                    setDizimo(Number(res.data.dizimo));
                    setOferta(Number(res.data.oferta));
                    setDespesa(Number(res.data.despesa));
                }
            } catch (err) {
                console.error("Erro ao carregar totais:", err);
            }
        }
        fetchTotais();
    }, [mes, ano, idCongregacao]);

    function formatBRL(value: number | string | null) {
        const num =
            value == null
                ? 0
                : typeof value === "string"
                    ? parseFloat(value.replace(/\./g, "").replace(",", "."))
                    : Number(value);
        if (Number.isNaN(num)) return "R$ 0,00";
        return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    if (!idCongregacao) {
        return <div className="p-8 text-center">ID da congregação não fornecido.</div>;
    }

    return (
        <>
            <Head>
                <title>Visualizar {nomeCongregacao}</title>
            </Head>
            <div className="min-h-screen bg-slate-50 pb-10">
                <NavBar />
                
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header com botão voltar */}
                    <div className="mt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <Link 
                            href="/homesuperadmin" 
                            className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors font-medium text-sm"
                        >
                            <ArrowLeft size={18} />
                            Voltar para Gestão Global
                        </Link>
                        <h1 className="flex items-center gap-2 text-gray-500 font-medium text-sm">
                            Congregação: <span className="text-blue-600">{nomeCongregacao}</span>
                        </h1>
                    </div>

                    <div className="mt-8">
                        <MonthSelector
                            initialMonth={mes}
                            initialYear={ano}
                            onChange={(novoMes, novoAno) => {
                                setMes(novoMes);
                                setAno(novoAno);
                            }}
                        />
                    </div>

                    {/* Cards com novo Design */}
                    <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                        {/* Dízimos Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-[#008eff] hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Dízimos</h2>
                                    <p className="mt-2 text-2xl md:text-3xl font-bold text-gray-900">{formatBRL(dizimo)}</p>
                                </div>
                                <div className="p-3 bg-blue-50 rounded-xl">
                                    <Image alt="Dízimos" src="/dizimo.png" width={32} height={32} />
                                </div>
                            </div>
                        </div>

                        {/* Ofertas Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-[#f5dd02] hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Ofertas</h2>
                                    <p className="mt-2 text-2xl md:text-3xl font-bold text-gray-900">{formatBRL(oferta)}</p>
                                </div>
                                <div className="p-3 bg-yellow-50 rounded-xl">
                                    <Image alt="Ofertas" src="/oferta.png" width={32} height={32} />
                                </div>
                            </div>
                        </div>

                        {/* Despesas Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-[#ff2200] hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Despesas</h2>
                                    <p className="mt-2 text-2xl md:text-3xl font-bold text-gray-900">{formatBRL(despesa)}</p>
                                </div>
                                <div className="p-3 bg-red-50 rounded-xl">
                                    <Image alt="Despesas" src="/despesa.png" width={32} height={32} />
                                </div>
                            </div>
                        </div>

                        {/* Saldo Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-[#00cf40] flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Saldo Geral</h2>
                                    <p className="mt-2 text-2xl md:text-3xl font-bold text-[#00cf40]">{formatBRL(saldo)}</p>
                                </div>
                                <div className="p-3 bg-green-50 rounded-xl">
                                    <Image alt="Saldo" src="/saldo.png" width={32} height={32} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 flex justify-center">
                        <Link 
                            href={`/relatorio?mes=${mes}&ano=${ano}&id=${idCongregacao}`} 
                            className="w-full md:w-auto text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 mb-8"
                        >
                            Gerar relatório mensal
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}

export default function ViewCongregacaoPage() {
    return (
        <Suspense fallback={<div>Carregando...</div>}>
            <ViewCongregacaoContent />
        </Suspense>
    );
}
