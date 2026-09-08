import {it,expect} from 'vitest';
import {parseCarrierCsv} from '@/lib/admin/carrier-csv';
it('parses BOM, CRLF, quoted commas, escaped quotes and embedded newlines',()=>{
 expect(parseCarrierCsv('\ufefforder_number,tracking_number,notes\r\n"ECL-1","A,B","line\nnext"\r\nECL-2,"A""B",x\r\n')).toEqual([{orderNumber:'ECL-1',trackingNumber:'A,B'},{orderNumber:'ECL-2',trackingNumber:'A"B'}]);
});
it('rejects invalid headers, malformed quoting, empty tracking, duplicated orders/tracking and oversized input',()=>{
 for(const csv of ['order,tracking\na,b','order_number,tracking_number\na,"bad','order_number,tracking_number\na,"b"junk','order_number,tracking_number\na,','order_number,tracking_number\na,T\na,U','order_number,tracking_number\na,T\nb,T','order_number,order_number,tracking_number\na,b,T'])expect(()=>parseCarrierCsv(csv)).toThrow();
 expect(()=>parseCarrierCsv('x'.repeat(1_000_001))).toThrow(/large/i);
});
it('allows reordered headers but rejects control characters in order/tracking fields',()=>{
 expect(parseCarrierCsv('tracking_number,order_number\nT,A')).toEqual([{orderNumber:'A',trackingNumber:'T'}]);
 expect(()=>parseCarrierCsv('order_number,tracking_number\nA,"B\nC"')).toThrow(/control/i);
});
