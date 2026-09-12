"use client";
import Link from "next/link";
import Image from "next/image";
import Head from "next/head";
import NavBar from "@/components/navbar";
import MonthSelector from "@/components/monthselector";
import { calcularTotalGeralAction, calcularTotaisMensaisAction } from "@/actions/movimentacoes";

import { useEffect } from "react";
import { useState } from "react";

export default function HomeAdmin() {
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [ano, setAno] = useState(new Date().getFullYear());
    const [saldo, setSaldo] = useState(0);
    const [dizimo, setDizimo] = useState(0);
    const [oferta, setOferta] = useState(0);
    const [despesa, setDespesa] = useState(0);

    useEffect(() => {
        async function fetchSaldoGeral() {
            try {
                const res = await calcularTotalGeralAction();
                if (res.success) {
                    setSaldo(Number(res.data.total));
                }
            } catch (err) {
                console.error("Erro ao carregar saldo:", err);
            }
        }

        fetchSaldoGeral();
    }, []);

    useEffect(() => {
        async function fetchTotais() {
            try {
                const res = await calcularTotaisMensaisAction(mes.toString(), ano.toString());
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
    }, [mes, ano]);

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

    return (
        <>
            <Head>
                <title>Home</title>
            </Head>
            <div className="min-h-screen bg-slate-50 pb-10">
                <NavBar />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

                    <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                        {/* Dízimos Card */}
                        <Link href="/dizimos" className="group">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-[#008eff] hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Dízimos</h2>
                                        <p className="mt-2 text-2xl md:text-3xl font-bold text-gray-900">{formatBRL(dizimo)}</p>
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
                                        <p className="mt-2 text-2xl md:text-3xl font-bold text-gray-900">{formatBRL(oferta)}</p>
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
                                        <p className="mt-2 text-2xl md:text-3xl font-bold text-gray-900">{formatBRL(despesa)}</p>
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
                                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Saldo Geral</h2>
                                    <p className="mt-2 text-2xl md:text-3xl font-bold text-[#00cf40]">{formatBRL(saldo)}</p>
                                </div>
                                <div className="p-3 bg-green-50 rounded-xl">
                                    <Image alt="Saldo" src="/saldo.png" width={32} height={32} />
                                </div>
                            </div>
                            <div className="mt-4 text-xs text-gray-400">
                                Atualizado em tempo real
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 flex justify-center">
                        <Link 
                            href="/relatorio" 
                            className="w-full md:w-auto text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 mb-8"
                        >
                            Gerar relatório mensal
                        </Link>
                    </div>
                </div>
            </div>
        </>
    )
}
