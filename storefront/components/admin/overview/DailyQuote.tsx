"use client";
import {useEffect,useState} from 'react';
import {dailyQuote,nextQuoteDelay} from '@/lib/admin/daily-quote';
export default function DailyQuote({initial}:{initial:ReturnType<typeof dailyQuote>}) {
  const [quote,setQuote]=useState(initial);
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>;
    const refresh=()=>{
      clearTimeout(timer);
      const now=new Date();
      setQuote(dailyQuote(now));
      timer=setTimeout(refresh,nextQuoteDelay(now));
    };
    const visible=()=>{if(document.visibilityState==='visible')refresh();};
    refresh();document.addEventListener('visibilitychange',visible);
    return ()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',visible);};
  },[]);
  return <blockquote className="admin-daily-quote">{quote.text}</blockquote>;
}
