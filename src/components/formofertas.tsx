"use client";
import { useState } from "react";
import { criarMovimentacaoAction } from "@/actions/movimentacoes";

interface OfertaModalProps {
  onSuccess?: () => void;
}

export default function OfertaModal({ onSuccess }: OfertaModalProps) {
  const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
  const [isOpen, setIsOpen] = useState(false);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [descricao, setDescricao] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      descricao: descricao || "",
      valor: Number(valor) || 0,
      data,
      tipo: "OFERTA" as const,
      usuarioId: undefined,
      isVisitante: true,
    };

    console.log("Oferta enviada:", payload);

    const res = await criarMovimentacaoAction(payload);

    if (res.success) {
        setValor("");
        setData(hoje);
        setDescricao("");
        setIsOpen(false);
        if (onSuccess) onSuccess();
    } else {
        alert("Erro ao salvar oferta: " + res.error);
    }
  }

  return (
    <div className="p-4 flex flex-col items-center">
      <button
        onClick={() => setIsOpen(true)}
        className="bg-yellow-500 text-white px-4 py-2 rounded cursor-pointer"
      >
        Adicionar Oferta
      </button>

      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-xl">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 relative">
            <h2 className="text-xl font-bold mb-4">Nova oferta</h2>

            <form onSubmit={handleSubmit}>
                <textarea
                value={descricao}
                placeholder="Digite a descrição"
                onChange={(e) => setDescricao(e.target.value)}
                className="border p-2 w-full mb-2"
                rows={2}
              />

              <input
                type="number"
                value={valor}
                inputMode="decimal" 
                step="0.01"
                placeholder="R$ 0,00"
                onChange={(e) => setValor(e.target.value)}
                className="border p-2 w-full mb-3"
              />

              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="border p-2 w-full mb-3"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="bg-red-600 text-white px-4 py-2 rounded cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
