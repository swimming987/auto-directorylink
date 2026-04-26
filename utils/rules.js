const FIELD_RULES = {
  name: {
    keywords: ['name', 'title', 'product name', 'site name', 'tool name', 'app name', 'project name', '名称', '名字', '产品名', '网站名'],
    weight: 1.0
  },
  url: {
    keywords: ['website url', 'site url', 'homepage', 'web address', 'tool url', 'product url', 'project url', 'url', 'website', '官网', '网址', '产品地址'],
    weight: 1.0
  },
  blogUrl: {
    keywords: ['blog url', 'blog link', 'blog page', 'blog', 'article page', 'news page', '博客地址', '博客链接', '博客'],
    weight: 1.0
  },
  email: {
    keywords: ['email', 'mail', 'contact', 'e-mail', '邮箱', '邮件', '联系'],
    weight: 1.0
  },
  yourName: {
    keywords: ['your name', 'contact name', 'submitter name', 'author name', 'full name', '姓名', '联系人', '你的名字', '您的姓名'],
    weight: 1.0
  },
  yourEmail: {
    keywords: ['your email', 'contact email', 'submitter email', 'author email', 'email address', '联系人邮箱', '你的邮箱', '您的邮箱'],
    weight: 1.0
  },
  icon: {
    keywords: ['icon', 'logo', 'favicon', 'avatar', 'thumbnail', '图标', 'logo url', 'icon url'],
    weight: 0.9
  },
  screenshot: {
    keywords: ['screenshot', 'preview', 'image', 'cover', 'banner', 'photo', '截图', '预览图', '封面', '图片'],
    weight: 0.9
  },
  launchDate: {
    keywords: ['launch date', 'release date', 'published date', 'launch', 'release', 'published', 'created date', 'founded date', '发布日期', '上线日期', '发布时间'],
    weight: 0.85
  },
  shortDescription: {
    keywords: ['short description', 'brief', 'summary', 'excerpt', 'intro', 'short desc', 'short_desc', 'brief description', '简介', '简短描述', '摘要'],
    weight: 1.0
  },
  longDescription: {
    keywords: ['description', 'long description', 'detail', 'content', 'about', 'full description', 'long_desc', '详细描述', '详情', '描述', '内容'],
    weight: 0.95
  },
  tagline: {
    keywords: ['tagline', 'tag line', 'headline', 'subtitle', 'subheading', '标语', '标题语', '口号'],
    weight: 0.9
  },
  slogan: {
    keywords: ['slogan', 'motto', 'catchphrase', 'punch line', '口号', '标语', '宣传语'],
    weight: 0.85
  },
  useCase: {
    keywords: ['use case', 'usecase', 'scenario', 'application scenario', 'best for', 'ideal for', '适用场景', '使用场景', '应用场景', '适合人群'],
    weight: 0.9
  },
  categories: {
    keywords: ['category', 'categories', 'tag', 'tags', 'topic', 'type', 'genre', '分类', '标签', '类别', '类型'],
    weight: 1.0
  },
  priceModel: {
    keywords: ['price model', 'pricing', 'price type', 'payment', 'plan', 'tier', '定价', '价格模型', '收费方式', '付费', '免费'],
    weight: 0.95
  },
  lowestPrice: {
    keywords: ['price', 'cost', 'fee', 'amount', 'starting price', 'lowest price', 'min price', '价格', '最低价', '费用', '起始价'],
    weight: 0.9
  }
};

const CONFIDENCE_THRESHOLD = 0.6;

function scoreField(fieldKey, signals) {
  const rule = FIELD_RULES[fieldKey];
  if (!rule) return 0;

  const text = signals.join(' ').toLowerCase();
  let maxScore = 0;

  for (const keyword of rule.keywords) {
    if (text === keyword) {
      maxScore = Math.max(maxScore, 1.0);
    } else if (text.includes(keyword)) {
      const lengthPenalty = keyword.length / Math.max(text.length, keyword.length);
      maxScore = Math.max(maxScore, 0.7 + lengthPenalty * 0.3);
    }
  }

  return maxScore * rule.weight;
}

function matchByRules(signals) {
  const scores = {};
  for (const fieldKey of Object.keys(FIELD_RULES)) {
    scores[fieldKey] = scoreField(fieldKey, signals);
  }

  let bestField = null;
  let bestScore = 0;
  for (const [field, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestField = field;
    }
  }

  return { field: bestField, confidence: bestScore, source: 'rule' };
}
