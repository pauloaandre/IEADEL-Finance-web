"use client";
import { useState } from "react";

interface YearSelectorProps {
  initialYear?: number;
  onChange?: (ano: number) => void;
}

export default function YearSelector({ initialYear, onChange }: YearSelectorProps) {
  const currentYear = new Date().getFullYear();
  const [ano, setAno] = useState(initialYear || currentYear);

  const prevYear = () => {
    const newAno = ano - 1;
    setAno(newAno);
    onChange?.(newAno);
  };

  const nextYear = () => {
    const newAno = ano + 1;
    setAno(newAno);
    onChange?.(newAno);
  };

  return (
    <div className="flex items-center gap-6 justify-center py-4 mt-4">
      <button
        onClick={prevYear}
        className="px-3 py-1 text-xl bg-gray-200 rounded hover:bg-gray-300"
      >
        &lt;
      </button>

      <span className="text-lg md:text-xl font-semibold text-black">
        {ano}
      </span>

      <button
        onClick={nextYear}
        className="px-3 py-1 text-xl bg-gray-200 rounded hover:bg-gray-300"
      >
        &gt;
      </button>
    </div>
  );
}
