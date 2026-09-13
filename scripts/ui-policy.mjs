export const ranges={bodySize:[16,18],lineHeight:[1.5,1.8],postSpacing:[20,32],titleSize:[18,22]};
export function validateTokens(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join()!==Object.keys(ranges).sort().join())throw Error('Exactly the permitted token keys are required');
  for(const [key,[min,max]] of Object.entries(ranges))if(typeof value[key]!=='number'||!Number.isFinite(value[key])||value[key]<min||value[key]>max)throw Error('Out-of-range token: '+key);
  return value;
}
export function validateChange(files){
  if(files.length!==1||files[0].filename!=='public/ui-tokens.json'||files[0].status!=='modified'||files[0].previous_filename)throw Error('Manual review required: only existing UI tokens may change');
}
export function tokenCSS(value){const t=validateTokens(value);return `.network-message .admin-message pre{font-size:${t.bodySize}px;line-height:${t.lineHeight}}.network-message .admin-message{padding-top:${t.postSpacing}px;padding-bottom:${t.postSpacing}px}.network-message .post-title{font-size:${t.titleSize}px}\n`;}
