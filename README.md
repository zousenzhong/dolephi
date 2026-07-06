# Dolephi 官网部署指南

## 项目结构

```
dolephi-website/
├── index.html              # 主页（含新闻板块 + 防仿站代码）
├── news.html               # 新闻列表页 + 文章详情页 + Giscus评论
├── i18n.js                 # 5种语言翻译（EN/ES/FR/AR/RU）
├── i18n-extra.js           # 25种额外语言翻译
├── _headers                # Cloudflare Pages 安全头配置
├── _redirects              # URL 路由规则
├── admin/
│   ├── index.html          # Decap CMS 管理后台入口
│   └── config.yml          # Decap CMS 配置文件
├── content/
│   ├── news/               # 新闻 Markdown 文件目录
│   │   ├── 2026-06-28-walk-in-nano-coating-launch.md
│   │   ├── 2026-06-15-factory-expansion.md
│   │   └── 2026-05-20-ish-frankfurt-2026.md
│   ├── assets/             # 新闻图片上传目录（CMS自动使用）
│   └── settings/
│       └── general.json    # 网站通用设置
└── README.md               # 本文件
```

---

## 部署步骤

### 第一步：注册 GitHub 账号并创建仓库

1. 访问 https://github.com 注册账号（免费）
2. 点击右上角 `+` → `New repository`
3. 仓库名称填 `dolephi-website`
4. 选择 `Public`（免费版需要公开仓库）
5. 勾选 `Add a README file`
6. 点击 `Create repository`

### 第二步：上传项目文件

将本目录下所有文件和文件夹上传到 GitHub 仓库。

**方法一：通过 GitHub 网页上传**
1. 在仓库页面点击 `Add file` → `Upload files`
2. 将所有文件拖入（注意保持目录结构）

**方法二：通过 Git 命令行上传**
```bash
git clone https://github.com/你的用户名/dolephi-website.git
# 将项目文件复制到克隆的目录中
cd dolephi-website
git add .
git commit -m "Initial commit - Dolephi website with CMS"
git push origin main
```

### 第三步：配置 Cloudflare Pages

1. 访问 https://dash.cloudflare.com 注册/登录（免费）
2. 左侧菜单选择 `Workers & Pages`
3. 点击 `Create application` → `Pages` → `Connect to Git`
4. 授权 Cloudflare 访问你的 GitHub
5. 选择 `dolephi-website` 仓库
6. 构建设置：
   - **Framework preset:** None
   - **Build command:** （留空）
   - **Build output directory:** `/`（根目录）
   - **Root directory:** `/`
7. 点击 `Save and Deploy`
8. 等待 1-2 分钟，部署完成后获得 `xxx.pages.dev` 域名

### 第四步：配置 Decap CMS 后台

#### 4.1 创建 GitHub OAuth App

1. 访问 https://github.com/settings/applications/new
2. 填写：
   - **Application name:** Dolephi CMS
   - **Homepage URL:** `https://你的域名.pages.dev`
   - **Authorization callback URL:** `https://api.decapcms.org/oauth/callback`
3. 创建后获取 **Client ID**
4. 点击 `Generate a new client secret` 获取 **Client Secret**

#### 4.2 配置 Decap OAuth

Decap CMS 需要一个 OAuth 代理服务。推荐使用现成的免费服务：

**方法 A：使用 Netlify OAuth（最简单）**
1. 访问 https://app.netlify.com 注册
2. 创建一个新站点 → 部署后面的 OAuth 代理
3. 或者直接使用 `https://api.decapcms.org/oauth/callback`

**方法 B：使用 Cloudflare Worker 自建 OAuth 代理**
1. 参考 https://github.com/decaporg/decap-cms-oauth-provider-go
2. 部署到 Cloudflare Workers

#### 4.3 更新 admin/config.yml

打开 `admin/config.yml`，修改：
```yaml
backend:
  name: github
  repo: 你的用户名/dolephi-website  # ← 改成你的仓库
  branch: main
```

#### 4.4 访问后台

部署完成后访问 `https://你的域名/pages.dev/admin/`，用 GitHub 账号登录即可编辑新闻。

### 第五步：配置 Giscus 评论

#### 5.1 启用 GitHub Discussions

1. 进入你的 GitHub 仓库
2. 点击 `Settings` → 勾选 `Discussions`
3. 创建一个 Category 名为 `News Comments`（Announcements 类型）

#### 5.2 获取 Giscus 配置

1. 访问 https://giscus.app
2. 填入仓库名 → 启用 Discussions
3. 选择映射方式：`specific`（按文章路径映射）
4. 选择分类：`News Comments`
5. 页面底部会生成 `data-repo-id` 和 `data-category-id`

#### 5.3 更新 news.html

打开 `news.html`，找到 `GISCUS_CONFIG`，填入：
```javascript
var GISCUS_CONFIG = {
  repo: "你的用户名/dolephi-website",
  repoId: "你的repo-id",        // ← 从 giscus.app 获取
  category: "News Comments",
  categoryId: "你的category-id"  // ← 从 giscus.app 获取
};
```

### 第六步：绑定自定义域名（可选）

1. 在 Cloudflare Pages 项目设置中 → `Custom domains`
2. 添加你的域名（如 `www.dolephi-factory.com`）
3. 按提示添加 CNAME 记录
4. SSL 证书自动签发

---

## 日常使用

### 发布新闻

1. 访问 `https://你的域名/admin/`
2. 用 GitHub 登录
3. 点击 `News & Updates` → `New News Article`
4. 填写标题、日期、分类、摘要、正文（Markdown格式）
5. 点击 `Publish` → 自动提交到 GitHub → Cloudflare 自动重新部署
6. 1-2 分钟后新闻上线

### 编辑现有新闻

1. 在 CMS 后台点击已有文章
2. 修改内容 → 点击 `Publish`
3. 自动部署更新

### 管理评论

- 评论存储在 GitHub Discussions 中
- 可在 GitHub 仓库的 Discussions 页面管理（删除/置顶/回复）
- 评论者需要 GitHub 账号（B2B场景下可过滤水军）

---

## 防仿站措施

已内置以下防护（在 index.html 中）：

| 措施 | 说明 |
|------|------|
| 禁用右键菜单 | 阻止查看源代码和保存图片 |
| 禁用 F12 / Ctrl+Shift+I | 阻止打开开发者工具 |
| 禁用 Ctrl+U | 阻止查看页面源代码 |
| 禁用文本选择 | 防止复制文字内容 |
| 禁用拖拽 | 防止拖拽图片到新标签页 |
| X-Frame-Options: DENY | 防止被嵌入 iframe（_headers文件） |
| CSP 安全头 | 限制资源加载来源（_headers文件） |
| Cloudflare Bot 防护 | 在 Cloudflare 控制台开启（免费） |

**额外建议：**
- 产品图片加品牌水印
- 注册 Dolephi 商标
- Footer 版权声明已包含

---

## 技术支持

如遇问题请检查：
1. GitHub 仓库文件是否完整
2. Cloudflare Pages 部署日志
3. admin/config.yml 中的仓库名是否正确
4. news.html 中 GISCUS_CONFIG 是否填写了 repoId 和 categoryId
