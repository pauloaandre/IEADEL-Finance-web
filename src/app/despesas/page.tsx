"use client";
import NavBar from "@/components/navbar"
import FormDespesas from "@/components/formdespesas";
import Movimentacoes from "@/components/movimentacoesdespesas";
import type { Despesa } from "@/components/movimentacoesdespesas";
import { useEffect } from "react";
import { useState } from "react";


export default function Despesas() {
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [ano, setAno] = useState(new Date().getFullYear());
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleSuccess = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    return (
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
            <FormDespesas onSuccess={handleSuccess} />
        </div>
    )
}
