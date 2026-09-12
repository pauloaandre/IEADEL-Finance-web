"use client";
import { useState } from "react";

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

interface MonthSelectorProps {
  initialMonth?: number;
  initialYear?: number;
  onChange?: (mes: number, ano: number) => void;
}

export default function MonthSelector({
  initialMonth,
  initialYear,
  onChange,
}: MonthSelectorProps) {
  const today = new Date();
  const [mes, setMes] = useState(initialMonth || today.getMonth() + 1);
  const [ano, setAno] = useState(initialYear || today.getFullYear());

  const prevMonth = () => {
    let newMes = mes;
    let newAno = ano;

    if (mes === 1) {
      newMes = 12;
      newAno = ano - 1;
    } else {
      newMes = mes - 1;
    }

    setMes(newMes);
    setAno(newAno);
    onChange?.(newMes, newAno);
  };

  const nextMonth = () => {
    let newMes = mes;
    let newAno = ano;

    if (mes === 12) {
      newMes = 1;
      newAno = ano + 1;
    } else {
      newMes = mes + 1;
    }

    setMes(newMes);
    setAno(newAno);
    onChange?.(newMes, newAno);
  };

  return (
    <div className="flex items-center gap-6 justify-center py-4 mt-4">
      <button
        onClick={prevMonth}
        className="px-3 py-1 text-xl bg-gray-200 rounded hover:bg-gray-300"
      >
        &lt;
      </button>
      <span className="text-lg md:text-xl font-semibold text-black">
        {meses[mes - 1]} {ano}
      </span>
      <button
        onClick={nextMonth}
        className="px-3 py-1 text-xl bg-gray-200 rounded hover:bg-gray-300"
      >
        &gt;
      </button>
    </div>
  );
}
