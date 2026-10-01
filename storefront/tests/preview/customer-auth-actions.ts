export async function requestCustomerCode(email:string){ return {ok:true,email}; }
export async function verifyCustomerCode(code:string){ return code==='123456'?{ok:true}:{ok:false,error:'That code is invalid or expired. Check it or request a new code.'}; }
export async function customerSignOut(){}
