"use client"; 
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { getSessionUserAction } from "@/actions/auth";
import { User, LogOut, ChevronDown, LayoutDashboard, ReceiptText, Wallet, Landmark, FileText } from "lucide-react";

export default function NavBar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [nome, setNome] = useState("");
    const [perfil, setPerfil] = useState("");
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        getSessionUserAction().then((user) => {
            if (user) {
                const nomeCompleto = (user.nome || "").split(" ");
                const primeirosNomes = nomeCompleto.slice(0, 2).join(" ");
                setNome(primeirosNomes);
                setPerfil(user.perfil || "");
            }
        });
    }, []);

    async function handleLogout() {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/");
        router.refresh();
    }

    const homeHref = perfil === "SUPER_ADMIN" ? "/homesuperadmin" : (perfil === "ADMIN" ? "/homeadmin" : (perfil === "USER" ? "/homeuser" : "/"));

    return (
        <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
            <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16 md:h-20">
                    <Link href={homeHref} className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                        <Image 
                            src="/logo.png"
                            alt="Logo"
                            width={45}
                            height={45}
                            className="w-auto h-10 md:h-12"
                        />
                    </Link>

                    {pathname === "/homeuser" && (
                        <h1 className="hidden md:block text-gray-500 font-medium text-sm italic">
                            Bem-vindo, {nome || "Visitante"}
                        </h1>
                    )}

                    {/* Botão de Perfil/Menu - Direita como antes */}
                    <div className="relative">
                        <button 
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="flex items-center gap-2 group focus:outline-none"
                        >
                            <div className="p-0.5 rounded-full border-2 border-transparent group-hover:border-blue-100 transition-all">
                                <Image
                                    src="/perfil.png"
                                    alt="Menu"
                                    width={40}
                                    height={40}
                                    className="rounded-full shadow-sm w-9 h-9 md:w-11 md:h-11"
                                />
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isMenuOpen ? "rotate-180" : ""}`} />
                        </button>   

                        {isMenuOpen && (
                            <div className="absolute right-0 mt-3 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl py-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                                {/* Cabeçalho do Usuário */}
                                <div className="px-5 py-3 border-b border-gray-50 mb-2">
                                    <p className="text-sm font-bold text-gray-900 truncate">{nome || "Visitante"}</p>
                                    <p className="text-[10px] uppercase font-bold text-blue-600 tracking-widest">{perfil.replace("_", " ")}</p>
                                </div>

                                {/* Navegação Simplificada */}
                                <div className="px-2 space-y-0.5">
                                    {perfil !== "USER" && (
                                        <Link 
                                            href={homeHref}
                                            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-slate-50 rounded-lg transition-colors"
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            <LayoutDashboard className="w-4 h-4 text-gray-400" />
                                            Dashboard
                                        </Link>
                                    )}
                                    
                                    {perfil !== "SUPER_ADMIN" && perfil !== "USER" && (
                                        <Link 
                                            href="/homeuser" 
                                            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-slate-50 rounded-lg transition-colors"
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            <Wallet className="w-4 h-4 text-gray-400" />
                                            Meus Dízimos
                                        </Link>
                                    )}

                                    <Link 
                                        href="/perfil" 
                                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-slate-50 rounded-lg transition-colors"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        <User className="w-4 h-4 text-gray-400" />
                                        Meu Perfil
                                    </Link>
                                </div>

                                <div className="my-2 border-t border-gray-50"></div>

                                {/* Ação de Saída */}
                                <div className="px-2">
                                    <button 
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Sair da conta
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    )
}
