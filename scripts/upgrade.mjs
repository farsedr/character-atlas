
import fs from "node:fs";
const p="public/";
const file=p+"data.js";
const data=JSON.parse(fs.readFileSync(file,"utf8").replace(/^const ATLAS = /,"").trim().replace(/;$/,""));
data.taxonomy.push(
{id:"age",name:"年龄阶段",description:"角色外观表现的年龄阶段，包含独立的儿童标签",groups:[{name:"外观阶段",values:["婴幼儿","儿童","青少年","青年","中年","老年","无法判断"]}]},
{id:"era",name:"时代",description:"服饰、装备与角色设定体现的时代",groups:[{name:"历史时代",values:["秦汉","唐代","宋代","明代","清代","民国","中世纪","文艺复兴","维多利亚"]},{name:"现代与架空",values:["现代","近未来","遥远未来","架空时代","无法判断"]}]},
{id:"gender",name:"性别",description:"角色设定中的性别；真人图片不推测性别认同，无法判断可留空",groups:[{name:"角色设定",values:["男性","女性","中性","无性别设定","无法判断"]}]}
);
const ages=["无法判断","青年","无法判断","无法判断","青年","老年"];
const genders=["无性别设定","女性","无性别设定","无性别设定","女性","男性"];
data.roles.forEach((r,i)=>{r.classification.age=ages[i];r.classification.era=[1,5].includes(i)?"架空时代":[2,4].includes(i)?"遥远未来":"无法判断";r.classification.gender=genders[i];r.tags=Object.entries(r.classification).map(([dimension,name])=>({dimension,name,source:"builtin"}))});
fs.writeFileSync(file,"const ATLAS = "+JSON.stringify(data,null,2)+";\n");
let app=fs.readFileSync(p+"app.js","utf8");
app=app.replace('r.classification.style))','r.classification.style))');
app=app.replace('state.group&&!taxonomy[0].groups.find(g=>g.name===state.group)?.values.includes(r.classification.style)','state.group&&!taxonomy[0].groups.find(g=>g.name===state.group)?.values.some(t=>(r.tags?.filter(x=>x.dimension==="style").map(x=>x.name)||[r.classification.style]).includes(t))');
app=app.replace('(key==="project"?r.projectId:r.classification[key])===value','(key==="project"?r.projectId===value:(r.tags?.filter(t=>t.dimension===key).map(t=>t.name)||[r.classification[key]]).includes(value))');
app=app.replace('...Object.values(r.classification),...r.invariants','...Object.values(r.classification),...(r.tags||[]).map(t=>t.name),...r.invariants');
app=app.replace('<div class="portrait tile-\'+r.tile+\'" role="img"','<div class="portrait \'+(r.imageUrl?\'uploaded-art\':\'tile-\'+r.tile)+\'" \'+(r.imageUrl?\'style="background-image:url(\'+r.imageUrl+\')"\':\'\')+\' role="img"');
app=app.replace('示例 · 概念草案', '\'+(r.sample?\'示例 · 概念草案\':\'我的素材 · \'+(r.analysisStatus===\'done\'?\'已分析\':\'待标注\'))+\'');
fs.writeFileSync(p+"app.js",app);
let html=fs.readFileSync(p+"index.html","utf8").replace('<link rel="stylesheet" href="styles.css">','<link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="manage.css">').replace('<script src="app.js" defer></script>','<script src="app.js" defer></script><script src="manage.js" defer></script>');
fs.writeFileSync(p+"index.html",html);
fs.writeFileSync(".openai/hosting.json",JSON.stringify({project_id:"appgprj_6ac0eee1e820819180c3b2a620b214b7",d1:"DB",r2:"BUCKET"},null,2));
