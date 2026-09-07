/** Explicit stable pages avoid the service's default result cap. Query factory
 * must order by a unique key (or end its sort with one). Errors are never empty data. */
export async function readAll<T>(page: (start: number, end: number) => PromiseLike<{data: T[] | null; error: {message: string} | null}>): Promise<T[]> {
 const rows: T[]=[];
 const size=500;
 for(let start=0;;start+=size){
  const {data,error}=await page(start,start+size-1);
  if(error) throw new Error(error.message);
  rows.push(...(data ?? []));
  if((data?.length ?? 0)<size) return rows;
 }
}
