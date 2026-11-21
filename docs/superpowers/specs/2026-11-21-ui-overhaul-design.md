# 全站界面优化设计

用户范围：所有页面与交互，避免通用AI模板感，采用真实组件规范与现有Vue技术栈。由设计技能生成完整首页、图鉴与对局参考；代码必须使用真实卡牌数据，不能复制概念图错误的角色编号、数值或卡面文字。

## 方案与取舍

保留Vue3/Vite/Pinia/Tailwind，不迁移React、不引入大体积整套主题库。采用Reka UI的无样式Dialog/Tabs处理复杂可访问交互，普通按钮/输入/选择器用原生HTML；图标使用Lucide官方当前Vue包 @lucide/vue。外观通过同一套语义tokens统一，而非到处覆盖硬编码颜色。

## 视觉参考

- 首页：/Users/tano/.codex/generated_images/01a1fd0d-4eb3-70b0-b4ee-b8abba6c2658/exec-0b063bd9-1aa9-4db1-a98b-1a8bf619ec63.png
- 图鉴：/Users/tano/.codex/generated_images/01a1fd0d-4eb3-70b0-b4ee-b8abba6c2658/exec-85d017d6-371e-477f-ae5b-2b6ca9861006.png
- 对局：/Users/tano/.codex/generated_images/01a1fd0d-4eb3-70b0-b4ee-b8abba6c2658/exec-0a118232-b32e-468e-9b7e-bab3a9426a9d.png

## 设计系统

画布 #f6f5f1、表面 #ffffff、主文字 #292622、次文字 #706e68、边线 #dedbd4、主色 #c93449（从概念色 #d93c50 加深，以满足文字对比度）。对应tokens --bg-primary/--bg-secondary/--surface/--text/--text-dim/--border/--accent，兼容旧组件变量。圆角8px，间距4/8/12/16/24/32/48/64，控件最小44px，正文15px/1.65；系统CJK字体，不加载远程字体。只使用轻微阴影，去掉大面积渐变、发光、玻璃效果、装饰徽章。小屏320起适配。

## 页面与交互

- 首页：安静导航、左侧标题/简短玩法/开始对战和浏览卡牌，右侧五张真实卡牌扇形陈列；下方10乐队名单。测试工具仅开发环境可见，移除伪密码prompt。
- 选模式：3个真实可用模式，清晰人数/行动按钮，无未实现PVP占位。
- 图鉴：6类完整数据，桌面左侧乐队筛选、搜索/排序、5列紧凑卡牌展柜；小屏筛选换行/滚动与2列/1列适配。技能细节放入可键盘和触摸打开的详情弹窗。保持50/28/74/21/13数量，同名不同效果蘑菇不合并，显示空结果状态。
- 对局：保留所有现有操作流，中心上下各5角色槽，左右引导/日志，小屏折叠为流式布局。手牌横向可滚动，不旋转遮挡正文。阶段和主动作明确，loading禁止重复提交。结束对局、出牌、卡牌详情均有可访问弹窗。
- 共享AppDialog用Reka，提供焦点限制、Esc、关闭按钮、标题/描述、关闭焦点恢复；CardPreviewDialog统一所有卡牌详情；CardView选牌与查看为独立原生按钮，不能只靠hover。
- 所有页具备可见focus、语义控件/标签、状态反馈、reduced-motion；路由用defineAsyncComponent分包，首页不导入完整图鉴数据。
- 保留V1.9 WebP和缩略图懒加载，不能重新引入PNG或外部大图。

## 验证

前端构建、桌面1440x1000/1280x800、平板768、小屏390/320：首页→选模式→真实开局→摸牌/选择/确认/结束回合；图鉴分类/搜索/详情；键盘Tab/Esc/焦点恢复；无空白、溢出、console错误/404，网络仍加载WebP。执行概念/实现截图对照并修复具体差异。

## 来源

- https://vuejs.org/guide/best-practices/performance
- https://vuejs.org/guide/best-practices/accessibility.html
- https://reka-ui.com/docs/components/dialog
- https://reka-ui.com/docs/components/tabs
- https://lucide.dev/guide/vue/getting-started
