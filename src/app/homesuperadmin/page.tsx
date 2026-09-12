"use client";
import { useEffect, useState } from "react";
import NavBar from "@/components/navbar";
import Head from "next/head";
import Link from "next/link";
import { Users, Building2, UserPlus, CheckCircle2, Plus, ArrowDownCircle } from "lucide-react";
import { listarUsuariosAction, atualizarUsuarioAction } from "@/actions/usuarios";
import { listarCongregacoesAction, criarCongregacaoAction } from "@/actions/congregacoes";

interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: string;
  nomeCongregacao: string;
}

interface Congregacao {
  idCongregacao: number;
  nome: string;
  quantidadeMembros: number;
}

export default function HomeSuperAdmin() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCongModal, setShowNewCongModal] = useState(false);
  const [newCongName, setNewCongName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{id: number, nome: string, perfil: string} | null>(null);
  const [targetPerfil, setTargetPerfil] = useState<string>("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [userRes, congRes] = await Promise.all([
        listarUsuariosAction(),
        listarCongregacoesAction()
      ]);

      if (userRes.success && congRes.success) {
        setUsuarios(userRes.data as unknown as Usuario[]);
        setCongregacoes(congRes.data as unknown as Congregacao[]);
      }
    } catch (error) {
      console.error("Erro ao carregar dados superadmin:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openConfirmModal = (user: Usuario, newPerfil: string) => {
    setSelectedUser({ id: user.id, nome: user.nome, perfil: user.perfil });
    setTargetPerfil(newPerfil);
    setShowConfirmModal(true);
  };

  const handleUpdatePerfil = async () => {
    if (!selectedUser) return;

    try {
      // Usando cast de tipo porque perfil precisa ser "USER" | "ADMIN" | "SUPER_ADMIN"
      const res = await atualizarUsuarioAction(selectedUser.id, { perfil: targetPerfil as any });
      
      if (res.success) {
        setShowConfirmModal(false);
        fetchData();
      } else {
        alert(`Erro ao atualizar perfil: ${res.error}`);
      }
    } catch (error) {
      console.error("Erro ao atualizar:", error);
    }
  };

  const handleCreateCongregacao = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await criarCongregacaoAction({ nome: newCongName });

      if (res.success) {
        setNewCongName("");
        setShowNewCongModal(false);
        fetchData();
      } else {
        alert(`Erro ao criar congregação: ${res.error}`);
      }
    } catch (error) {
      console.error("Erro ao criar congregação:", error);
    }
  };

  const filteredUsers = usuarios.filter(u => 
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingAdmins = usuarios.filter(u => u.perfil === "USER");

  return (
    <>
      <Head>
        <title>Dashboard SuperAdmin</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <NavBar />
        
        <main className="max-w-7xl mx-auto p-4 md:p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Painel de Gestão Global</h1>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
                <Users size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total de Membros</p>
                <p className="text-2xl font-bold">{usuarios.length}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg text-green-600">
                <Building2 size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Congregações</p>
                <p className="text-2xl font-bold">{congregacoes.length}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="bg-yellow-100 p-3 rounded-lg text-yellow-600">
                <UserPlus size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Usuários Comuns</p>
                <p className="text-2xl font-bold">{pendingAdmins.length}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Congregations Section */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                  <h2 className="font-bold text-gray-800">Congregações</h2>
                  <button 
                    onClick={() => setShowNewCongModal(true)}
                    className="text-blue-600 hover:text-blue-800 p-1"
                    title="Nova Congregação"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="divide-y max-h-[400px] overflow-y-auto">
                  {congregacoes.map(cong => (
                    <Link href={`/homesuperadmin/view?id=${cong.idCongregacao}&nome=${cong.nome}`} key={cong.idCongregacao} className="block">
                      <div className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-700">{cong.nome}</span>
                          <span className="text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-600">
                            {cong.quantidadeMembros} membros
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {congregacoes.length === 0 && (
                    <p className="p-4 text-center text-gray-500">Nenhuma congregação cadastrada.</p>
                  )}
                </div>
              </div>
            </div>

            {/* User Management Section */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                  <h2 className="font-bold text-gray-800">Gestão de Usuários</h2>
                  <input 
                    type="text"
                    placeholder="Buscar por nome ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border px-3 py-1.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Nome / Email</th>
                        <th className="px-6 py-3 font-semibold">Congregação</th>
                        <th className="px-6 py-3 font-semibold">Perfil</th>
                        <th className="px-6 py-3 font-semibold text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                      {filteredUsers.map(user => (
                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{user.nome}</div>
                            <div className="text-gray-500 text-xs">{user.email}</div>
                          </td>
                          <td className="px-6 py-4 text-gray-600">{user.nomeCongregacao}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                              user.perfil === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                              user.perfil === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {user.perfil}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {user.perfil === 'USER' && (
                              <button 
                                onClick={() => openConfirmModal(user, "ADMIN")}
                                className="text-green-600 hover:text-green-800 flex items-center gap-1 mx-auto font-medium"
                                title="Promover como Admin"
                              >
                                <CheckCircle2 size={18} />
                                <span>Promover Admin</span>
                              </button>
                            )}
                            {user.perfil === 'ADMIN' && (
                              <button 
                                onClick={() => openConfirmModal(user, "USER")}
                                className="text-red-600 hover:text-red-800 flex items-center gap-1 mx-auto font-medium"
                                title="Rebaixar para User"
                              >
                                <ArrowDownCircle size={18} />
                                <span>Rebaixar User</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <p className="p-8 text-center text-gray-500">Nenhum usuário encontrado.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Modal de Confirmação de Role */}
        {showConfirmModal && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6">
                <div className={`w-12 h-12 rounded-full mb-4 flex items-center justify-center ${targetPerfil === 'ADMIN' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                   {targetPerfil === 'ADMIN' ? <CheckCircle2 size={24} /> : <ArrowDownCircle size={24} />}
                </div>
                <h2 className="text-xl font-bold mb-2">Confirmar alteração</h2>
                <p className="text-gray-600 mb-6">
                  Deseja realmente {targetPerfil === 'ADMIN' ? 'promover' : 'rebaixar'} o usuário <strong>{selectedUser.nome}</strong> para o perfil <strong>{targetPerfil}</strong>?
                </p>
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setShowConfirmModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleUpdatePerfil}
                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${targetPerfil === 'ADMIN' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal New Congregation */}
        {showNewCongModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4">Nova Congregação</h2>
                <form onSubmit={handleCreateCongregacao} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Congregação</label>
                    <input 
                      type="text"
                      value={newCongName}
                      onChange={(e) => setNewCongName(e.target.value)}
                      placeholder="Ex: Sede Central"
                      className="border p-2 w-full rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setShowNewCongModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                    >
                      Criar Congregação
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
