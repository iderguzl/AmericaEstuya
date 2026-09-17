function patchConfigurationDetail(){
  const view=document.getElementById('cfgValuesView');
  const tools=document.getElementById('cfgValueTools');
  const back=document.getElementById('cfgBackValues');
  const heading=document.getElementById('cfgValuesHeading');
  if(!view||!tools||!back||!heading)return false;
  if(!document.getElementById('cfgDetailUiStyle')){
    const style=document.createElement('style');
    style.id='cfgDetailUiStyle';
    style.textContent=`
      #cfgValuesView .cfg-headline{justify-content:center;margin:2px 0 10px}
      #cfgValuesView .cfg-headline h1{font-family:Arial,sans-serif;font-size:24px;line-height:1.15;text-align:center;letter-spacing:.01em;color:#173f61}
      #cfgBackValues.cfg-back-detail{background:#0b78c5!important;color:#fff!important;border:0!important;width:40px;height:40px;border-radius:10px;display:grid;place-items:center;font-size:23px;font-weight:900}
      #cfgBackValues.cfg-back-detail:hover{background:#0868aa!important}
      @media(max-width:760px){#cfgValuesView .cfg-headline h1{font-size:21px}}
    `;
    document.head.appendChild(style);
  }
  if(back.parentElement!==tools){
    tools.insertBefore(back,tools.firstChild);
    const sep=document.createElement('span');sep.className='tool-sep cfg-back-sep';back.insertAdjacentElement('afterend',sep);
  }
  const headline=view.querySelector('.cfg-headline');
  if(headline&&!headline.contains(heading))headline.appendChild(heading);
  return true;
}
const observer=new MutationObserver(()=>{if(patchConfigurationDetail())observer.disconnect()});
observer.observe(document.documentElement,{childList:true,subtree:true});
patchConfigurationDetail();
