"use client"
import MonthSelector from "./monthselector";
import { useState } from "react";
import { useEffect } from "react";
import { parseDateLocal } from "../utils/date";
import { Trash2, Pencil } from "lucide-react";
import DeleteModal from "./deletemodal";
import EditMovimentacaoModal from "./editmovimentacaomodal";
import { listarMovimentacoesAction, excluirMovimentacaoAction } from "@/actions/movimentacoes";

export interface Oferta {
    id: number;
    data: string;
    descricao: string;
    valor: number;
    tipo: string;
    idUsuario: number | null;
    nomeUsuario: string | null;
    idCongregacao: number;
    dataRegistro: string;
}
interface MonthSelectorProps {
    initialMonth?: number;
    initialYear?: number;
    ofertas?: Oferta[];
    refreshTrigger?: number;
    onChange: (month: number, year: number) => void;
}

export default function Movimentacoes({
    initialMonth,
    initialYear,
    ofertas,
    refreshTrigger: externalRefreshTrigger,
    onChange
}: MonthSelectorProps) {
    const today = new Date();
    const [mes, setMes] = useState(initialMonth || today.getMonth() + 1);
    const [ano, setAno] = useState(initialYear || today.getFullYear());
    const [oferta, setOfertas] = useState<Oferta[]>(ofertas || []);
    const [loading, setLoading] = useState(false);
    const [localRefreshTrigger, setLocalRefreshTrigger] = useState(0);

    // Delete Modal state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Edit Modal state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedOferta, setSelectedOferta] = useState<Oferta | null>(null);

    useEffect(() => {
    setOfertas(ofertas || []);
    }, [ofertas]);

    useEffect(() => {
        async function fetchOfertasPorUsuario() {
            try {
                setLoading(true);
                const mesFormatado = String(mes).padStart(2, "0");
                const res = await listarMovimentacoesAction("OFERTA", mesFormatado, ano.toString());
                if (res.success) {
                    const parsedData = res.data.map(d => ({
                        ...d,
                        valor: Number(d.valor)
                    }));
                    setOfertas(parsedData);
                }
            } catch (err) {
                console.error("Erro ao carregar ofertas:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchOfertasPorUsuario()
    }, [mes, ano, localRefreshTrigger, externalRefreshTrigger]);

    const ofertasFiltradas = oferta.filter((d) => {
    const data = parseDateLocal(d.data);
    return data.getMonth() + 1 === mes && data.getFullYear() === ano;
    });

    const openDeleteModal = (id: number) => {
        setDeleteId(id);
        setIsDeleteModalOpen(true);
    };

    const openEditModal = (item: Oferta) => {
        setSelectedOferta(item);
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
            console.error("Erro ao excluir oferta:", error);
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
                                        Carregando ofertas...
                                    </td>
                                </tr>
                            ) : ofertasFiltradas.length > 0 ? (
                        ofertasFiltradas.map((oferta) => (
                            <tr key={oferta.id} className="bg-white hover:bg-gray-100">
                                <td className="px-4 py-2 border">{String(parseDateLocal(oferta.data).getDate()).padStart(2, "0")}</td>
                                <td className="px-4 py-2 border">{oferta.descricao}</td>
                                <td className="px-4 py-2 border">R$ {oferta.valor.toFixed(2).replace(".", ",")}</td>
                                <td className="px-4 py-2 border text-center">
                                    <div className="flex justify-center gap-2">
                                        <button
                                            onClick={() => openEditModal(oferta)}
                                            className="text-blue-500 hover:text-blue-700 transition-colors p-1 rounded-full hover:bg-blue-50"
                                            title="Editar"
                                        >
                                            <Pencil size={20} />
                                        </button>
                                        <button
                                            onClick={() => openDeleteModal(oferta.id)}
                                            className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-full hover:bg-red-50"
                                            title="Excluir"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))) : (
                            <tr>
                                <td colSpan={4} className="px-4 py-2 border text-center">Nenhuma oferta encontrada.</td>
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
                title="Excluir Oferta"
                message="Tem certeza que deseja excluir esta oferta? Esta ação é irreversível."
            />

            <EditMovimentacaoModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={() => setLocalRefreshTrigger(prev => prev + 1)}
                item={selectedOferta}
                tipo="OFERTA"
            />
        </>
    )
}
