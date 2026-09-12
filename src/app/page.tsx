"use client"; 
import Link from "next/link";
import Image from "next/image";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");
    const [showSenha, setShowSenha] = useState(false);
    const [erro, setErro] = useState("");
    const [sucesso, setSucesso] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
      const errorParam = searchParams.get("error");
      const successParam = searchParams.get("success");

      if (errorParam === "TokenInvalido") setErro("O link de verificação é inválido.");
      if (errorParam === "TokenInvalidoOuExpirado") setErro("Link inválido ou expirado.");
      if (errorParam === "ErroInterno") setErro("Erro ao verificar email. Tente novamente.");
      if (successParam === "EmailVerificado") setSucesso("Email verificado com sucesso! Você já pode fazer login.");
    }, [searchParams]);
  
    async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password: senha,
      callbackUrl: "/",
    });

    if (res?.error) {
      if (res.status === 429) {
        setErro("Muitas tentativas de login. Aguarde alguns minutos e tente novamente.");
      } else {
        setErro(res.error === "CredentialsSignin" ? "Usuário ou senha incorretos." : res.error);
      }
    } else {
      window.location.href = "/"; // Isso forçará um reload. O ideal seria ter uma página de despache.
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
    <form
        onSubmit={handleSubmit}
        className="bg-white mt-5 shadow-sm rounded-lg p-6 w-96 flex flex-col gap-4"
        >
        <h1 className="font-semibold text-4xl text-center mb-6">Login</h1>
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

        <div className="relative">
            <input
            type={showSenha ? "text" : "password"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
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

        {erro && <span className="text-red-500 text-sm -mt-2 -mb-2">{erro}</span>}
        {sucesso && <span className="text-green-500 text-sm -mt-2 -mb-2">{sucesso}</span>}

        <button
            type="submit"
            className="bg-blue-600 text-white text-xl cursor-pointer py-2 rounded-md hover:bg-blue-700 transition"
        >
            Entrar
        </button>
        <p className="text-center">Não possui uma conta? <Link className="underline" href="/cadastro">Criar</Link></p>
    </form>
  )
}

export default function Home() {


    return (
        <>
          <head>
              <title>Login IEADEL Finance</title>
          </head>
          <div className="flex flex-col items-center w-full mt-8">
              <main className="flex flex-col items-center gap-4">
                  <Image 
                  src="/logo.png"
                  alt="Logo"
                  width={150}
                  height={150}
                  >
                  </Image>
                  <p className="text-xl text-center">ASSEMBLÉIA DE DEUS <br />EL-SHADDAI</p>

                  <Suspense fallback={<div>Carregando...</div>}>
                      <LoginForm />
                  </Suspense>
              </main>
          </div>
        </>
    )
}
