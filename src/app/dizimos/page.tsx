"use client";
import NavBar from "@/components/navbar"
import FormDizimo from "@/components/formdizimos";
import Movimentacoes from "@/components/movimentacoesdizimos";
import type { Dizimo } from "@/components/movimentacoesdizimos";
import { useEffect } from "react";
import { useState } from "react";

export default function Dizimos() {
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [ano, setAno] = useState(new Date().getFullYear());
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleSuccess = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <>
            <title>Dízimos</title>
            <div>
                <NavBar />
                <Movimentacoes
                    initialMonth={mes}
                    initialYear={ano}
                    refreshTrigger={refreshTrigger}
                    onChange={(novoMes, novoAno) => {
                        setMes(novoMes);
                        setAno(novoAno);
                    }}
                />
                <FormDizimo onSuccess={handleSuccess} />
            </div>
        </>
    )
}
