"use client"; 
import Link from "next/link";
import Image from "next/image";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { listarCongregacoesAction } from "@/actions/congregacoes";
import { cadastrarUsuarioAction } from "@/actions/cadastro";

interface Congregacao {
    idCongregacao: number;
    nome: string;
}

export default function CadastroPage() {
    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");
    const [showSenha, setShowSenha] = useState(false);
    const [nome, setNome] = useState("");
    const [erro, setErro] = useState("");
    const [sucesso, setSucesso] = useState(false);
    const router = useRouter();

    const [opcoes, setOpcoes] = useState<Congregacao[]>([]);
    const [idCongregacao, setIdCongregacao] = useState("");

    useEffect(() => {
        async function fetchCongregacoes() {
            try {
                const res = await listarCongregacoesAction();
                if (res.success) {
                    const congregacoesOrdenadas = res.data.sort(
                        (a: Congregacao, b: Congregacao) => a.idCongregacao - b.idCongregacao
                    );
                    setOpcoes(congregacoesOrdenadas);
                }
            } catch (err) {
                console.error("Erro ao carregar congregações:", err);
            }
        }

        fetchCongregacoes();
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErro("");

        // Formata o nome para Capitalize (Primeira Letra de Cada Nome Maiúscula)
        const nomeFormatado = nome
            .toLowerCase()
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

        const res = await cadastrarUsuarioAction({
            nome: nomeFormatado,
            email,
            senha,
            idCongregacao,
        });

        if (res.success) {
            setSucesso(true);
            setTimeout(() => {
              router.push("/");
            }, 5000);
        } else {
            setErro(res.error);
        }
    }

    useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        const botao = document.querySelector<HTMLButtonElement>(
          "button[type='submit'], button.salvar"
        );
        if (botao) botao.click();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

    return (
        <>
            <title>Cadastro IEADEL Finance</title>
            <div className="flex flex-col items-center w-full mt-4">
                <main className="flex flex-col items-center gap-6">
                    <Image 
                    src="/logo.png"
                    alt="Logo"
                    width={90}
                    height={90}
                    >
                    </Image>
                    <p className="text-xl text-center">ASSEMBLÉIA DE DEUS <br />EL-SHADDAI</p>

                    <form
                        onSubmit={handleSubmit}
                        className="bg-white mt-4 shadow-sm rounded-lg p-6 w-96 flex flex-col gap-4"
                        >
                        <h1 className="font-semibold text-4xl text-center mb-6">Cadastro</h1>
                        <div>
                            <input
                            type="name"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            placeholder="Seu nome"
                            className="w-full capitalize p-2 border text-xl placeholder-[#383838] ring-[#6d6d6d] ring-1 rounded-md focus:ring-2 focus:ring-blue-500"
                            required
                            />
                        </div>

                        <div>
                            <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                            className="w-full p-2 border text-xl placeholder-[#383838] ring-[#6d6d6d] ring-1 rounded-md focus:ring-2 focus:ring-blue-500"
                            required
                            />
                        </div>

                        {erro && !sucesso && <span className="text-red-500 text-sm -mt-2 -mb-2">{erro}</span>}
                        {sucesso && <span className="text-green-500 text-sm font-semibold -mt-2 -mb-2 text-center">Cadastro realizado com sucesso! Você será redirecionado para o login.</span>}

                        <div>
                            <select
                                value={idCongregacao}
                                onChange={(e) => setIdCongregacao(e.target.value)}
                                className="w-full p-2 border text-xl text-[#383838] ring-[#6d6d6d] ring-1 rounded-md focus:ring-2 focus:ring-blue-500"
                                required
                                >
                                <option value="" disabled>Selecione</option>
                                {opcoes.map((item) => (
                                    <option className="text-sm" key={item.idCongregacao} value={item.idCongregacao}>
                                    {item.nome} 
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="relative">
                            <input
                            type={showSenha ? "text" : "password"}
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                            placeholder="Criar senha"
                            className="w-full p-2 border text-xl placeholder-[#383838] rounded-md ring-[#6d6d6d] ring-1 focus:ring-2 focus:ring-blue-500"
                            required
                            />
                            <button
                                type="button"
                                onClick={() => setShowSenha(!showSenha)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                {showSenha ? <EyeOff size={24} /> : <Eye size={24} />}
                            </button>
                        </div>

                        <button
                            type="submit"
                            className="bg-blue-600 text-white text-xl cursor-pointer py-2 rounded-md hover:bg-blue-700 transition"
                        >
                            Criar conta
                        </button>
                        <p className="text-center">Já possui uma conta? <Link className="underline" href="/">Login</Link></p>
                    </form>
                </main>
            </div>
        </>
    )
}
