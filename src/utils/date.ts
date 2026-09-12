export function parseDateLocal(dateString: string) {
  const [year, month, day] = dateString.split("T")[0].split("-");
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );
}