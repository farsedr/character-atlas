# 输出契约
顶层字段：taxonomy_version="1.0.0"、shortName（图库1–4汉字）、summary、primary_subject、secondary_subjects、dimensions、analysis_quality。
dimensions 含 taxonomy.json 的全部24个id。
每维：{"primary":"最具体标签或unknown或not_applicable","secondary":[],"confidence":0.9,"evidence":["对应可见细节"],"uncertain":false}。
unknown: confidence=0、secondary=[]、uncertain=true、evidence说明不足；not_applicable: confidence=1、secondary=[]、uncertain=false。
visual_age、gender_presentation、shot_scale单选。vibe允许1–2主标签（数组），其他维度primary单字符串。
color可额外返回dominant_colors。标签总数不得超过该维limit。
analysis_quality: {"confidence_overall":0.9,"visible_evidence":[],"uncertain_points":[],"conflicting_tags":[],"missing_dimensions":[],"proposed_tags":[{"dimension":"style","tag":"生物机械风","reason":"机械结构与有机组织结合"}]}。
模型输出须是合法JSON。未观察到的信息明确说明，不推测真实年龄、软件或精确摄影参数。

## 细分判定准则
题材先判断世界背景，再根据明确道具、装束、非人结构细分角色。仙侠服装+光环可支持仙子，剑器+道服支持剑修，魔法书/法杖+女巫服饰支持魔女；仅清冷表情或暗色背景不能证明魔女身份。服饰按功能、文化、版型、领袖、长度、装饰、配饰逐项观察；材质按纹理、透明度、反射、磨损观察，不强行断言化学成分。画风区分表现媒介、写实程度和视觉流派，不能把背景题材当作唯一画风。形态描述主体结构，不把景别当作身体形态。比例分析造型，不代替文件长宽比。气质描述视觉印象，不断言真实人格。场景为可见空间，氛围为天气和空气效果，特效为能量或视觉附加元素；不能互相替代。年龄、性别和妆容不适用于纯风景。光影辨别方向、软硬、轮廓与多光源；色彩记录主色、饱和度、明度与配色关系。镜头只用视觉语言，不猜精确焦段。姿态是身体状态，动作是可见行为，表情是可见面部表现，三者分别分析。
