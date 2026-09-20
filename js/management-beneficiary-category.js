const category=document.getElementById('clientCategory');
const form=document.getElementById('clientForm');
if(category&&form){
  let cachedOptions='';
  const remember=()=>{
    if(category.options.length>1)cachedOptions=category.innerHTML;
  };
  const restore=()=>{
    if(category.options.length<=1&&cachedOptions){
      const value=category.value;
      category.innerHTML=cachedOptions;
      if([...category.options].some(o=>o.value===value))category.value=value;
    }
  };
  const observer=new MutationObserver(()=>{
    if(category.options.length>1)remember();
    else restore();
  });
  observer.observe(category,{childList:true});
  const formObserver=new MutationObserver(()=>{
    if(form.classList.contains('open')){
      restore();
      remember();
    }
  });
  formObserver.observe(form,{attributes:true,attributeFilter:['class']});
  category.addEventListener('focus',restore);
  category.addEventListener('click',restore);
  setTimeout(remember,500);
}
