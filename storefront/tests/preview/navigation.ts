export function usePathname(){
 const path=window.location.pathname;
 if(path==='/navy.html') return '/';
 if(path==='/mobile-shopping.html') return '/product/sample';
 if(path==='/frame.html') {
  const page=new URLSearchParams(window.location.search).get('page') ?? 'checkout';
  return page==='creators'?'/creators':page.endsWith('-admin')?'/admin':page==='recovery'?'/cart-recovery':page==='checkout'?'/checkout':'/product/sample';
 }
 return path;
}
export const useSearchParams=()=>new URLSearchParams(window.location.search);
export function useRouter(){return {refresh(){},push(){},replace(){}};}
