"use client"
import MonthSelector from "./monthselector";
import { useState } from "react";
import { useEffect } from "react";
import { parseDateLocal } from "../utils/date";
import { Trash2, Pencil } from "lucide-react";
import DeleteModal from "./deletemodal";
import EditMovimentacaoModal from "./editmovimentacaomodal";
import { listarMovimentacoesAction, excluirMovimentacaoAction } from "@/actions/movimentacoes";

export interface Despesa {
    id: number;
    data: string;
    descricao: string;
    valor: number;
    tipo: string;
    idUsuario: string | null;
    nomeUsuario: string | null;
    idCongregacao: number;
    dataRegistro: string | null;
}
interface MonthSelectorProps {
    initialMonth?: number;
    initialYear?: number;
    despesas?: Despesa[];
    refreshTrigger?: number;
    onChange: (month: number, year: number) => void;
}

export default function Movimentacoes({
    initialMonth,
    initialYear,
    despesas,
    refreshTrigger: externalRefreshTrigger,
    onChange
}: MonthSelectorProps) {
    const today = new Date();
    const [mes, setMes] = useState(initialMonth || today.getMonth() + 1);
    const [ano, setAno] = useState(initialYear || today.getFullYear());
    const [despesa, setDespesas] = useState<Despesa[]>(despesas || []);
    const [loading, setLoading] = useState(false);
    const [localRefreshTrigger, setLocalRefreshTrigger] = useState(0);

    // Delete Modal state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Edit Modal state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedDespesa, setSelectedDespesa] = useState<Despesa | null>(null);

    useEffect(() => {
    setDespesas(despesas || []);
    }, [despesas]);

    useEffect(() => {
        async function fetchDespesasPorUsuario() {
            try {
                setLoading(true);
                const mesFormatado = String(mes).padStart(2, "0");
                const res = await listarMovimentacoesAction("DESPESA", mesFormatado, ano.toString());
                if (res.success) {
                    const parsedData = res.data.map(d => ({
                        ...d,
                        valor: Number(d.valor),
                        descricao: d.descricao || ""
                    }));
                    setDespesas(parsedData);
                }
            } catch (err) {
                console.error("Erro ao carregar despesas:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchDespesasPorUsuario()
    }, [mes, ano, localRefreshTrigger, externalRefreshTrigger]);

    const despesasFiltradas = despesa.filter((d) => {
    const data = parseDateLocal(d.data);
    return data.getMonth() + 1 === mes && data.getFullYear() === ano;
    });

    const openDeleteModal = (id: number) => {
        setDeleteId(id);
        setIsDeleteModalOpen(true);
    };

    const openEditModal = (item: Despesa) => {
        setSelectedDespesa(item);
        setIsEditModalOpen(true);
    };

    const handleDelete = async () => {
        if (deleteId === null) return;

        try {
            setIsDeleting(true);
            const res = await excluirMovimentacaoAction(deleteId);

            if (res.success) {
                setLocalRefreshTrigger((prev) => prev + 1);
            } else {
                alert(`Erro ao excluir: ${res.error}`);
            }
        } catch (error) {
            console.error("Erro ao excluir despesa:", error);
            alert("Erro ao conectar com o servidor.");
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
            setDeleteId(null);
        }
    };

    return (
        <>
            <MonthSelector
                initialMonth={mes}
                initialYear={ano}
                onChange={(novoMes, novoAno) => {
                setMes(novoMes);
                setAno(novoAno);
                }}
            />
            <div className="flex justify-center mb-8">      
                <div className="md:w-3/4 m-2 md:mt-10 mt-16 shadow-lg rounded-lg overflow-x-auto">
                    <table className="w-full table-fixed border-collapse text-center">
                        <thead className="bg-black text-white">
                        <tr>    
                            <th className="px-4 py-2 border w-1/7">Dia</th>
                            <th className="px-4 py-2 border w-1/4">Descrição</th>
                            <th className="px-4 py-2 border w-1/4">Valor</th>
                            <th className="px-4 py-2 border w-1/6">Ações</th>
                        </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-6 text-center">
                                        Carregando despesas...
                                    </td>
                                </tr>
                            ) : despesasFiltradas.length > 0 ? (
                            despesasFiltradas.map((despesa) => (
                            <tr key={despesa.id} className="bg-white hover:bg-gray-100">
                                <td className="px-4 py-2 border">{String(parseDateLocal(despesa.data).getDate()).padStart(2, "0")}</td>
                                <td className="px-4 py-2 border">{despesa.descricao}</td>
                                <td className="px-4 py-2 border">R$ {despesa.valor.toFixed(2).replace(".", ",")}</td>
                                <td className="px-4 py-2 border text-center">
                                    <div className="flex justify-center gap-2">
                                        <button
                                            onClick={() => openEditModal(despesa)}
                                            className="text-blue-500 hover:text-blue-700 transition-colors p-1 rounded-full hover:bg-blue-50"
                                            title="Editar"
                                        >
                                            <Pencil size={20} />
                                        </button>
                                        <button
                                            onClick={() => openDeleteModal(despesa.id)}
                                            className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-full hover:bg-red-50"
                                            title="Excluir"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) 
                        ) : (
                            <tr>
                                <td colSpan={4} className="px-4 py-2 border text-center">Nenhuma despesa encontrada.</td>
                            </tr>
                        )}

                        </tbody>
                    </table>
                </div>
            </div>

            <DeleteModal 
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                loading={isDeleting}
                title="Excluir Despesa"
                message="Tem certeza que deseja excluir esta despesa? Esta ação é irreversível."
            />

            <EditMovimentacaoModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={() => setLocalRefreshTrigger(prev => prev + 1)}
                item={selectedDespesa}
                tipo="DESPESA"
            />
        </>
    )
}
