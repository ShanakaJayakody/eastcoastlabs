export function reportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
}

