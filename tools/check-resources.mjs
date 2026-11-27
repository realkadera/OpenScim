import {chromium} from 'playwright-core';
import { browserOptions } from "./browser.mjs";
import fs from 'node:fs/promises';
const browser=await chromium.launch(browserOptions);
try {
  const page=await browser.newPage();
  const missing=[],errors=[];
  page.on('response',r=>{if(r.status()>=400)missing.push([new URL(r.url()).pathname,r.status()]);});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/yama/');
  await page.waitForFunction(()=>document.querySelector('#root')?.innerText.includes('Practice')&&!document.querySelector('#root').innerText.includes('Did you know?'),undefined,{timeout:90000});
  await page.waitForLoadState('networkidle');
  const sprites=await page.evaluate(async()=>{
    const urls=performance.getEntriesByType('resource').map(x=>new URL(x.name).pathname);
    const examples=[...new Set([...urls.filter(x=>x.includes('/prayer/')&&x.endsWith('.png')).slice(0,3),...urls.filter(x=>x.includes('/items/')).slice(0,3),'/assets/ui/packs/pack-vanilla/prayer/protect_from_melee.png','/assets/items/4151.png'])];
    return Promise.all(examples.map(async url=>{const img=new Image();img.src=url;try{await img.decode();return {url,width:img.naturalWidth,height:img.naturalHeight};}catch{return {url,failed:true};}}));
  });
  console.log(JSON.stringify({sprites,missingCount:missing.length,sample:missing.slice(0,10),errors}));
  await fs.writeFile('evidence/resource-browser.json',JSON.stringify({sprites,missing,errors},null,2));
}finally{await browser.close();}
