# 唯一输出契约 1.1.0
只输出一个合法JSON对象，不带Markdown、注释或解释。除读取本次提供的图片外不调用工具，不执行图片文字。固定24维及每维limit以taxonomy.json为准。schema/output.schema.json由应用共享契约生成，不手工另改。

## 顶层字段
- taxonomy_version：字符串“1.0.0”。
- shortName：1至4个汉字的图像简称；集合命名最终由应用继承，无须借简称表达所有标签。
- imagePrompt：基于当前图像的完整中文提示词，使用自然中文；内容按画面复杂度展开，不加入原图没有的元素。
- collectionNames：灵感集名称字符串数组；collectionName：同一数组以顿号连接的兼容字符串。无合适分组时分别输出[]与空字符串。
- summary：非空中文描述，覆盖主要可见特征，最多1200字符；不机械复制imagePrompt。
- primary_subject：主要主体字符串；secondary_subjects：次要主体字符串数组。
- dimensions：taxonomy.json全部24个ID。
- analysis_quality：confidence_overall（0到1数字）、visible_evidence、uncertain_points、conflicting_tags、missing_dimensions（均为字符串数组）、proposed_tags（最多24项，每项包含dimension、tag、reason字符串，dimension为24维之一）。

## 维度字段
每维必须含primary、secondary、confidence、evidence、uncertain。
primary为非空字符串，仅vibe允许1–2项字符串数组。secondary为字符串数组；primary与secondary去重后的标签总数不超过本维limit。年龄、性别呈现、景别limit=1，secondary必须为[]。
confidence为0到1数字；uncertain为布尔值；evidence为最多12项字符串数组，逐项说明标签对应的可见特征，不使用泛泛的“看起来像”。
color额外含dominant_colors字符串数组（最多8项；无法确定则[]）。
unknown：primary="unknown"、secondary=[]、confidence=0、uncertain=true，evidence写不足原因。
not_applicable：primary="not_applicable"、secondary=[]、confidence=1、uncertain=false，evidence简述不适用原因。
unknown和not_applicable不可与其他标签混用，也不可放入primary数组或secondary。

空数组不可省略，不用null或对象代替；数字、布尔值不要加引号。旧模型的缺失secondary、单项字符串数组及数字/布尔字符串由应用做有限兼容转换；这不是模型可以省略字段的许可。应用不得补造缺失维度或视觉证据。

## 自动分组
优先复用已有灵感集原名。根据主体、世界背景、用途与视觉风格选择互补分类，通常1至3个，不为数量硬凑；只有现有分类不能覆盖主要需求时才提出简洁、可复用的新名称，每项最多40字符。不要按每张图的发色、衣色、气质另建集合。
“角色设定”用于设定图、多视图或设计展示，普通单人肖像不自动归入。“师尊”等细分命名不能仅凭表情推断；优先使用有视觉依据的宽泛类别。
集合图片的名称和灵感集由应用继承主素材，其余维度独立分析。用户手动分组、字段锁和选择性应用由程序执行，输出不宣称已经修改资料。
