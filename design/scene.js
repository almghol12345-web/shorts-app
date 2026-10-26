// Shared SVG scene: dawn over a ruined skyline, barbed wire, zombie silhouettes.
function scene(w,h,opts){
  const sunY=h*0.62, sunR=w*0.26;
  let sky=`<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0f14"/><stop offset=".45" stop-color="#2a1a1c"/><stop offset=".7" stop-color="#8a3a1c"/><stop offset=".82" stop-color="#d9772f"/><stop offset="1" stop-color="#f1b23c"/></linearGradient>
  <radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff1c4"/><stop offset=".55" stop-color="#f6c14f"/><stop offset="1" stop-color="#e48a2c"/></radialGradient>
  <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f1b23c" stop-opacity=".55"/><stop offset="1" stop-color="#f1b23c" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#sky)"/>
  <circle cx="${w/2}" cy="${sunY}" r="${sunR*2.1}" fill="url(#glow)"/>
  <circle cx="${w/2}" cy="${sunY}" r="${sunR}" fill="url(#sun)"/>`;
  // rays
  for(let i=0;i<9;i++){const a=Math.PI*(1+i/8);sky+=`<line x1="${w/2+Math.cos(a)*sunR*1.15}" y1="${sunY+Math.sin(a)*sunR*1.15}" x2="${w/2+Math.cos(a)*sunR*1.7}" y2="${sunY+Math.sin(a)*sunR*1.7}" stroke="#f6c14f" stroke-opacity=".5" stroke-width="${w*0.012}" stroke-linecap="round"/>`}
  // skyline (deterministic)
  let x=0,seed=3;const R=()=>{seed=(seed*9301+49297)%233280;return seed/233280};
  let pts=`0,${h}`;const base=h*0.74;
  while(x<w){const bw=w*(0.05+R()*0.07),bh=h*(0.06+R()*0.2);const top=base-bh;const broken=R()<.45;
    pts+=` ${x},${base} ${x},${top}`;
    if(broken){pts+=` ${x+bw*.3},${top+bh*.12} ${x+bw*.55},${top-bh*.05} ${x+bw*.8},${top+bh*.2}`}
    pts+=` ${x+bw},${top} ${x+bw},${base}`;x+=bw}
  pts+=` ${w},${h}`;
  sky+=`<polygon points="${pts}" fill="#120d0d"/>`;
  // windows
  seed=11;for(let i=0;i<40;i++){const wx=R()*w,wy=base-R()*h*0.2;if(R()<.5)sky+=`<rect x="${wx}" y="${wy}" width="${w*0.008}" height="${w*0.012}" fill="#f1b23c" opacity="${.3+R()*.5}"/>`}
  // ground
  sky+=`<rect x="0" y="${base}" width="${w}" height="${h-base}" fill="#0c0a0a"/>`;
  // barbed wire fence
  const fy=h*0.8;sky+=`<path d="M0 ${fy} Q ${w*0.25} ${fy-h*0.02} ${w*0.5} ${fy} T ${w} ${fy}" stroke="#2c2622" stroke-width="${w*0.006}" fill="none"/>`;
  for(let i=0;i<=10;i++){const px=w*i/10;sky+=`<rect x="${px-w*0.006}" y="${fy-h*0.05}" width="${w*0.012}" height="${h*0.2}" fill="#1c1716"/>`;
    sky+=`<path d="M${px+w*.03} ${fy-h*.01} l${w*.012} ${-w*.012} m${-w*.012} 0 l${w*.012} ${w*.012}" stroke="#2c2622" stroke-width="${w*0.004}"/>`}
  // zombie silhouettes (walking hunched figures)
  const zombie=(zx,zy,s,flip)=>`<g transform="translate(${zx} ${zy}) scale(${flip?-s:s} ${s})" fill="#070505">
    <ellipse cx="0" cy="-62" rx="11" ry="12"/>
    <path d="M-12 -50 Q -4 -56 10 -48 L 14 -14 Q 2 -8 -12 -14 Z"/>
    <path d="M8 -46 L 40 -40 L 41 -34 L 8 -36 Z"/><path d="M4 -38 L 34 -28 L 34 -22 L 2 -28 Z"/>
    <path d="M-10 -16 L -18 22 L -10 22 L -2 -10 Z"/><path d="M6 -16 L 14 22 L 22 22 L 12 -14 Z"/></g>`;
  if(opts.zombies){sky+=zombie(w*0.16,h*0.97,w*0.0028,false)+zombie(w*0.84,h*0.98,w*0.003,true)+zombie(w*0.32,h*1.0,w*0.0022,false)}
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${sky}</svg>`;
}
