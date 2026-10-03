const ATLAS = {
  "taxonomy": [
    {
      "id": "style",
      "name": "画风",
      "description": "画风与表现方式",
      "groups": [
        {
          "name": "摄影写实",
          "values": [
            "真人摄影",
            "电影写实",
            "商业棚拍",
            "胶片复古",
            "奇幻写实"
          ]
        },
        {
          "name": "动漫漫画",
          "values": [
            "日系赛璐璐",
            "复古日漫",
            "黑白漫画",
            "国风动漫",
            "美式漫画",
            "清线漫画"
          ]
        },
        {
          "name": "卡通插画",
          "values": [
            "二维卡通",
            "几何卡通",
            "扁平矢量",
            "涂鸦插画",
            "儿童绘本",
            "极简线描"
          ]
        },
        {
          "name": "三维游戏",
          "values": [
            "3D卡通",
            "3D半写实",
            "3D写实",
            "三渲二",
            "低多边形",
            "体素",
            "潮玩3D"
          ]
        },
        {
          "name": "绘画媒介",
          "values": [
            "数字厚涂",
            "水彩",
            "水粉",
            "油画",
            "水墨",
            "工笔",
            "版画",
            "彩铅"
          ]
        },
        {
          "name": "手工视觉",
          "values": [
            "黏土定格",
            "毛绒玩偶",
            "羊毛毡",
            "剪纸",
            "木偶"
          ]
        },
        {
          "name": "实验混合",
          "values": [
            "像素艺术",
            "拼贴",
            "故障艺术",
            "超现实",
            "漫画与3D混合"
          ]
        }
      ]
    },
    {
      "id": "theme",
      "name": "题材",
      "description": "世界观与叙事环境",
      "groups": [
        {
          "name": "东方",
          "values": [
            "武侠",
            "仙侠",
            "东方神话",
            "民俗志怪",
            "新中式"
          ]
        },
        {
          "name": "幻想",
          "values": [
            "史诗奇幻",
            "黑暗奇幻",
            "森林童话",
            "哥特"
          ]
        },
        {
          "name": "科幻",
          "values": [
            "赛博朋克",
            "蒸汽朋克",
            "太阳朋克",
            "太空科幻",
            "末日废土"
          ]
        },
        {
          "name": "现实",
          "values": [
            "都市日常",
            "校园",
            "职场",
            "街头潮流"
          ]
        }
      ]
    },
    {
      "id": "form",
      "name": "形态",
      "description": "角色的物种与结构",
      "groups": [
        {
          "name": "角色形态",
          "values": [
            "人类",
            "精灵",
            "拟人动物",
            "写实动物",
            "机器人",
            "机甲",
            "异兽",
            "植物拟人",
            "物品拟人",
            "抽象生命"
          ]
        }
      ]
    },
    {
      "id": "material",
      "name": "材质",
      "description": "表面与材料表现",
      "groups": [
        {
          "name": "材料",
          "values": [
            "皮肤",
            "毛绒",
            "黏土",
            "羊毛毡",
            "织物",
            "木材",
            "陶瓷",
            "树脂",
            "金属",
            "玻璃",
            "纸张"
          ]
        }
      ]
    },
    {
      "id": "proportion",
      "name": "比例",
      "description": "身体比例与造型",
      "groups": [
        {
          "name": "比例",
          "values": [
            "真实比例",
            "修长比例",
            "Q版",
            "大头短身",
            "几何简化",
            "夸张体块"
          ]
        }
      ]
    },
    {
      "id": "mood",
      "name": "气质",
      "description": "角色传递的感受",
      "groups": [
        {
          "name": "气质",
          "values": [
            "治愈",
            "温柔",
            "活泼",
            "冷峻",
            "神秘",
            "威严",
            "怪诞",
            "呆萌",
            "勇敢"
          ]
        }
      ]
    },
    {
      "id": "use",
      "name": "用途",
      "description": "角色的应用场景",
      "groups": [
        {
          "name": "应用",
          "values": [
            "品牌IP",
            "动画",
            "游戏",
            "绘本",
            "虚拟人",
            "潮玩",
            "表情包",
            "广告"
          ]
        }
      ]
    },
    {
      "id": "age",
      "name": "年龄阶段",
      "description": "角色外观表现的年龄阶段，包含独立的儿童标签",
      "groups": [
        {
          "name": "外观阶段",
          "values": [
            "婴幼儿",
            "儿童",
            "青少年",
            "青年",
            "中年",
            "老年",
            "无法判断"
          ]
        }
      ]
    },
    {
      "id": "era",
      "name": "时代",
      "description": "服饰、装备与角色设定体现的时代",
      "groups": [
        {
          "name": "历史时代",
          "values": [
            "秦汉",
            "唐代",
            "宋代",
            "明代",
            "清代",
            "民国",
            "中世纪",
            "文艺复兴",
            "维多利亚"
          ]
        },
        {
          "name": "现代与架空",
          "values": [
            "现代",
            "近未来",
            "遥远未来",
            "架空时代",
            "无法判断"
          ]
        }
      ]
    },
    {
      "id": "gender",
      "name": "性别",
      "description": "角色设定中的性别；真人图片不推测性别认同，无法判断可留空",
      "groups": [
        {
          "name": "角色设定",
          "values": [
            "男性",
            "女性",
            "中性",
            "无性别设定",
            "无法判断"
          ]
        }
      ]
    }
  ],
  "roles": [
    {
      "id": "AST-CHAR-001",
      "name": "绒绒",
      "en": "RONGRONG",
      "description": "一只认真收集好心情的毛绒兔子。",
      "classification": {
        "style": "毛绒玩偶",
        "theme": "森林童话",
        "form": "拟人动物",
        "material": "毛绒",
        "proportion": "大头短身",
        "mood": "治愈",
        "use": "品牌IP",
        "age": "无法判断",
        "era": "无法判断",
        "gender": "无性别设定"
      },
      "projectId": "PRJ-001",
      "tile": 0,
      "invariants": [
        "柔软垂耳",
        "橙色围巾",
        "奶白色绒毛"
      ],
      "notes": "面部保持简洁；围巾作为核心识别物，避免增加装饰。",
      "missingViews": [
        "正面",
        "侧面",
        "背面",
        "表情组"
      ],
      "version": "v001",
      "status": "概念草案",
      "sample": true,
      "updated": "2026-10-03",
      "referenceStatus": "AI示意图 · 待确认",
      "generationRecords": [],
      "tags": [
        {
          "dimension": "style",
          "name": "毛绒玩偶",
          "source": "builtin"
        },
        {
          "dimension": "theme",
          "name": "森林童话",
          "source": "builtin"
        },
        {
          "dimension": "form",
          "name": "拟人动物",
          "source": "builtin"
        },
        {
          "dimension": "material",
          "name": "毛绒",
          "source": "builtin"
        },
        {
          "dimension": "proportion",
          "name": "大头短身",
          "source": "builtin"
        },
        {
          "dimension": "mood",
          "name": "治愈",
          "source": "builtin"
        },
        {
          "dimension": "use",
          "name": "品牌IP",
          "source": "builtin"
        },
        {
          "dimension": "age",
          "name": "无法判断",
          "source": "builtin"
        },
        {
          "dimension": "era",
          "name": "无法判断",
          "source": "builtin"
        },
        {
          "dimension": "gender",
          "name": "无性别设定",
          "source": "builtin"
        }
      ]
    },
    {
      "id": "AST-CHAR-002",
      "name": "青岚",
      "en": "QINGLAN",
      "description": "游历山川的年轻剑客，以青色长袍和沉静神态识别。",
      "classification": {
        "style": "数字厚涂",
        "theme": "仙侠",
        "form": "人类",
        "material": "织物",
        "proportion": "修长比例",
        "mood": "冷峻",
        "use": "游戏",
        "age": "青年",
        "era": "架空时代",
        "gender": "女性"
      },
      "projectId": "PRJ-002",
      "tile": 1,
      "invariants": [
        "青色长袍",
        "黑色长发",
        "简洁金属发饰"
      ],
      "notes": "保持服装层次和主色；兵器细节与动作设定待补充。",
      "missingViews": [
        "全身正面",
        "侧面",
        "背面",
        "配饰细节"
      ],
      "version": "v001",
      "status": "概念草案",
      "sample": true,
      "updated": "2026-10-03",
      "referenceStatus": "AI示意图 · 待确认",
      "generationRecords": [],
      "tags": [
        {
          "dimension": "style",
          "name": "数字厚涂",
          "source": "builtin"
        },
        {
          "dimension": "theme",
          "name": "仙侠",
          "source": "builtin"
        },
        {
          "dimension": "form",
          "name": "人类",
          "source": "builtin"
        },
        {
          "dimension": "material",
          "name": "织物",
          "source": "builtin"
        },
        {
          "dimension": "proportion",
          "name": "修长比例",
          "source": "builtin"
        },
        {
          "dimension": "mood",
          "name": "冷峻",
          "source": "builtin"
        },
        {
          "dimension": "use",
          "name": "游戏",
          "source": "builtin"
        },
        {
          "dimension": "age",
          "name": "青年",
          "source": "builtin"
        },
        {
          "dimension": "era",
          "name": "架空时代",
          "source": "builtin"
        },
        {
          "dimension": "gender",
          "name": "女性",
          "source": "builtin"
        }
      ]
    },
    {
      "id": "AST-CHAR-003",
      "name": "零号",
      "en": "UNIT ZERO",
      "description": "面向未来城市的仿生导航员，结构精密而克制。",
      "classification": {
        "style": "3D写实",
        "theme": "太空科幻",
        "form": "机器人",
        "material": "金属",
        "proportion": "真实比例",
        "mood": "神秘",
        "use": "虚拟人",
        "age": "无法判断",
        "era": "遥远未来",
        "gender": "无性别设定"
      },
      "projectId": "PRJ-003",
      "tile": 2,
      "invariants": [
        "银色装甲",
        "青蓝发光部件",
        "清晰机械分件"
      ],
      "notes": "固定头部外壳与肩部结构；发光区不替代真实的结构细节。",
      "missingViews": [
        "全身",
        "关节结构",
        "材质板",
        "面部细节"
      ],
      "version": "v001",
      "status": "概念草案",
      "sample": true,
      "updated": "2026-10-03",
      "referenceStatus": "AI示意图 · 待确认",
      "generationRecords": [],
      "tags": [
        {
          "dimension": "style",
          "name": "3D写实",
          "source": "builtin"
        },
        {
          "dimension": "theme",
          "name": "太空科幻",
          "source": "builtin"
        },
        {
          "dimension": "form",
          "name": "机器人",
          "source": "builtin"
        },
        {
          "dimension": "material",
          "name": "金属",
          "source": "builtin"
        },
        {
          "dimension": "proportion",
          "name": "真实比例",
          "source": "builtin"
        },
        {
          "dimension": "mood",
          "name": "神秘",
          "source": "builtin"
        },
        {
          "dimension": "use",
          "name": "虚拟人",
          "source": "builtin"
        },
        {
          "dimension": "age",
          "name": "无法判断",
          "source": "builtin"
        },
        {
          "dimension": "era",
          "name": "遥远未来",
          "source": "builtin"
        },
        {
          "dimension": "gender",
          "name": "无性别设定",
          "source": "builtin"
        }
      ]
    },
    {
      "id": "AST-CHAR-004",
      "name": "赤尾",
      "en": "RUST",
      "description": "带着旅行装备探索未知森林的狐狸伙伴。",
      "classification": {
        "style": "3D卡通",
        "theme": "森林童话",
        "form": "拟人动物",
        "material": "毛绒",
        "proportion": "夸张体块",
        "mood": "活泼",
        "use": "动画",
        "age": "无法判断",
        "era": "无法判断",
        "gender": "无性别设定"
      },
      "projectId": "PRJ-001",
      "tile": 3,
      "invariants": [
        "橙色毛发",
        "大耳朵",
        "探险装束"
      ],
      "notes": "保持耳部轮廓；后续补充尾巴形态与全身比例设定。",
      "missingViews": [
        "全身",
        "侧面",
        "背面",
        "动作组"
      ],
      "version": "v001",
      "status": "概念草案",
      "sample": true,
      "updated": "2026-10-03",
      "referenceStatus": "AI示意图 · 待确认",
      "generationRecords": [],
      "tags": [
        {
          "dimension": "style",
          "name": "3D卡通",
          "source": "builtin"
        },
        {
          "dimension": "theme",
          "name": "森林童话",
          "source": "builtin"
        },
        {
          "dimension": "form",
          "name": "拟人动物",
          "source": "builtin"
        },
        {
          "dimension": "material",
          "name": "毛绒",
          "source": "builtin"
        },
        {
          "dimension": "proportion",
          "name": "夸张体块",
          "source": "builtin"
        },
        {
          "dimension": "mood",
          "name": "活泼",
          "source": "builtin"
        },
        {
          "dimension": "use",
          "name": "动画",
          "source": "builtin"
        },
        {
          "dimension": "age",
          "name": "无法判断",
          "source": "builtin"
        },
        {
          "dimension": "era",
          "name": "无法判断",
          "source": "builtin"
        },
        {
          "dimension": "gender",
          "name": "无性别设定",
          "source": "builtin"
        }
      ]
    },
    {
      "id": "AST-CHAR-005",
      "name": "白露",
      "en": "BAILU",
      "description": "热爱飞行的年轻驾驶员，用亮橙色飞行夹克表达行动力。",
      "classification": {
        "style": "日系赛璐璐",
        "theme": "太空科幻",
        "form": "人类",
        "material": "织物",
        "proportion": "真实比例",
        "mood": "勇敢",
        "use": "动画",
        "age": "青年",
        "era": "遥远未来",
        "gender": "女性"
      },
      "projectId": "PRJ-003",
      "tile": 4,
      "invariants": [
        "白色短发",
        "橙色飞行夹克",
        "清晰眼部轮廓"
      ],
      "notes": "控制阴影色阶；固定发型轮廓和夹克色块位置。",
      "missingViews": [
        "全身",
        "侧面",
        "表情组",
        "装备设定"
      ],
      "version": "v001",
      "status": "概念草案",
      "sample": true,
      "updated": "2026-10-03",
      "referenceStatus": "AI示意图 · 待确认",
      "generationRecords": [],
      "tags": [
        {
          "dimension": "style",
          "name": "日系赛璐璐",
          "source": "builtin"
        },
        {
          "dimension": "theme",
          "name": "太空科幻",
          "source": "builtin"
        },
        {
          "dimension": "form",
          "name": "人类",
          "source": "builtin"
        },
        {
          "dimension": "material",
          "name": "织物",
          "source": "builtin"
        },
        {
          "dimension": "proportion",
          "name": "真实比例",
          "source": "builtin"
        },
        {
          "dimension": "mood",
          "name": "勇敢",
          "source": "builtin"
        },
        {
          "dimension": "use",
          "name": "动画",
          "source": "builtin"
        },
        {
          "dimension": "age",
          "name": "青年",
          "source": "builtin"
        },
        {
          "dimension": "era",
          "name": "遥远未来",
          "source": "builtin"
        },
        {
          "dimension": "gender",
          "name": "女性",
          "source": "builtin"
        }
      ]
    },
    {
      "id": "AST-CHAR-006",
      "name": "苔老",
      "en": "MOSSKEEPER",
      "description": "一位守护林间小路的蘑菇长者。",
      "classification": {
        "style": "水彩",
        "theme": "森林童话",
        "form": "植物拟人",
        "material": "纸张",
        "proportion": "Q版",
        "mood": "温柔",
        "use": "绘本",
        "age": "老年",
        "era": "架空时代",
        "gender": "男性"
      },
      "projectId": "PRJ-002",
      "tile": 5,
      "invariants": [
        "蘑菇帽冠",
        "苍老面部",
        "苔绿色服饰"
      ],
      "notes": "保留纸张与水彩边缘；蘑菇帽轮廓作为身份特征。",
      "missingViews": [
        "全身",
        "侧面",
        "表情组",
        "配色板"
      ],
      "version": "v001",
      "status": "概念草案",
      "sample": true,
      "updated": "2026-10-03",
      "referenceStatus": "AI示意图 · 待确认",
      "generationRecords": [],
      "tags": [
        {
          "dimension": "style",
          "name": "水彩",
          "source": "builtin"
        },
        {
          "dimension": "theme",
          "name": "森林童话",
          "source": "builtin"
        },
        {
          "dimension": "form",
          "name": "植物拟人",
          "source": "builtin"
        },
        {
          "dimension": "material",
          "name": "纸张",
          "source": "builtin"
        },
        {
          "dimension": "proportion",
          "name": "Q版",
          "source": "builtin"
        },
        {
          "dimension": "mood",
          "name": "温柔",
          "source": "builtin"
        },
        {
          "dimension": "use",
          "name": "绘本",
          "source": "builtin"
        },
        {
          "dimension": "age",
          "name": "老年",
          "source": "builtin"
        },
        {
          "dimension": "era",
          "name": "架空时代",
          "source": "builtin"
        },
        {
          "dimension": "gender",
          "name": "男性",
          "source": "builtin"
        }
      ]
    }
  ],
  "projects": [
    {
      "id": "PRJ-001",
      "name": "森林伙伴计划",
      "description": "探索毛绒与卡通角色的品牌表达。",
      "color": "#d8874d",
      "deliverables": "角色设定 · 品牌IP"
    },
    {
      "id": "PRJ-002",
      "name": "东方与自然叙事",
      "description": "研究绘画媒介中的幻想人物与自然角色。",
      "color": "#67b29c",
      "deliverables": "角色原画 · 绘本概念"
    },
    {
      "id": "PRJ-003",
      "name": "未来航行档案",
      "description": "比较写实机械与动漫人物的科幻视觉语言。",
      "color": "#9892e2",
      "deliverables": "数字角色 · 动画概念"
    }
  ]
};
