"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { atualizarMovimentacaoAction } from "@/actions/movimentacoes";

interface Movimentacao {
  id: number;
  descricao: string;
  data: string;
  valor: number;
}

interface EditMovimentacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: Movimentacao | null;
  tipo: "OFERTA" | "DESPESA";
}

export default function EditMovimentacaoModal({ isOpen, onClose, onSuccess, item, tipo }: EditMovimentacaoModalProps) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setDescricao(item.descricao);
      setValor(item.valor.toString());
      // A data vem do banco no formato YYYY-MM-DD agora, mas vamos garantir
      const dateStr = item.data.includes("T") ? item.data.split("T")[0] : item.data;
      setData(dateStr);
    }
  }, [item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;

    try {
      setLoading(true);
      const payload = {
        descricao,
        valor: Number(valor) || 0,
        data,
        usuarioId: undefined,
        tipo: tipo as "OFERTA" | "DESPESA",
        isVisitante: true,
      };

      const res = await atualizarMovimentacaoAction(item.id, payload);

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        alert(`Erro ao atualizar: ${res.error}`);
      }
    } catch (error) {
      console.error(`Erro ao atualizar ${tipo.toLowerCase()}:`, error);
      alert("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const title = tipo === "OFERTA" ? "Editar Oferta" : "Editar Despesa";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Digite a descrição"
              className="border p-2 w-full rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              rows={2}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
            <input
              type="number"
              value={valor}
              inputMode="decimal"
              step="0.01"
              placeholder="0,00"
              onChange={(e) => setValor(e.target.value)}
              className="border p-2 w-full rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="border p-2 w-full rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 ${
                tipo === "OFERTA" ? "bg-yellow-600 hover:bg-yellow-700" : "bg-red-600 hover:bg-red-700"
              }`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
