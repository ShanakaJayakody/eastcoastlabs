// Synthetic preview only: no production imports or side effects.
export async function addProductSize(){return {ok:true,message:'Synthetic size added (preview only)'};}
export async function saveProductSize(){return {ok:true,version:2};}
export async function saveUnitCost(){return {ok:true};}
export async function fetchMovements(){return [];}
export async function adjustStock(){return {ok:false,error:'Stock writes are disabled in this preview'};}
export async function reverseReceipt(){return {ok:false,error:'Stock writes are disabled in this preview'};}
