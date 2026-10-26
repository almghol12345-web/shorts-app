const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();
 for(const [k,s] of [['icon',1024],['splash',2732]]){const p=await b.newPage({viewport:{width:s,height:s}});await p.goto('file://'+path.resolve('art.html')+'?k='+k);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(400);await p.locator('#stage').screenshot({path:`../assets/${k==='icon'?'icon-only':'splash'}.png`});}
 await b.close()})();
