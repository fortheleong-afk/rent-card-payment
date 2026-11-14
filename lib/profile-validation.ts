export function validateName(value:string){return value.trim()?'':'Enter your full name.';}
export function validatePhone(value:string){
 const phone=value.trim(),digits=phone.replace(/\D/g,'');
 return /^\+?[0-9][0-9 ()-]{5,23}$/.test(phone)&&digits.length>=7&&digits.length<=15?'':'Enter a contact number with 7–15 digits. International country codes are accepted.';
}
