"use client";
import {createContext,useContext,useState,type ReactNode} from 'react';
export type AdminTheme='light'|'dark';
export function readAdminTheme(value:unknown):AdminTheme{return value==='dark'?'dark':'light';}
const Context=createContext({theme:'light' as AdminTheme,setTheme:(_theme:AdminTheme)=>{}});
export const useAdminTheme=()=>useContext(Context);
export function AdminThemeProvider({initialTheme='light',children}:{initialTheme?:AdminTheme;children:ReactNode}) {
  const [theme,update]=useState(readAdminTheme(initialTheme));
  const setTheme=(next:AdminTheme)=>{
    const safe=readAdminTheme(next);update(safe);
    try{document.cookie=`ecl-admin-theme=${safe}; Path=/admin; Max-Age=31536000; SameSite=Lax`;}catch{/* Preference is optional. */}
  };
  return <Context.Provider value={{theme,setTheme}}>{children}</Context.Provider>;
}
