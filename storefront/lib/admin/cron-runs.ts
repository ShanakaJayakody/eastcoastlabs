import "server-only";
import { adminDb } from "./db";

export const CRON_JOBS = [
  { job: "email-outbox", label: "Email outbox", schedule: "hourly + daily backstop", overdueHours: 3 },
  { job: "lifecycle", label: "Lifecycle sweeps", schedule: "daily", overdueHours: 30 },
  { job: "abandoned-carts", label: "Cart recovery", schedule: "hourly + daily backstop", overdueHours: 3 },
  { job: "payment-ops", label: "Unpaid orders", schedule: "hourly + daily backstop", overdueHours: 3 },
  { job: "daily-brief", label: "Daily brief", schedule: "daily", overdueHours: 30 },
] as const;
export interface CronRun {
  job:string; status:"ok"|"failed"; detail:Record<string,unknown>; error:string|null; duration_ms:number|null; created_at:string;
}
export interface CronHealth {
  job:string;label:string;schedule:string;last:CronRun|null;ageHours:number|null;state:"ok"|"failed"|"overdue"|"never";
}
function hasFailures(detail:Record<string,unknown>):boolean {
  return Object.entries(detail).some(([key,value]) =>
    (/(?:failed|dead)$/i.test(key) && ((typeof value === "number" && value>0) || (Array.isArray(value) && value.length>0)))
    || (value!==null && typeof value === "object" && !Array.isArray(value) && hasFailures(value as Record<string,unknown>)));
}
export async function recordCronRun<T extends Record<string,unknown>>(job:string,work:()=>Promise<T>):Promise<T> {
  const started=Date.now();let detail:Record<string,unknown>={};
  try {
    detail=await work();
    if(hasFailures(detail))throw new Error("Some job operations failed; see the recorded counts and delivery errors");
    await write(job,"ok",detail,null,Date.now()-started);
    return detail as T;
  } catch(err) {
    const message=err instanceof Error?err.message:String(err);
    try { await write(job,"failed",detail,message,Date.now()-started); }
    catch { console.error(`Cron health persistence failed for ${job}`); }
    throw err;
  }
}
async function write(job:string,status:"ok"|"failed",detail:Record<string,unknown>,error:string|null,durationMs:number) {
  const {error:writeError}=await adminDb().from("cron_runs").insert({job,status,detail,error,duration_ms:durationMs});
  if(writeError)throw new Error(`Cannot record cron health: ${writeError.message}`);
}
export async function cronHealth():Promise<CronHealth[]> {
  return Promise.all(CRON_JOBS.map(async({job,label,schedule,overdueHours})=>{
    // One indexed lookup per known job cannot crowd infrequent jobs out of a
    // shared 500-row limit when an hourly scheduler is running frequently.
    const {data,error}=await adminDb().from("cron_runs").select("job,status,detail,error,duration_ms,created_at")
      .eq("job",job).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(error)throw new Error(`Cannot read cron health: ${error.message}`);
    const last=(data as CronRun|null)??null;
    const ageHours=last?Math.max(0,(Date.now()-Date.parse(last.created_at))/3600_000):null;
    const state: CronHealth["state"] = !last?"never":last.status==="failed"?"failed":ageHours!==null&&ageHours>overdueHours?"overdue":"ok";
    return {job,label,schedule,last,ageHours,state};
  }));
}
