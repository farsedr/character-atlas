# 输出契约

## 强制字段类型
应用将逐字段校验。禁止改名、遗漏字段、返回自己的输出结构，禁止把数字或布尔值加引号。空数组也必须保留，不能改为 null、空字符串或对象。
confidence：JSON 数字（如 0.95），不能是 "0.95" 或 "95%"。
uncertain：JSON 布尔值 true / false，不能是 "false"、"确定"、0 或 1。
secondary、evidence：字符串数组；一项也必须写成数组。primary：字符串，仅 vibe 可用数组。
gender_presentation 的合法示例：{"primary":"女性化呈现","secondary":[],"confidence":0.9,"evidence":["可见的人物外观呈女性化视觉表达"],"uncertain":false}。示例只说明格式，不是当前图片的结论。
输出前逐项检查全部24维是否完整，字段名、类型及未知/不适用约定是否正确；不得为通过校验编造视觉结论。输出契约优先于角色提示词等其他 Skill 的示例格式。
顶层字段：taxonomy_version="1.0.0"、shortName（图库1–4汉字）、imagePrompt（完整中文提示词）、collectionNames（匹配的灵感集名称数组）、collectionName（兼容字段，数组以顿号连接）、summary、primary_subject、secondary_subjects、dimensions、analysis_quality。
dimensions 含 taxonomy.json 的全部24个id。
每维：{"primary":"最具体标签或unknown或not_applicable","secondary":[],"confidence":0.9,"evidence":["对应可见细节"],"uncertain":false}。
unknown: confidence=0、secondary=[]、uncertain=true、evidence说明不足；not_applicable: confidence=1、secondary=[]、uncertain=false。
visual_age、gender_presentation、shot_scale单选。vibe允许1–2主标签（数组），其他维度primary单字符串。
color可额外返回dominant_colors。标签总数不得超过该维limit。
analysis_quality: {"confidence_overall":0.9,"visible_evidence":[],"uncertain_points":[],"conflicting_tags":[],"missing_dimensions":[],"proposed_tags":[{"dimension":"style","tag":"生物机械风","reason":"机械结构与有机组织结合"}]}。
模型输出须是合法JSON。未观察到的信息明确说明，不推测真实年龄、软件或精确摄影参数。

## 细分判定准则
题材先判断世界背景，再根据明确道具、装束、非人结构细分角色。仙侠服装+光环可支持仙子，剑器+道服支持剑修，魔法书/法杖+女巫服饰支持魔女；仅清冷表情或暗色背景不能证明魔女身份。服饰按功能、文化、版型、领袖、长度、装饰、配饰逐项观察；材质按纹理、透明度、反射、磨损观察，不强行断言化学成分。画风区分表现媒介、写实程度和视觉流派，不能把背景题材当作唯一画风。形态描述主体结构，不把景别当作身体形态。比例分析造型，不代替文件长宽比。气质描述视觉印象，不断言真实人格。场景为可见空间，氛围为天气和空气效果，特效为能量或视觉附加元素；不能互相替代。年龄、性别和妆容不适用于纯风景。光影辨别方向、软硬、轮廓与多光源；色彩记录主色、饱和度、明度与配色关系。镜头只用视觉语言，不猜精确焦段。姿态是身体状态，动作是可见行为，表情是可见面部表现，三者分别分析。

## 自动分组
输出 collectionNames 数组：先综合当前图像的主体、世界背景、用途与视觉风格，检查系统内置及用户已有灵感集。优先选择核心含义适合的已有集合，使用列表中的原名；一张图可以同时进入多个互补分类，通常1至3个，不能为了数量硬凑。同一套角色的不同姿态、裁切、服饰细节通常复用相同集合；不要为每张图拼接发色、衣色和气质另起名字。只有已有集合都不能合理覆盖某个主要分类需求时才新建简洁、可复用的名称，不限制四字，最长40字。已有“东方古风”“仙侠幻想”“角色设定”时，古风仙侠角色多视图可同时归入这些合适集合；单人肖像不因有角色就归入“角色设定”，该集合用于设定图、多视图或设计展示。对已有“清冷师尊”“高傲男人”等细分集合需有可见服饰、道具及视觉表现支持，不猜职业、真实人格。保持分类粒度稳定，避免同义集合和每图一集。collectionName兼容旧客户端，填写collectionNames以顿号连接的名称；旧输出结构不允许数组时只输出该兼容字符串。无可靠分类返回空数组及空字符串。用户手动分组由应用保留。
