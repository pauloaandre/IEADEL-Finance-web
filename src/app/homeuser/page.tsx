"use client";
import NavBar from "@/components/navbar";
import YearSelector from "@/components/yearselector";
import { useState, useEffect } from "react";
import { parseDateLocal } from "@/utils/date";
import { getSessionUserAction } from "@/actions/auth";
import { listarMovimentacoesPorUsuarioAction } from "@/actions/movimentacoes";

export default function HomeUser() {
  interface Dizimo {
  id: string | number;
  data: string;
  valor: number;
  }
    const [ano, setAno] = useState(new Date().getFullYear());
	const [dizimos, setDizimos] = useState<Dizimo[]>([]);
	const [loading, setLoading] = useState(false);
	const [user, setUser] = useState<any>(null);
	const meses = [
		"Janeiro",
		"Fevereiro",
		"Março",
		"Abril",
		"Maio",
		"Junho",
		"Julho",
		"Agosto",
		"Setembro",
		"Outubro",
		"Novembro",
		"Dezembro",
	];

	useEffect(() => {
		getSessionUserAction().then(setUser);
	}, []);

	useEffect(() => {
		async function fetchDizimosPorUsuario() {
			try {
				setLoading(true);
				if (!user?.id) return;

				const res = await listarMovimentacoesPorUsuarioAction(user.id);
				if (res.success) {
					// Mapeia valor string para number
					const parsedData = res.data.map((d: any) => ({
						id: d.id,
						data: d.data,
						valor: Number(d.valor)
					}));
					setDizimos(parsedData);
				}
				
			} catch (err) {
				console.error("Erro ao carregar dízimos:", err);
			} finally {
				setLoading(false);
			}
		}
		if (user) {
		  fetchDizimosPorUsuario();
		}
	}, [ano, user]);

	const dizimosFiltrados = dizimos.filter(
		(d) => parseDateLocal(d.data).getFullYear() === ano
	);

	return (
		<>
			<title>Home</title>
			<div>
				<NavBar />
				<YearSelector
                    initialYear={ano}
                    onChange={(novoAno) => {
                    setAno(novoAno);
                    }}
				/>

				<div className="flex flex-col items-center justify-center mb-10 mt-10">
					<h2 className="text-center md:text-2xl text-xl font-bold mb-6">Seus dízimos</h2>
					<div className="shadow-lg rounded-lg overflow-x-auto md:w-3/4 m-2">
						<table className="w-full table-fixed border-collapse text-center">
							<thead className="bg-black text-white">
								<tr>
									<th className="px-4 py-2 border w-1/3">Mês</th>
									<th className="px-4 py-2 border w-1/3">Data</th>
									<th className="px-4 py-2 border w-1/3">Valor</th>
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr>
										<td colSpan={3} className="px-4 py-6 text-center text-gray-500">
											Carregando seus dízimos...
										</td>
									</tr>
								) : dizimosFiltrados.length > 0 ? (
									dizimosFiltrados.map((d) => {
										const dataLocal = parseDateLocal(d.data);
										return (
											<tr key={d.id} className="bg-white hover:bg-gray-100">
												<td className="px-4 py-2 border w-1/3">{meses[dataLocal.getMonth()]}</td>
												<td className="px-4 py-2 border w-1/3">{dataLocal.toLocaleDateString("pt-BR")}</td>
												<td className="px-4 py-2 border w-1/3">
													R$ {d.valor.toFixed(2).replace(".", ",")}
												</td>
											</tr>
										);
									})
								) : (
									<tr>
										<td colSpan={3} className="px-4 py-2 border text-center">
											Nenhum dízimo encontrado
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</>
	);
}
