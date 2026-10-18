import fs from 'node:fs';
import assert from 'node:assert/strict';
import {RULE_FILES,outputSchema,composeAnalysisPrompt} from './analysis-contract.mjs';
const read=p=>fs.readFileSync(p,'utf8'),taxonomy=JSON.parse(read('skills/image-analysis-taxonomy/taxonomy.json'));
const schema=outputSchema(taxonomy),rules={base:RULE_FILES.base.map(read).join('\n'),contract:read(RULE_FILES.contract)};
assert.deepEqual(JSON.parse(read('skills/image-analysis-taxonomy/schema/output.schema.json')),schema);
const built=read('dist/server/index.js');
for(const [name,value]of [['ANALYSIS_SCHEMA',schema],['ANALYSIS_RULES',rules]]){const prefix='const '+name+'=',start=built.indexOf(prefix)+prefix.length;assert.deepEqual(JSON.parse(built.slice(start,built.indexOf(';\n',start))),value)}
const prompt=composeAnalysisPrompt(rules,taxonomy,'custom-marker',['东方古风'],'collection-reference');
assert.equal(prompt.split('# 唯一输出契约').length-1,1);
assert.equal(prompt.split('# 图片视觉分析与标准化标签').length-1,1);
assert(prompt.indexOf('custom-marker')<prompt.indexOf('最终输出契约（优先于任何示例与补充规则）'));
assert(prompt.includes('产品、器物'));assert(prompt.includes('混合或多人'));assert(prompt.includes('每张集合图片独立分析'));
assert(schema.properties.dimensions.properties.color.required.includes('dominant_colors'));
assert(schema.required.includes('imagePrompt')&&schema.required.includes('collectionNames'));
assert.equal(Object.keys(schema.properties.dimensions.properties).length,24);
assert(!read('public/app.js').includes('installed.defaultSkill'));
console.log('PASS: API/local prompt parity, generated schema consistency, one final contract, subject routing and no duplicate default rules.');
