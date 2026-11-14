'use client';
import { useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { id:string; label:string; hint?:string; validate?:(value:string)=>string };
// Native constraints retain keyboard/focus behavior; errors appear only after interaction.
export default function FormField({id,label,hint,validate,onChange,onBlur,type='text',...props}:Props){
 const [error,setError]=useState(''),[visible,setVisible]=useState(false);
 const check=(input:HTMLInputElement)=>{input.setCustomValidity('');const message=validate?.(input.value)||(input.validity.valueMissing?`Enter ${label.toLowerCase()}.`:input.validity.typeMismatch?'Enter a valid email address.':input.validity.tooShort?`Use at least ${input.minLength} characters.`:'');input.setCustomValidity(message);return input.validity.valid?'':input.validationMessage;};
 const described=[hint?`${id}-hint`:'',error?`${id}-error`:''].filter(Boolean).join(' ')||undefined;
 return <div className="account-field"><label htmlFor={id}>{label}{props.required&&<span className="field-required"> (required)</span>}</label><div className={type==='password'?'password-control':undefined}>
  <input {...props} id={id} type={type==='password'&&visible?'text':type} aria-invalid={Boolean(error)} aria-describedby={described} onChange={event=>{check(event.currentTarget);setError('');onChange?.(event);}} onBlur={event=>{if(event.currentTarget.value)setError(check(event.currentTarget));onBlur?.(event);}} onInvalid={event=>setError(check(event.currentTarget))}/>
  {type==='password'&&<button className="password-toggle" type="button" aria-controls={id} aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?'Hide':'Show'}<span className="work-sr-only"> password</span></button>}
 </div>{hint&&<p className="field-hint" id={`${id}-hint`}>{hint}</p>}{error&&<p className="field-error" id={`${id}-error`}>{error}</p>}</div>;
}
