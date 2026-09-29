/** Publish immutable receipt media for existing catalogue entries. Dry-run by default.
 * Explicit environment only; no dotenv or seed loading. No historical order/email writes.
 */
import {createClient} from '@supabase/supabase-js';
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const apply=process.argv.includes('--apply');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the intended environment.');
const db=createClient(url,key,{auth:{persistSession:false}});
const vite=await createServer({root,configFile:false,envDir:false,cacheDir:path.join(root,"node_modules/.vite-customer-media"),server:{middlewareMode:true,watch:null},resolve:{alias:[{find:'server-only',replacement:path.join(root,'tests/helpers/server-only.ts')}]}});
let prepared=0,skipped=0;
try {
 const {prepareProductMedia}=await vite.ssrLoadModule('/lib/product-media.ts');
 let offset=0;
 while(true){
  const {data:products,error}=await db.from('products').select('id,slug,images,size_parent_id,size_label').order('id').range(offset,offset+99);
  if(error)throw new Error('Could not read product media');if(!products.length)break;
  for(const product of products){
   if(product.size_parent_id||!/^[a-z0-9-]+$/.test(product.slug)){skipped++;continue;}
   const images=Array.isArray(product.images)?product.images:[];
   const sizeKey=v=>(v||'').replace(/\s/g,'').toLowerCase();
   const match=product.size_label?images.findIndex(i=>i.size_label&&sizeKey(i.size_label)===sizeKey(product.size_label)):-1;
   const index=match>=0?match:0,first=images[index];
   if(first?.size_label&&sizeKey(first.size_label)!==sizeKey(product.size_label)){skipped++;continue;}
   if(!first?.src||first.email_src){skipped++;continue;}
   let input;
   if(typeof first.src==='string'&&/^\/images\/[\w./-]+\.(png|jpe?g|webp)$/i.test(first.src)){
    const file=path.resolve(root,'public',first.src.slice(1));
    if(!file.startsWith(path.join(root,'public')+path.sep)){skipped++;continue;}
    input=await readFile(file);
   } else {
    let source;try{source=new URL(first.src);}catch{skipped++;continue;}
    if(source.protocol!=='https:'||source.origin!==new URL(url).origin||!source.pathname.startsWith('/storage/v1/object/public/product-images/')||source.search||source.hash||source.username||source.password){skipped++;continue;}
    const response=await fetch(source,{redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`Image unavailable for ${product.slug}`);
    const reader=response.body.getReader(),chunks=[];let total=0;
    try{while(true){const next=await reader.read();if(next.done)break;total+=next.value.length;if(total>8*1024*1024)throw new Error('Image exceeds 8MB');chunks.push(next.value);}}finally{await reader.cancel();}
    input=Buffer.concat(chunks);
   }
   const media=await prepareProductMedia(input);
   const imagePath=`${product.slug}/${media.digest}.jpg`,thumbnailPath=`${product.slug}/${media.digest}-email.jpg`;
   if(apply){
    for(const [target,body] of [[imagePath,media.image],[thumbnailPath,media.thumbnail]]){
     const uploaded=await db.storage.from('product-images').upload(target,body,{contentType:'image/jpeg',cacheControl:'31536000',upsert:false});
     if(uploaded.error&&!/already exists|duplicate/i.test(uploaded.error.message))throw new Error(`Upload failed for ${product.slug}`);
    }
    const updated=images.map((image,i)=>i===index?{...first,size_label:product.size_label??null,src:db.storage.from('product-images').getPublicUrl(imagePath).data.publicUrl,email_src:db.storage.from('product-images').getPublicUrl(thumbnailPath).data.publicUrl}:image);
    // Compare-and-set: a concurrent catalogue edit must not be overwritten.
    const saved=await db.from('products').update({images:updated}).eq('id',product.id).eq('images',JSON.stringify(images)).select('id');
    if(saved.error||saved.data?.length!==1)throw new Error(`Catalogue changed or save failed for ${product.slug}; rerun after review`);
   }
   prepared++;
  }
  offset+=products.length;if(products.length<100)break;
 }
 console.log(`${apply?'Published':'Dry-run prepared'} ${prepared} product image pairs; skipped ${skipped} already-prepared, absent or unsupported sources. No orders or queued emails changed.`);
} finally {await vite.close();}
