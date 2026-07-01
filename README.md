# 怪物猎人点怪机

## 项目简介
这是一个用于直播怪物猎人时的弹幕互动工具，支持 **B站 / 抖音** 直播间。观众可以通过发送特定格式的弹幕来"点怪"，主播可以按照弹幕队列顺序进行挑战。

***写着玩的，暂时只整合了荒野的图标，其它版本的请自行添加***
> 如果你有更好的想法或比较完善的怪物列表，欢迎提issue或pr

## 主要功能
- 接收 B站 / 抖音 弹幕排队点怪（新增渠道只需实现一个处理器，见 `src/channels/`）
- 可自行添加与移除怪物
- 支持对点怪的粉丝牌/舰长等级进行限制（B站）
- 支持导出/导入怪物列表，可导出后分享给他人

![image](https://github.com/user-attachments/assets/213fb1ca-c784-4a62-a594-765c664c61c3)

## 快速开始
前往[发布列表](https://github.com/yawntee/mhw-combat-queue/releases)下载

## 使用说明
1. 选择渠道（B站 / 抖音），输入直播间号或链接
2. 登录：B站扫码登录；抖音需在弹窗中扫码登录（匿名设备风控较严，登录后弹幕更稳定）
3. 窗口采集名为`点怪机 - 队列`的窗口
4. 观众发送弹幕格式：`点怪 怪物名称`（例如：`点怪 泡狐龙`，不加空格也行）

## 开发指南

### 环境要求
- Node.js 16+
- pnpm

### 项目结构
```
mhw-combat-queue/
├── src/                # 源代码目录
│   ├── assets/         # 内置媒体资源
│   ├── components/     # 组件
│   ├── views/          # 窗口页面
│   └── utils/          # 工具函数
├── images/             # APP图标
└── package.json        # 项目配置
```

### 运行
1. 克隆项目
```bash
git clone [项目地址]
cd mhw-combat-queue
```

2. 安装依赖
```bash
pnpm i
```

3. 配置环境
```bash
pnpm config set node-linker hoisted
```

4. 启动APP
```bash
pnpm run start
```
