/* eslint-disable @next/next/no-img-element -- Native image is the isolated Next image boundary. */
import type {CSSProperties} from 'react';
export default function Image({src,alt,fill,width,height,className}:{src:string;alt:string;fill?:boolean;width?:number;height?:number;className?:string;priority?:boolean;sizes?:string}){
 const style:CSSProperties=fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{};
 return <img src={src} alt={alt} width={width} height={height} className={className} style={style}/>;
}
