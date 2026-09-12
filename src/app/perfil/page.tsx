"use client";

import { useSession } from "next-auth/react";
import NavBar from "@/components/navbar";
import Head from "next/head";

export default function PerfilPage() {
    const { data: session } = useSession();
    const user = session?.user;

    if (!user) return <div className="p-8 text-center">Carregando...</div>;

    return (
        <>
            <Head>
                <title>Meu Perfil</title>
            </Head>
            <NavBar />
            <div className="flex flex-col items-center justify-center mt-10 px-4">
                <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md border border-gray-200">
                    <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Meu Perfil</h1>
                    
                    <div className="space-y-4">
                        <div className="border-b pb-2">
                            <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Nome</label>
                            <p className="text-lg text-gray-800 font-medium">{user.nome}</p>
                        </div>
                        
                        <div className="border-b pb-2">
                            <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Email</label>
                            <p className="text-lg text-gray-800 font-medium">{user.email}</p>
                        </div>

                        <div className="border-b pb-2">
                            <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Perfil</label>
                            <p className="text-lg text-gray-800 font-medium">{user.perfil}</p>
                        </div>

                        {(user.congregacaoNome || user.congregacaoId) && (
                            <div className="border-b pb-2">
                                <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Congregação</label>
                                <p className="text-lg text-gray-800 font-medium">{user.congregacaoNome || user.congregacaoId}</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 flex justify-center">
                        <button 
                            onClick={() => window.history.back()}
                            className="bg-gray-800 text-white px-6 py-2 rounded-md hover:bg-gray-700 transition duration-200 font-semibold"
                        >
                            Voltar
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
