"use client";
import { useState } from "react";
import { buscarUsuariosPorNomeAction } from "@/actions/usuarios";
import { criarMovimentacaoAction } from "@/actions/movimentacoes";

type Pessoa = { id_usuario: string; nome: string };

interface DizimoModalProps {
  onSuccess?: () => void;
}

export default function FormDizimos({ onSuccess }: DizimoModalProps) {
  const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
  const [isOpen, setIsOpen] = useState(false); 
  const [descricao, setDescricao] = useState("");
  const [id_usuario, setIdUsuario] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [sugestoes, setSugestoes] = useState<Pessoa[]>([]);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const valorInput = e.target.value;
    setDescricao(valorInput);
    setIdUsuario(null);

    if (valorInput.length > 2) {
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
    const payload = {
      descricao,
      valor: Number(valor) || 0,
      data,
      tipo: "DIZIMO" as const,
      isVisitante: id_usuario === null,
      usuarioId: id_usuario ?? undefined,
    };

    console.log("Dízimo enviado:", payload);

    const res = await criarMovimentacaoAction(payload);

    if (res.success) {
        setDescricao("");
        setValor("");
        setData(hoje);
        setSugestoes([]);
        setIdUsuario(null);
        setIsOpen(false);
        if (onSuccess) onSuccess();
    } else {
        alert("Erro ao salvar dízimo: " + res.error);
    }
  }


  return (
    <div className="p-4 flex flex-col items-center">
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded cursor-pointer"
      >
        Adicionar Dízimo
      </button>

      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-xl">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 relative">
            <h2 className="text-xl font-bold mb-4">Novo Dízimo</h2>

            <form onSubmit={handleSubmit} className="space-y-1">
              <div className="relative">
                <input
                  type="text"
                  value={descricao}
                  onChange={handleChange}
                  placeholder="Nome da pessoa"
                  className="border p-2 w-full mb-3"
                  required
                />
                {sugestoes.length > 0 && (
                  <ul className="absolute z-10 bg-white border w-full max-h-40 overflow-y-auto">
                    {sugestoes.map((p) => (
                      <li
                        key={p.id_usuario}
                        onClick={() => handleSelect(p)}
                        className="p-2 hover:bg-gray-200 cursor-pointer"
                      >
                        {p.nome}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <input
                type="number"
                value={valor}
                inputMode="decimal" 
                step="0.01"
                placeholder="R$ 0,00"
                onChange={(e) => setValor(e.target.value)}
                className="border p-2 w-full mb-3"
                required
              />

              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="border p-2 w-full mb-3"
                required
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
