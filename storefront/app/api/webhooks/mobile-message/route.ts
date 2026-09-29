import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/admin/db';
import { verifyMobileMessageWebhook, parseMobileMessageReceipt } from '@/lib/sms/webhook';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
  const secret=process.env.MOBILE_MESSAGE_WEBHOOK_SECRET;
  if(!secret)return NextResponse.json({error:'Delivery reports are not configured'},{status:503});
  const raw=await request.text();
  if(raw.length>16384)return NextResponse.json({error:'Payload too large'},{status:413});
  if(!verifyMobileMessageWebhook(raw,request.headers.get('X-MM-Timestamp'),request.headers.get('X-MM-Signature'),secret))
    return NextResponse.json({error:'Invalid signature'},{status:401});
  let input:unknown;
  try {input=JSON.parse(raw)}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
  const receipt=parseMobileMessageReceipt(input);
  // Other integrations may share the account: acknowledge unrelated references.
  if(!receipt)return NextResponse.json({ignored:true});
  const {data,error}=await adminDb().rpc('report_admin_sms',{p_id:receipt.custom_ref,p_message_id:receipt.message_id,
    p_phone:receipt.to,p_part:receipt.part_number,p_total:receipt.total_parts,p_status:receipt.status});
  if(error)return NextResponse.json({error:'Delivery report could not be saved'},{status:503});
  return NextResponse.json({recorded:!!data});
}
