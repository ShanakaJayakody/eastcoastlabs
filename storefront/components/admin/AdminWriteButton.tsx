"use client";
import type {ButtonHTMLAttributes} from 'react';
import {useAdminReadOnly} from './AdminReadOnlyContext';
/** Presentation only. Server actions and the data transport independently deny writes. */
export default function AdminWriteButton({disabled,title,...props}:ButtonHTMLAttributes<HTMLButtonElement>){
 const readOnly=useAdminReadOnly();
 return <button {...props} disabled={readOnly||disabled} title={readOnly?'Read-only preview. Store changes are disabled.':title} data-admin-write="true"/>;
}
