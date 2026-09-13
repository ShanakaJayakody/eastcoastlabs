/** Explicit full reads: deterministic order required, query errors and safety cap throw. */
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: {
        message: string;
    } | null;
}>, label: string): Promise<T[]> {
    const rows: T[] = [];
    const page = 500, max = 50000;
    for (let from = 0; from <= max; from += page) {
        const { data, error } = await build(from, from + page - 1);
        if (error)
            throw new Error(`${label}: ${error.message}`);
        const batch = data ?? [];
        if (rows.length + batch.length > max)
            throw new Error(`${label}: exceeds ${max} rows; narrow the report window`);
        rows.push(...batch);
        if (batch.length < page)
            return rows;
    }
    throw new Error(`${label}: row limit exceeded`);
}
