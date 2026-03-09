# CDSS 2.0 临床辅助决策助手 - MVP版本

## 项目概述

这是一个嵌入HIS右侧的窄屏桌面端临床决策助手，用于在接诊过程中为医生提供实时辅助。

## 技术架构

### 后端（Python）
- **数据层** (`backend/data/`): 数据模型和mock数据
- **服务层** (`backend/services/`): 业务逻辑
- **工具层** (`backend/tools/`): API接口

### 前端（React + TypeScript）
- **布局组件** (`frontend/src/components/`): 顶部栏、步骤导航、底部栏、搜索弹窗
- **页面组件** (`frontend/src/pages/`): 六个步骤页面
- **状态管理** (`frontend/src/store.ts`): Zustand状态管理

## 目录结构

```
CDSS 2.0/
├── backend/
│   ├── data/
│   │   ├── models.py          # 数据模型
│   │   └── mock_data.py       # Mock数据
│   ├── services/
│   │   ├── patient_service.py
│   │   ├── input_service.py
│   │   ├── diagnosis_service.py
│   │   ├── treatment_service.py
│   │   ├── test_service.py
│   │   └── risk_service.py
│   ├── tools/
│   │   └── api.py             # Flask API
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/        # 布局组件
    │   ├── pages/             # 步骤页面
    │   ├── types.ts           # 类型定义
    │   ├── store.ts           # 状态管理
    │   ├── App.tsx            # 主应用
    │   └── main.tsx           # 入口
    ├── package.json
    └── vite.config.ts
```

## 已实现功能

### 1. 系统壳子
- ✅ 窄屏布局（顶部/左侧/底部/中间）
- ✅ 单字纵向步骤导航
- ✅ 全局分类搜索
- ✅ 患者信息展示

### 2. MVP六个步骤
1. ✅ 辅助输入 - 主诉输入、症状体征标签、结构化归类
2. ✅ 辅助诊断 - 推荐诊断列表、置信度、诊断依据
3. ✅ 通用治疗 - 标准治疗方案、用药建议
4. ✅ 个性化治疗 - 基于患者特征的调整方案
5. ✅ 检验检查推荐 - 推荐项目、优先级、采样要求
6. ✅ 风险与审核 - 风险评分、干预建议、审核提示

## 启动方式

### 后端启动
```bash
cd backend
pip install -r requirements.txt
python -m tools.api
```
后端运行在 http://localhost:5000

### 前端启动
```bash
cd frontend
npm install
npm run dev
```
前端运行在 http://localhost:3000

## 当前状态

- 使用Mock数据演示
- 不连接真实HIS
- 不连接真实AI
- 不连接真实数据库
- 前后端已分层，便于后续扩展

## 后续扩展方向

1. 对接真实后端API
2. 接入真实知识库
3. 接入AI模型
4. 添加更多步骤页（检验结果解读、循证医学、评估与转诊）
5. 完善交互细节
6. 添加权限系统
