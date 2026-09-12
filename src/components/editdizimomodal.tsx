"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Dizimo } from "./movimentacoesdizimos";
import { buscarUsuariosPorNomeAction } from "@/actions/usuarios";
import { atualizarMovimentacaoAction } from "@/actions/movimentacoes";

type Pessoa = { id_usuario: number; nome: string };

interface EditDizimoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  dizimo: Dizimo | null;
}

export default function EditDizimoModal({ isOpen, onClose, onSuccess, dizimo }: EditDizimoModalProps) {
  const [descricao, setDescricao] = useState("");
  const [id_usuario, setIdUsuario] = useState<number | null>(null);
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [sugestoes, setSugestoes] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dizimo) {
      setDescricao(dizimo.nomeUsuario || dizimo.descricao);
      setIdUsuario(dizimo.idUsuario);
      setValor(dizimo.valor.toString());
      // A data vem do banco no formato YYYY-MM-DD agora, mas vamos garantir
      const dateStr = dizimo.data.includes("T") ? dizimo.data.split("T")[0] : dizimo.data;
      setData(dateStr);
    }
  }, [dizimo]);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const valorInput = e.target.value;
    setDescricao(valorInput);
    setIdUsuario(null);

    if (valorInput.length > 1) {
      const res = await buscarUsuariosPorNomeAction(valorInput);
      if (res.success) {
          const mapped = res.data.map(u => ({ id_usuario: u.id, nome: u.nome }));
          setSugestoes(mapped);
      } else {
          setSugestoes([]);
      }
    } else {
      setSugestoes([]);
    }
  }

  function handleSelect(pessoa: Pessoa) {
    setDescricao(pessoa.nome);
    setIdUsuario(pessoa.id_usuario);
    setSugestoes([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dizimo) return;

    try {
      setLoading(true);
      const payload = {
        descricao,
        valor: Number(valor) || 0,
        data,
        usuarioId: id_usuario ?? undefined,
        tipo: "DIZIMO" as const,
        isVisitante: id_usuario === null,
      };

      const res = await atualizarMovimentacaoAction(dizimo.id, payload);

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        alert(`Erro ao atualizar: ${res.error}`);
      }
    } catch (error) {
      console.error("Erro ao atualizar dízimo:", error);
      alert("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">Editar Dízimo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Pessoa</label>
            <input
              type="text"
              value={descricao}
              onChange={handleChange}
              placeholder="Nome da pessoa"
              className="border p-2 w-full rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
            {sugestoes.length > 0 && (
              <ul className="absolute z-10 bg-white border w-full max-h-40 overflow-y-auto shadow-lg rounded-b-lg">
                {sugestoes.map((p) => (
                  <li
                    key={p.id_usuario}
                    onClick={() => handleSelect(p)}
                    className="p-2 hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    {p.nome}
                  </li>
                ))}
              </ul>
            )}
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
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
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
