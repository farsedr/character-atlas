# Image Analysis Taxonomy Skill

## Skill ID

image-analysis-taxonomy

## 中文名称

图片多维视觉分析与标准化标签 Skill

## Version

skill_version: 1.0.0
taxonomy_version: 1.0.0

---

# 1. Purpose

本 Skill 用于对一张或多张图片进行系统化视觉分析，并将视觉内容转换为稳定、标准、可检索的结构化标签。

本 Skill 不以“自由描述图片”为主要目标。

核心目标是：

1. 从图片中提取稳定视觉特征；
2. 映射到固定受控标签体系；
3. 区分主标签与辅助标签；
4. 为判断提供视觉证据；
5. 为标签提供置信度；
6. 避免无依据推断；
7. 支持图片筛选、搜索、数据标注和 Prompt 反推。

适用于：

- 图片素材库
- AI 绘画参考图库
- 游戏角色图库
- 影视概念设计图库
- 角色设定管理
- 场景设定管理
- 视觉风格库
- 以图搜图
- 多维筛选器
- 自动图片打标
- 数据集标注
- Prompt 反推
- 图片推荐
- 相似图片匹配
- 多图对比

---

# 2. Core Principles

## 2.1 Evidence First

所有分析必须优先基于图片中明确可见的信息。

不得因为某个标签“看起来可能合适”就添加。

每个重要标签应该能够回答：

> 图片中的什么视觉证据支持这个判断？

如果无法提供证据：

- 降低 confidence；
- 或不输出该标签。

---

## 2.2 Observation ≠ Interpretation

分析必须区分：

### Confirmed

图片中直接可见。

例如：

- 黑色长发
- 红色裙装
- 逆光
- 双人
- 森林

### Likely

视觉证据较强，但无法完全确定。

例如：

- 东方幻想时代
- 长焦感
- 丝绸感
- 巴洛克风

### Unclear

证据不足。

例如：

- 具体朝代
- 精确镜头焦段
- 精确年龄
- 真实职业

不得为了填满字段而猜测。

---

# 3. Human Attribute Rules

对于真人或疑似真人图片，可以分析：

- 视觉年龄
- 性别化视觉呈现
- 发型
- 妆容
- 服饰
- 表情外观
- 姿态
- 动作
- 光影
- 构图
- 风格

不得通过图片推断：

- 真实年龄
- 性别认同
- 性取向
- 民族
- 种族
- 宗教
- 政治倾向
- 健康状况
- 人格
- 智力
- 犯罪倾向
- 社会阶级

因此：

`年龄` 应解释为 `视觉年龄`

`性别` 应解释为 `性别呈现`

`情绪` 应解释为 `可见表情`

---

# 4. Input

支持：

```yaml
images:
  - image_1
  - image_2

analysis_goal:
  optional

dimensions:
  optional

output_mode:
  full | compact | json | yaml | human_readable

language:
  zh-CN | en | auto
```

默认：

```yaml
dimensions: all
output_mode: full
language: zh-CN
```

---

# 5. Analysis Dimensions

本 Skill 使用：

## 24 个正式视觉维度

```text
01 style
02 subject
03 form
04 material
05 proportion
06 vibe
07 visual_age
08 era
09 gender_presentation
10 clothing
11 composition
12 shot_scale
13 view_angle
14 lens_language
15 lighting
16 color
17 scene
18 atmosphere
19 pose
20 action
21 expression
22 hairstyle
23 makeup
24 effects
```

以及一个后台质量字段：

```text
25 analysis_quality
```

---

# 6. Common Output Structure

除特殊维度外，每个维度优先使用：

```json
{
  "primary": null,
  "secondary": [],
  "confidence": 0.0,
  "evidence": [],
  "uncertain": false
}
```

例如：

```json
{
  "primary": "侧逆光",
  "secondary": [
    "轮廓光",
    "柔光",
    "体积光"
  ],
  "confidence": 0.94,
  "evidence": [
    "人物头发边缘出现明显高亮",
    "主要强光来自人物后侧"
  ],
  "uncertain": false
}
```

---

# 7. Unknown / Not Applicable

无法判断：

```json
{
  "primary": "unknown",
  "secondary": [],
  "confidence": 0,
  "evidence": [
    "视觉证据不足"
  ],
  "uncertain": true
}
```

不适用：

```json
{
  "primary": "not_applicable",
  "secondary": [],
  "confidence": 1,
  "evidence": [],
  "uncertain": false
}
```

例如：

风景图：

```yaml
makeup:
  primary: not_applicable
```

严重遮挡的人脸：

```yaml
visual_age:
  primary: unknown
```

---

# 8. Confidence Rules

```text
0.90–1.00
极高置信度

0.80–0.89
高置信度

0.65–0.79
中等置信度

0.50–0.64
弱候选

< 0.50
默认不作为正式标签
```

数据库建议：

```text
>= 0.85
confirmed

0.65–0.84
candidate

< 0.65
omit
```

---

# 9. STYLE — 画风

字段：

```text
style
```

选择方式：

```text
1 个 primary
0–5 个 secondary
```

## 写实程度

```text
超写实
照片级写实
高写实
写实
唯美写实
半写实
轻写实
风格化写实
理想化写实
非写实
强风格化
抽象化
极度抽象
```

## 传统绘画媒介

```text
油画
丙烯
水彩
水粉
水墨
彩铅
铅笔
炭笔
粉彩
蜡笔
马克笔
钢笔
线稿
木刻
版画
丝网印刷
拼贴
混合媒介
壁画
马赛克
彩绘玻璃
```

## 数字绘画

```text
数字插画
厚涂
平涂
赛璐璐
无线稿厚涂
线稿上色
柔光插画
高细节插画
概念设计
游戏原画
角色原画
场景原画
卡牌原画
宣传插画
商业插画
编辑插画
时尚插画
科幻插画
奇幻插画
```

## 动漫漫画

```text
日系动漫
国漫
韩漫
美漫
欧漫
少女漫画
少年漫画
青年漫画
乙女向
Q版
萌系
热血系
轻小说插画
动画电影风
TV动画风
原画设定风
```

## 摄影视觉

```text
人像摄影
时尚摄影
商业摄影
广告摄影
杂志摄影
电影摄影
纪实摄影
街头摄影
胶片摄影
即时成像
黑白摄影
棚拍
环境人像
婚纱摄影
艺术摄影
超现实摄影
梦幻摄影
静物摄影
产品摄影
建筑摄影
风光摄影
微距摄影
航拍摄影
水下摄影
```

## 3D / CG

```text
3D写实
3D半写实
3D卡通
3D动漫
游戏CG
影视CG
UE写实
UE概念图
Octane渲染感
C4D风
Blender风
雕塑渲染
黏土风
塑料玩具风
毛绒玩具风
手办风
微缩模型风
低多边形
体素
等距3D
NPR非真实感渲染
PBR写实
光线追踪感
```

不得仅凭视觉效果断言图片真正由某软件制作。

例如：

可以：

```text
UE写实感
```

不应：

```text
确定由 Unreal Engine 制作
```

## 东方艺术

```text
中国古典绘画
工笔
写意
青绿山水
白描
水墨
敦煌壁画
岩彩
新国风
国潮
古风
唐风
宋韵
明清绘画感
日本浮世绘
日本传统绘画
韩国传统绘画
东亚古典插画
```

## 西方艺术流派

```text
古典主义
新古典主义
浪漫主义
巴洛克
洛可可
文艺复兴
拉斐尔前派
印象派
后印象派
野兽派
表现主义
象征主义
超现实主义
立体主义
未来主义
达达主义
抽象表现主义
包豪斯
极简主义
波普艺术
欧普艺术
Art Deco
Art Nouveau
```

## 网络视觉审美

```text
蒸汽波
Synthwave
Retrowave
Y2K
Cyber Y2K
Webcore
Dreamcore
Weirdcore
Kidcore
Cottagecore
Fairycore
Angelcore
Goblincore
Dark Academia
Light Academia
Old Money
Coquette
Balletcore
Clean Girl
Soft Girl
E-girl
Grunge
Indie
Frutiger Aero
Frutiger Metro
Liminal Space
Backrooms风
Analog Horror
VHS风
故障艺术
数据损坏风
像素艺术
```

## 平面设计视觉

```text
极简
极繁
瑞士设计
国际主义
新粗野主义
新拟物
玻璃拟态
新拟态
扁平设计
几何设计
复古平面设计
编辑设计
海报设计
拼贴设计
字体主导
信息图
实验视觉
奢侈品牌视觉
潮流视觉
```

---

# 10. SUBJECT — 题材

字段：

```text
subject
```

规则：

```text
1 主
最多 6 辅
```

## 人物

```text
单人肖像
双人肖像
群像
头像
半身人物
全身人物
美人图
英雄人物
反派人物
战士
法师
刺客
骑士
武士
忍者
剑客
侠客
舞者
歌手
偶像
模特
学生
教师
医生
军人
警察
运动员
商人
贵族
王族
皇帝
皇后
公主
王子
神官
修士
祭司
```

## 东方幻想

```text
古风
武侠
仙侠
修仙
东方玄幻
神话
山海经
志怪
妖怪
灵异
神女
仙女
龙族
狐妖
鬼怪
阴阳师
宫廷
江湖
门派
修真宗门
东方神祇
```

## 西方幻想

```text
奇幻
高魔
低魔
黑暗奇幻
史诗奇幻
中世纪奇幻
剑与魔法
精灵
矮人
兽人
女巫
巫师
骑士
巨龙
吸血鬼
狼人
恶魔
天使
妖精
地精
巨人
死灵
地狱
天堂
神话史诗
```

## 科幻

```text
硬科幻
软科幻
太空
星际旅行
太空歌剧
太空殖民
外星文明
外星生物
机器人
仿生人
人工智能
机甲
动力装甲
基因改造
克隆
生化实验
赛博朋克
生物朋克
纳米朋克
柴油朋克
蒸汽朋克
原子朋克
太阳朋克
废土
后末日
末日
灾难
反乌托邦
乌托邦
复古未来
时间旅行
平行宇宙
虚拟现实
元宇宙
```

## 恐怖悬疑

```text
恐怖
心理恐怖
灵异
鬼怪
克苏鲁
宇宙恐怖
身体恐怖
怪谈
都市传说
悬疑
惊悚
犯罪
侦探
黑色电影
神秘学
```

## 现实生活

```text
日常
都市
校园
职场
家庭
恋爱
婚礼
亲子
友情
社交
旅行
购物
美食
咖啡馆
酒吧
音乐
舞蹈
运动
健身
节庆
露营
户外
```

## 时尚商业

```text
高级时装
成衣
街头潮流
美妆
护肤
珠宝
腕表
奢侈品
香水
广告
电商
产品展示
品牌大片
杂志封面
```

## 历史文化

```text
历史人物
古代战争
宫廷
宗教
民俗
民族文化
节日
考古
文物
历史建筑
战争
军事
```

## 自然

```text
山
海
森林
草原
沙漠
湿地
河流
湖泊
瀑布
雪山
冰川
火山
洞穴
星空
极光
云海
花卉
植物
菌类
```

## 生物

```text
猫
狗
马
鸟
猛兽
海洋生物
鱼
昆虫
爬行动物
两栖动物
恐龙
史前生物
幻想生物
怪兽
巨兽
微生物
```

## 建筑空间

```text
城市
街道
村落
室内
家居
商业空间
酒店
餐厅
教堂
寺庙
宫殿
城堡
废墟
工业建筑
未来城市
地下空间
太空站
```

## 器物交通

```text
汽车
摩托
飞机
直升机
火车
船舶
飞船
机甲
武器
冷兵器
枪械
工具
家具
数码设备
```

---

# 11. FORM — 形态

字段：

```text
form
```

最多：

```text
5
```

## 人体

```text
真人
人形
类人
拟人
半人
半兽人
兽人
人鱼
蛇人
鸟人
翼人
精灵
恶魔人形
天使人形
机械人
仿生人
赛博人
半机械人
克隆人
幽灵人形
神祇人形
```

## 身体特征

```text
正常人体
多臂
多眼
多头
单眼
无面
有翼
有角
有尾
有鳞
有甲壳
透明身体
发光身体
液体身体
烟雾身体
能量体
骨骼体
幽灵体
植物化
机械化
晶体化
```

## 动物

```text
四足
双足兽
鸟形
鱼形
蛇形
昆虫形
蜘蛛形
龙形
恐龙形
巨兽
小型生物
```

## 机械

```text
人形机器人
非人机器人
机甲
外骨骼
无人机
机械动物
机械虫
载具
飞行器
太空船
```

## 植物

```text
树木
花朵
藤蔓
菌类
苔藓
植物怪
植物人
巨型植物
```

## 非实体

```text
光体
火焰体
云雾体
粒子体
液态体
阴影体
全息投影
抽象能量体
```

## 无机

```text
几何体
雕塑
器物
建筑
装置
武器
产品
符号
图腾
```

---

# 12. MATERIAL — 材质

最多：

```text
10
```

## 织物

```text
棉
麻
亚麻
羊毛
毛呢
羊绒
丝绸
真丝
缎
锦缎
绸
雪纺
薄纱
欧根纱
网纱
蕾丝
天鹅绒
灯芯绒
牛仔
针织
毛绒
人造毛
皮草
羽绒
PVC布料
反光布
金属纤维
科技面料
```

## 皮革

```text
皮革
牛皮
羊皮
鳄鱼纹
蛇纹
漆皮
麂皮
绒面革
做旧皮革
人造皮革
```

## 金属

```text
金
银
铂
铜
青铜
黄铜
铁
钢
不锈钢
铝
钛
铬
黑铁
镀金
镀银
锈蚀金属
氧化金属
拉丝金属
抛光金属
镜面金属
磨砂金属
```

## 石材矿物

```text
石头
岩石
花岗岩
大理石
石灰岩
黑曜石
玉石
翡翠
玛瑙
水晶
石英
盐晶
矿石
宝石原矿
```

## 宝石珠宝

```text
钻石
水晶
珍珠
红宝石
蓝宝石
祖母绿
紫水晶
黄水晶
欧泊
月光石
琥珀
珊瑚
贝母
珠串
```

## 自然材质

```text
木材
原木
深色木
竹
藤
树皮
枯木
叶片
花瓣
草
苔藓
藤蔓
```

## 陶瓷玻璃

```text
陶
瓷
陶瓷
青瓷
白瓷
玻璃
磨砂玻璃
彩色玻璃
镜子
水晶玻璃
亚克力
树脂
```

## 工业材质

```text
塑料
ABS
PVC
亚克力
橡胶
硅胶
泡沫
复合材料
碳纤维
玻璃纤维
陶瓷复合材料
```

## 生物材质

```text
皮肤
毛发
羽毛
鳞片
甲壳
骨骼
牙齿
角质
肌肉
血肉
黏液
生物膜
```

## 液体

```text
水
油
墨
泥浆
熔岩
血液
荧光液
金属液体
透明液体
```

## 幻想材质

```text
能量
魔法
火焰
冰
雷电
烟雾
云
星尘
粒子
全息
数据流
液态金属
晶体
半透明能量
发光纹理
```

## 表面属性

```text
哑光
半哑光
高光
镜面
半透明
全透明
乳白透明
磨砂
湿润
油亮
金属光泽
珠光
虹彩
镭射
荧光
自发光
粗糙
光滑
颗粒感
磨损
风化
锈蚀
裂纹
烧蚀
沾污
做旧
```

---

# 13. PROPORTION — 比例

## 基础比例

```text
解剖写实
写实比例
半写实比例
风格化比例
理想化比例
超模比例
英雄比例
动漫比例
娃娃比例
Q版比例
怪诞比例
```

## 头身比例

```text
1头身
2头身
3头身
4头身
5头身
6头身
7头身
8头身
9头身
10头身以上
```

## 体型

```text
极瘦
纤细
苗条
修长
匀称
健美
肌肉型
强壮
壮硕
丰满
丰腴
肥胖
巨型
娇小
```

## 局部比例

```text
大头
小头
长脸
短脸
大眼
小眼
长颈
短颈
宽肩
窄肩
长臂
短臂
大手
小手
细腰
宽腰
宽胯
窄胯
长腿
短腿
大脚
小脚
```

## 非人物

```text
等比例
放大
巨物化
缩小
微缩
夸张结构
变形结构
超现实比例
不合逻辑比例
```

---

# 14. VIBE — 气质

最多 6 个。

```text
温柔
柔和
柔美
治愈
亲和
恬静
安静
温暖
清新
纯净
无害感
邻家感

清冷
冷艳
疏离
克制
冷淡
孤高
冷峻
清贵
禁欲
厌世
淡漠

高贵
华贵
奢华
贵族感
王室感
优雅
端庄
古典
精致
雍容
庄重

神秘
空灵
仙气
灵性
神圣
超凡
梦幻
朦胧
幽玄
幻觉感
超现实
不真实感

性感
妩媚
魅惑
风情
成熟
慵懒
冶艳
野性性感

可爱
萌
甜美
甜酷
俏皮
灵动
元气
活泼
少女感
少年感
童趣

英气
帅气
利落
干练
强势
霸气
威严
凌厉
果断
坚毅
英勇
战士感

暗黑
阴郁
哥特
邪魅
邪恶
危险
阴森
恐怖
诡异
疯狂
病态
末日感

文艺
诗意
浪漫
怀旧
复古
松弛
自然
生活感
清雅
禅意

科技感
未来感
赛博感
机械感
人工感
数字感
冷科技
实验感
非人感

专业
商务
学术
职场
街头
潮流
运动
军事
工业
朋克
叛逆
自由
冒险
```

---

# 15. VISUAL AGE — 视觉年龄

必须单选。

```text
新生儿
婴儿
幼儿
学龄前儿童
儿童
少年
青少年
青年
年轻成人
成年
成熟成人
中年
中老年
老年
高龄
不老感
年龄模糊
人偶感无年龄
超自然无年龄
非人不适用
无法判断
```

可另外输出：

```text
0–1
2–4
5–7
8–12
13–15
16–17
18–24
25–34
35–44
45–54
55–64
65–74
75+
```

不得断言精确真实年龄。

---

# 16. ERA — 时代

## 中国视觉时代

```text
史前中国
夏商周风
春秋战国风
秦风
汉风
魏晋南北朝风
隋风
唐风
五代风
宋风
辽金风
元风
明风
清风
晚清风
民国风
共和国早期
1980年代中国
1990年代中国
2000年代中国
当代中国
```

## 日本

```text
绳文风
平安时代风
镰仓时代风
室町时代风
战国时代风
江户时代风
明治时代风
大正浪漫
昭和风
平成风
当代日本
```

## 欧洲

```text
古希腊
古罗马
拜占庭
中世纪早期
中世纪盛期
中世纪晚期
文艺复兴
巴洛克
洛可可
摄政时期
维多利亚时代
爱德华时代
一战时期
二战时期
战后欧洲
```

## 年代

```text
1900s
1910s
1920s
1930s
1940s
1950s
1960s
1970s
1980s
1990s
2000s
2010s
2020s
当代
```

## 架空幻想

```text
原始幻想
古代幻想
东方幻想时代
西方幻想时代
中世纪幻想
文艺复兴幻想
架空古代
架空近代
架空现代
架空未来
魔法工业时代
```

## 科幻

```text
近未来
中未来
远未来
星际时代
太空殖民时代
赛博朋克时代
蒸汽朋克时代
柴油朋克时代
原子朋克时代
太阳朋克时代
废土时代
后末日时代
后人类时代
```

## 无法明确

```text
混合时代
跨时代
历史融合
无时代特征
无法判断
```

---

# 17. GENDER PRESENTATION — 性别呈现

单选。

```text
女性化呈现
强女性化呈现
柔女性化呈现

男性化呈现
强男性化呈现
柔男性化呈现

中性呈现
双性化呈现
去性别化呈现

性别模糊
无明显性别线索
非人角色
无法判断
不适用
```

---

# 18. CLOTHING — 服饰

最多：

```text
12
```

## 功能

```text
日常服
家居服
睡衣
工作服
商务装
正装
礼服
婚礼服
舞台服
制服
校服
军装
运动服
户外服
防护服
战斗服
铠甲
宗教服
仪式服
民族服
历史服
幻想服
科幻服
```

## 东方服饰

```text
汉服
曲裾
直裾
襦裙
齐胸襦裙
齐腰襦裙
圆领袍
褙子
马面裙
袄裙
比甲
道袍
僧袍
武侠服
仙侠服
宫廷服
帝王服
官服
飞鱼服风
古风礼服
东方幻想礼服
敦煌服饰
旗袍
长衫
唐装
和服
浴衣
狩衣
巫女服
忍者服
武士服
韩服
韩式宫廷服
```

## 西方历史

```text
希腊长袍
罗马托加
中世纪长袍
骑士装
文艺复兴服饰
巴洛克服饰
洛可可礼服
摄政时期服饰
维多利亚服饰
爱德华时代服饰
哥特礼服
宫廷礼服
军官礼服
```

## 现代服饰

```text
T恤
Polo衫
衬衫
背心
吊带
针织衫
毛衣
卫衣
夹克
西装
风衣
大衣
羽绒服
皮衣
牛仔外套
棒球夹克
工装夹克

长裤
西裤
牛仔裤
工装裤
运动裤
短裤
热裤

半身裙
短裙
长裙
百褶裙
包臀裙
A字裙

连衣裙
晚礼服
吊带裙
抹胸裙
鱼尾裙
公主裙
连体裤
紧身衣
Bodysuit
```

## 风格

```text
极简
奢华
宫廷
民族
复古
学院
街头
嘻哈
朋克
哥特
Emo
Grunge
洛丽塔
哥特洛丽塔
甜系洛丽塔
古典洛丽塔
Y2K
辣妹
甜酷
机能
工装
军事
户外
Old Money
Quiet Luxury
波西米亚
牛仔西部
未来主义
赛博朋克
蒸汽朋克
废土
```

## 廓形

```text
紧身
修身
合体
宽松
Oversize
茧型
A字型
H型
X型
沙漏型
直筒型
层叠型
不对称型
```

## 领型

```text
圆领
V领
方领
一字领
船领
高领
立领
翻领
西装领
娃娃领
抹胸
深V
交领
```

## 袖型

```text
无袖
短袖
五分袖
七分袖
长袖
泡泡袖
灯笼袖
喇叭袖
宽袖
水袖
紧袖
飘袖
单袖
```

## 长度

```text
超短
短款
及膝
中长
长款
拖地
```

## 特殊结构

```text
开衩
高开衩
前短后长
鱼尾
蓬裙
露肩
单肩
露背
露腰
露腹
露腿
镂空
透视
```

## 装饰

```text
刺绣
印花
提花
蕾丝
荷叶边
褶皱
珠片
亮片
水钻
珍珠
宝石
铆钉
金属链
流苏
羽毛
毛边
绑带
束带
腰封
胸针
徽章
绳结
中国结
盘扣
```

## 头饰

```text
王冠
皇冠
冕冠
发冠
发簪
步摇
钗
发夹
发带
头纱
面纱
帽子
贝雷帽
礼帽
棒球帽
兜帽
头盔
额饰
花环
光环
```

## 珠宝

```text
耳钉
耳环
耳坠
项链
项圈
Choker
胸链
胸针
手链
手镯
臂环
戒指
腰链
脚链
```

## 功能配饰

```text
腰带
手套
护腕
护肩
披肩
披风
斗篷
围巾
面具
眼镜
墨镜
背包
手提包
腰包
武器挂件
```

---

# 19. COMPOSITION — 构图

```text
中心构图
居中构图
对称构图
近对称
三分法
黄金分割
对角线构图
三角构图
S形构图
曲线构图
框架构图
引导线构图
放射构图
重复构图
层次构图
前景遮挡
前景虚化
主体填满画面
大面积留白
负空间
上下分层
左右分割
倾斜构图
开放构图
封闭构图
密集构图
极简构图
视觉中心偏左
视觉中心偏右
```

---

# 20. SHOT SCALE — 景别

单选：

```text
极端特写
特写
近景
胸像
半身
七分身
全身
中景
中远景
远景
大远景
环境人像
微距
```

---

# 21. VIEW ANGLE — 视角

```text
平视
轻俯视
高俯视
鸟瞰

轻仰视
低角度仰视
虫视

正面
四分之三正面
侧面
四分之三背面
背面

顶部视角
底部视角
第一人称
过肩视角
倾斜视角
```

---

# 22. LENS LANGUAGE — 镜头语言

```text
超广角
广角
标准视角
中长焦
长焦
超长焦
微距
鱼眼

浅景深
深景深
前景虚化
背景虚化
奶油散景
旋转散景

压缩空间
广角透视夸张
边缘畸变

运动模糊
拖影

柔焦
梦幻滤镜
镜头光晕
炫光
Bloom
高动态范围
电影镜头感
```

只能判断：

```text
广角感
长焦感
```

不要无证据断言：

```text
85mm f/1.4
```

---

# 23. LIGHTING — 光影

```text
顺光
前侧光
侧光
侧逆光
逆光
顶光
底光

轮廓光
边缘光

蝴蝶光
伦勃朗光
分割光

柔光
硬光
漫射光

窗口光
自然光
棚拍光
环境光

烛光
霓虹光
月光
日落光
晨曦光

黄金时刻
蓝调时刻

体积光
丁达尔光
光束

局部光
聚光灯

高调
低调
高反差
低反差

冷暖混合光
多光源
发光体照明
```

---

# 24. COLOR — 色彩

```text
暖色调
冷色调
中性色调
冷暖对比

单色
邻近色
互补色
分裂互补
三角色
四色配色

高饱和
中饱和
低饱和
柔和色
灰调
莫兰迪

高明度
中明度
低明度

高对比
中对比
低对比

黑金
黑红
蓝紫
青蓝
粉白
金白
红黑
绿金
橙青
紫金

自然色
大地色
糖果色
荧光色
金属色
珠光色
彩虹色
```

允许额外输出：

```yaml
dominant_colors:
  - 青灰
  - 暖金
  - 珠白
```

---

# 25. SCENE — 场景

```text
纯色背景
抽象背景
摄影棚

室内
卧室
客厅
厨房
办公室
教室
实验室
商场
餐厅
咖啡馆
酒吧
舞台

宫殿
城堡
寺庙
教堂
古建筑
庭院

街道
都市
未来都市
贫民区
工业区
工厂
仓库
车站
机场
地下空间
废墟

森林
竹林
花海
草原
沙漠
雪原
雪山
山谷
海边
水下
湖泊
河流
瀑布
洞穴
火山

天空
云海

太空
星空
星球
飞船
空间站

虚拟空间
梦境空间
```

---

# 26. ATMOSPHERE — 环境氛围

```text
晴朗
阴天

薄雾
浓雾
烟雾
蒸汽
尘埃

漂浮颗粒
花瓣
雪花
雨滴
水汽
湿润空气

光尘
星尘
火星
灰烬
烟尘

空气透视
体积雾

散景
光斑
辉光
朦胧

梦境感
神圣感
压抑感
末日感
静谧感
热闹感
孤寂感
```

---

# 27. POSE — 姿态

```text
站立
直立
侧身站立
背身站立

坐姿
侧坐

跪姿
单膝跪

蹲姿

躺姿
侧躺
俯卧
仰卧

靠墙
倚靠

弯腰
前倾
后仰

回眸
转身

抬头
低头
歪头

抱臂
叉腰
手扶脸
托腮
双手交叠

伸手
张臂

动态扭转
舞蹈姿态
战斗姿态
悬浮姿态
```

---

# 28. ACTION — 动作

```text
静止
行走
奔跑
跳跃
飞行
坠落
游泳

舞蹈

战斗
格斗

挥剑
持剑
拔剑
射箭
持枪
施法

祈祷
演奏
唱歌

阅读
写作
喝水
进食

开车
骑乘

拥抱
牵手
挥手
触摸

持花
持伞
持扇

整理头发
回头
注视
奔赴
逃离
```

---

# 29. EXPRESSION — 表情

```text
无表情
平静
淡漠
冷漠
严肃

微笑
浅笑
大笑
温柔
开心
兴奋

俏皮
害羞

忧郁
悲伤
哭泣

愤怒
不悦
厌恶

恐惧
紧张

惊讶
困惑

疲惫
慵懒

妩媚
挑衅

坚定
警觉

危险感
疯狂
病态
神秘

凝视
闭眼
```

只能描述视觉表达。

不要写：

```text
人物真的很悲伤
```

应写：

```text
呈悲伤表情
```

---

# 30. HAIRSTYLE — 发型

## 长度

```text
超短发
短发
中短发
中长发
长发
超长发
```

## 质感

```text
直发
微卷
大卷
波浪卷
自然卷
蓬松发
湿发
凌乱发
```

## 造型

```text
高马尾
低马尾
双马尾
丸子头
双丸子头
盘发
古典盘发
编发
麻花辫
鱼骨辫
脏辫
公主头
半扎发
披发
```

## 分缝刘海

```text
中分
偏分
齐刘海
空气刘海
八字刘海
碎刘海
无刘海
```

## 发色

```text
黑发
深棕发
棕发
金发
白发
银发
灰发
红发
橙发
蓝发
紫发
粉发
绿发
渐变发
挑染
双色发
彩虹发
非自然发色
```

---

# 31. MAKEUP — 妆容

```text
素颜感
裸妆
自然妆
清透妆
日常妆

韩系妆
日系妆
中式古风妆
唐妆

戏曲妆
舞台妆
欧美妆
烟熏妆
哥特妆
暗黑妆
复古妆

时尚妆
杂志妆
未来妆
赛博妆
幻想妆
精灵妆
神女妆
战损妆

哑光底妆
水光肌
珠光肌

红唇
裸色唇
渐变唇
深色唇

眼线突出
浓密睫毛
彩色眼影
珠光眼影
面部彩绘
```

---

# 32. EFFECTS — 特效 / 视觉元素

```text
无明显特效

粒子
漂浮颗粒
光点
光斑
星尘

光环
圣光
光束

魔法阵
符文
能量环
能量波
灵气

火焰
冰霜
雷电
水流
风

烟雾
云雾

花瓣
羽毛
雪花
雨
水珠

晶体
玻璃碎片
破碎效果

爆炸
火花

全息投影
HUD界面
数据流
数字故障

残影
运动拖尾

发光纹路
眼睛发光
武器发光
皮肤发光

空间扭曲
传送门
黑洞

星空
镜像
折射
色散

Bloom
Lens Flare
```

---

# 33. ANALYSIS QUALITY

该字段不用于前端普通筛选。

用于模型质量控制。

```yaml
analysis_quality:

  confidence_overall: 0.0

  visible_evidence:
    - ""

  uncertain_points:
    - ""

  conflicting_tags:
    - ""

  missing_dimensions:
    - ""

  proposed_tags:
    - dimension:
      tag:
      reason:
```

---

# 34. Label Limits

必须遵守：

| Dimension | Limit |
|---|---|
| style | 1 primary + 5 secondary |
| subject | 1 + 6 |
| form | 5 |
| material | 10 |
| proportion | 1 + 4 |
| vibe | max 6 |
| visual_age | 1 |
| era | 1 + 2 |
| gender_presentation | 1 |
| clothing | 12 |
| composition | 6 |
| shot_scale | 1 |
| view_angle | 3 |
| lens_language | 6 |
| lighting | 8 |
| color | 8 |
| scene | 5 |
| atmosphere | 8 |
| pose | 5 |
| action | 5 |
| expression | 4 |
| hairstyle | 6 |
| makeup | 5 |
| effects | 8 |

不要进行：

> tag stuffing

即不要因为某标签“勉强成立”就全部输出。

优先保留：

- 区分度高
- 可检索
- 视觉证据强
- 对图片理解有价值

的标签。

---

# 35. Analysis Workflow

严格按照以下顺序执行。

## STEP 1 — Global Inspection

先观察整张图。

确定：

```text
主体是什么？
有几个主体？
主体占画面的比例？
人物还是环境为主？
背景是否明确？
是否存在多层空间？
是否有明显文字？
```

此时不要急于判断具体标签。

---

## STEP 2 — Subject Detection

输出：

```yaml
primary_subject:
secondary_subjects:
```

例如：

```yaml
primary_subject:
  女性化人形角色

secondary_subjects:
  - 珠宝
  - 薄纱
```

---

## STEP 3 — Visual Language

优先判断：

```text
style
composition
shot_scale
view_angle
lens_language
lighting
color
```

这些维度通常决定整张图最重要的视觉语言。

---

## STEP 4 — Semantic Content

判断：

```text
subject
form
scene
atmosphere
era
```

---

## STEP 5 — Character Analysis

仅人物 / 类人角色分析：

```text
proportion
vibe
visual_age
gender_presentation
clothing
pose
action
expression
hairstyle
makeup
```

非人物主体全部返回：

```text
not_applicable
```

---

## STEP 6 — Surface Analysis

分析：

```text
material
effects
```

---

# 36. Evidence Verification

对于每个：

```text
confidence >= 0.65
```

的重要标签，至少需要一个视觉证据。

例如：

错误：

```yaml
lighting:
  primary: 逆光
  confidence: 0.96
```

正确：

```yaml
lighting:
  primary: 逆光
  confidence: 0.96
  evidence:
    - 主体外轮廓明显发亮
    - 最强光源位于人物后方
```

---

# 37. Conflict Handling

可能出现：

```text
写实 / 动漫
古代 / 未来
柔光 / 硬光
高饱和 / 低饱和
冷色 / 暖色
静止 / 奔跑
平视 / 俯视
```

规则：

### 不同区域造成

允许共存。

例如：

```yaml
lighting:
  secondary:
    - 硬边缘光
    - 柔和环境光
```

### 真正互斥

选择视觉证据最强的一项。

### 无法决定

进入：

```yaml
analysis_quality:
  conflicting_tags:
```

---

# 38. Synonym Normalization

理解自然语言同义词，但最终统一标准标签。

例如：

```yaml
高冷:
  清冷

仙女感:
  仙气

仙气飘飘:
  仙气

电影感:
  电影摄影

CG感:
  游戏CG

梦境:
  梦幻

未来科技:
  未来感

古装:
  历史服饰

高贵感:
  高贵

朦朦胧胧:
  朦胧
```

禁止同时返回：

```text
清冷
高冷
冷淡感
```

应归一成标准标签。

---

# 39. Unknown Policy

以下情况必须允许 `unknown`：

- 图像尺寸过低；
- 人脸过小；
- 严重遮挡；
- 光线极差；
- 信息不存在；
- 两种标签证据几乎相同；
- 图片高度抽象；
- 只有局部区域；
- 无法可靠判断。

Skill 的目标不是：

> 每个字段都有答案。

而是：

> 每个输出答案都有依据。

---

# 40. Proposed Tags

如果发现词表没有的重要概念：

不要直接发明正式分类。

输出：

```yaml
analysis_quality:

  proposed_tags:

    - dimension: style
      tag: 生物机械风
      reason: >
        主体同时包含明显机械结构与有机组织，
        当前 form/material 标签不足以完整表达整体视觉风格。
```

后续由词库维护者决定是否加入正式 taxonomy。

---

# 41. Multi Image Analysis

如果存在多张图片：

每张图必须独立分析。

不得：

> 因为图 1 是唐风，就自动认为图 2 也是唐风。

结构：

```yaml
images:

  image_1:
    dimensions:

  image_2:
    dimensions:
```

---

# 42. Comparison Mode

用户要求比较时额外输出：

```yaml
comparison:

  similarities:
    - ""

  differences:
    - ""

  style_similarity:
    score: 0.0

  subject_similarity:
    score: 0.0

  lighting_similarity:
    score: 0.0

  color_similarity:
    score: 0.0

  composition_similarity:
    score: 0.0

  transferable_features:
    - ""
```

---

# 43. OCR Policy

默认：

> 不做全文 OCR。

只有以下任务开启文字识别：

```text
海报
UI
信息图
文档
商品包装
菜单
网页截图
文字设计
用户明确要求
```

如果文字无法可靠读取：

输出：

```text
文字不可可靠辨认，不猜测。
```

---

# 44. Compact Output

用户要求简单标签时：

```yaml
style:
  - 唯美写实
  - 东方幻想
  - 游戏CG

subject:
  - 东方玄幻
  - 仙侠
  - 人物肖像

lighting:
  - 侧逆光
  - 轮廓光
  - 柔光

color:
  - 低饱和
  - 冷暖对比

vibe:
  - 清冷
  - 空灵
  - 华贵
```

---

# 45. Full Output

默认推荐格式：

```yaml
summary: >
  东方幻想女性角色近景，
  采用唯美写实CG视觉，
  以柔和侧逆光、浅景深和珠光材质形成空灵华贵的画面。

primary_subject:
  女性化人形角色

secondary_subjects:
  - 珠宝
  - 薄纱

dimensions:

  style:
    primary: 唯美写实
    secondary:
      - 东方幻想
      - 游戏CG
      - 梦幻摄影
    confidence: 0.95
    evidence:
      - 面部结构接近写实人物
      - 服饰存在明显幻想化设计
      - 光影具有摄影化虚化效果
    uncertain: false

  subject:
    primary: 东方玄幻
    secondary:
      - 仙侠
      - 人物肖像
    confidence: 0.93
    evidence:
      - 东方古典珠宝
      - 幻想化礼服设计

  form:
    primary: 人形
    secondary:
      - 正常人体
    confidence: 0.99

  material:
    primary: 薄纱
    secondary:
      - 丝绸
      - 金属
      - 珍珠
      - 水晶
      - 半透明
      - 珠光
    confidence: 0.92

  proportion:
    primary: 理想化比例
    secondary:
      - 修长
      - 纤细
    confidence: 0.83

  vibe:
    primary:
      - 清冷
      - 空灵
    secondary:
      - 神秘
      - 仙气
      - 华贵
      - 梦幻
    confidence: 0.94

  visual_age:
    primary: 年轻成人
    secondary: []
    confidence: 0.77

  era:
    primary: 架空古代
    secondary:
      - 东方幻想时代
    confidence: 0.91

  gender_presentation:
    primary: 女性化呈现
    confidence: 0.95

  clothing:
    primary: 东方幻想礼服
    secondary:
      - 仙侠服
      - 抹胸
      - 露肩
      - 薄纱
      - 珍珠
      - 宝石
      - 额饰
    confidence: 0.94

  composition:
    primary: 中心构图
    secondary:
      - 主体填满画面
      - 前景虚化
      - 层次构图
    confidence: 0.96

  shot_scale:
    primary: 近景
    confidence: 0.97

  view_angle:
    primary: 平视
    secondary:
      - 四分之三正面
    confidence: 0.91

  lens_language:
    primary: 浅景深
    secondary:
      - 背景虚化
      - 前景虚化
      - 奶油散景
      - 柔焦
      - Bloom
    confidence: 0.95

  lighting:
    primary: 侧逆光
    secondary:
      - 逆光
      - 轮廓光
      - 柔光
      - 体积光
      - 冷暖混合光
    confidence: 0.96

  color:
    primary: 低饱和
    secondary:
      - 冷暖对比
      - 珠光色
    dominant_colors:
      - 青灰
      - 暖金
      - 珠白
    confidence: 0.93

  scene:
    primary: 梦境空间
    secondary:
      - 抽象背景
    confidence: 0.70

  atmosphere:
    primary: 朦胧
    secondary:
      - 薄雾
      - 漂浮颗粒
      - 光尘
      - 散景
      - 空气透视
      - 梦境感
    confidence: 0.95

  pose:
    primary: 前倾
    secondary:
      - 侧身站立
    confidence: 0.73

  action:
    primary: 注视
    secondary:
      - 静止
    confidence: 0.90

  expression:
    primary: 淡漠
    secondary:
      - 神秘
      - 凝视
    confidence: 0.82

  hairstyle:
    primary: 超长发
    secondary:
      - 黑发
      - 披发
      - 凌乱发
      - 碎刘海
    confidence: 0.96

  makeup:
    primary: 清透妆
    secondary:
      - 自然妆
      - 裸色唇
    confidence: 0.77

  effects:
    primary: 光点
    secondary:
      - 漂浮颗粒
      - 光斑
      - 辉光
      - Bloom
    confidence: 0.94

analysis_quality:

  confidence_overall: 0.91

  visible_evidence:
    - 人物主体清晰
    - 光影特征明显
    - 服饰材质信息丰富

  uncertain_points:
    - 无法确定具体历史朝代
    - 无法确定真实镜头焦段

  conflicting_tags: []

  missing_dimensions: []

  proposed_tags: []
```

---


# 补充执行约束
最具体且证据充分的标签优先；不确定退回上一级视觉描述。相关维度不自动成立，例如汉服不等于唐朝。程序调用按 output-contract.md 返回合法JSON。部分分析按明确目标选择相关维度。提示词反推只使用已分析特征。
