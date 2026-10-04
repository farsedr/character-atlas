# 输出契约
顶层字段：taxonomy_version="1.0.0"、shortName（图库1–4汉字）、imagePrompt（完整中文提示词）、collectionName（灵感集建议名称，无法判断时为空）、summary、primary_subject、secondary_subjects、dimensions、analysis_quality。
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
输出 collectionName：先独立分析当前图片的主体类型、题材背景、服饰、姿态、表情及视觉气质，再逐一比较已有灵感集的核心语义。只有核心特征相符、放入后不会混淆分类时才复用；不能因为列表只有一个集合、名称相近或上一张图片使用过就套用。没有合适集合时必须新建准确、有区分度的中文分类名，例如“清冷师尊”“高傲男人”“温柔古风女子”“未来机械战士”，示例不是封闭选项；身份称谓需有服饰或道具等证据，气质只是视觉印象，不断言真实人格。名称不限制四个字，最长40字，不按每张素材名或细小配饰差异拆分。逐张独立判断，不沿用上一张结论；同一批图片可进入不同集合。无可靠依据时返回空字符串。用户手动分组由应用保留。
