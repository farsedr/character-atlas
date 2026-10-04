// MD5 is used only for Baidu's file-part integrity protocol, never for credentials.
function baiduMD5(input){
 const bytes=new Uint8Array(Math.ceil((input.length+9)/64)*64);bytes.set(input);bytes[input.length]=128;
 const view=new DataView(bytes.buffer);view.setUint32(bytes.length-8,(input.length*8)>>>0,true);view.setUint32(bytes.length-4,Math.floor(input.length/536870912),true);
 const shifts=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21],constants=Array.from({length:64},(_,i)=>(Math.abs(Math.sin(i+1))*4294967296)>>>0);
 let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
 for(let p=0;p<bytes.length;p+=64){let a=a0,b=b0,c=c0,d=d0;for(let i=0;i<64;i++){let f,g;if(i<16){f=(b&c)|(~b&d);g=i}else if(i<32){f=(d&b)|(~d&c);g=(5*i+1)%16}else if(i<48){f=b^c^d;g=(3*i+5)%16}else{f=c^(b|~d);g=(7*i)%16}const s=shifts[Math.floor(i/16)*4+i%4],v=(a+f+constants[i]+view.getUint32(p+g*4,true))|0;const next=(b+((v<<s)|(v>>>(32-s))))|0;a=d;d=c;c=b;b=next}a0=(a0+a)|0;b0=(b0+b)|0;c0=(c0+c)|0;d0=(d0+d)|0}
 return [a0,b0,c0,d0].flatMap(v=>[0,8,16,24].map(s=>((v>>>s)&255).toString(16).padStart(2,"0"))).join("");
}
