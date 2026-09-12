"use client"
import NavBar from "@/components/navbar"
import Movimentacoes, { Oferta } from "@/components/movimentacoesofertas"
import FormOfertas from "@/components/formofertas"
import { useState } from "react"
import { useEffect } from "react"


export default function Ofertas() {
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [ano, setAno] = useState(new Date().getFullYear());
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleSuccess = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <>
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
                <FormOfertas onSuccess={handleSuccess} />
            </div>
        </>
    )
}
