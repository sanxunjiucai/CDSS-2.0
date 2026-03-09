import { SearchResult, SearchCategory } from '../types'

export const MOCK_SEARCH_DB: SearchResult[] = [
  {
    id: 's1', type: '指南',
    title: '冠心病诊疗指南（2023版）',
    summary: '涵盖稳定型与不稳定型心绞痛的诊断标准及一线药物治疗规范，包含抗血小板治疗路径。',
    content: '### 适应证\n\n稳定型心绞痛、不稳定型心绞痛（UAP）及 NSTEMI 患者。\n\n### 一线用药\n\n- 阿司匹林 100 mg qd\n- 氯吡格雷 75 mg qd（双联抗血小板）\n- 他汀类药物（强化降脂）\n\n### 注意事项\n\n肾功能不全患者需调整剂量；出血风险高者慎用 DAPT。',
    tags: ['心血管', '抗血小板', 'ACS', '他汀'],
    source: '中华心血管病杂志', updatedAt: '2023-11',
  },
  {
    id: 's2', type: '指南',
    title: '高血压防治指南（2024版）',
    summary: 'ACEI/ARB 为首选，合并糖尿病时优先选用，需定期监测肾功能与血钾水平。',
    content: '### 诊断标准\n\n诊室血压 ≥ 140/90 mmHg；家庭自测 ≥ 135/85 mmHg。\n\n### 一线药物\n\n- ACEI（培哚普利、依那普利）\n- ARB（缬沙坦、厄贝沙坦）\n- CCB（苯磺酸氨氯地平）\n\n### 合并糖尿病\n\n优先 ACEI/ARB，目标血压 < 130/80 mmHg。',
    tags: ['高血压', 'ACEI', 'ARB', '糖尿病'],
    source: '中国高血压防治指南', updatedAt: '2024-01',
  },
  {
    id: 's3', type: '药物',
    title: '阿司匹林肠溶片',
    summary: '抗血小板聚集，用于冠心病二级预防，常规剂量 100 mg qd，餐前服用。',
    content: '### 适应证\n\n冠心病、TIA、缺血性脑卒中二级预防。\n\n### 用法用量\n\n100 mg po qd，餐前 30 分钟整片吞服。\n\n### 禁忌\n\n- 活动性消化道出血\n- 阿司匹林过敏\n- 严重肝功能损害\n\n### 不良反应\n\n胃肠道反应（恶心、胃痛），长期使用监测大便潜血。',
    tags: ['抗血小板', '心血管', '二级预防'],
    source: '药品说明书', updatedAt: '2024-03',
  },
  {
    id: 's4', type: '药物',
    title: '青霉素过敏替代方案',
    summary: '青霉素过敏患者可选头孢类（需皮试）或阿奇霉素，需明确过敏类型后决策。',
    content: '### 评估步骤\n\n1. 确认过敏类型（速发型 / 迟发型）\n2. 速发型过敏：避免所有β-内酰胺类\n3. 迟发型过敏：可在监测下使用头孢（交叉过敏率约 1%）\n\n### 替代选择\n\n- 阿奇霉素（呼吸道感染）\n- 克林霉素（皮肤软组织感染）\n- 万古霉素（重症 MRSA）',
    tags: ['过敏', '抗菌药物', '青霉素'],
    source: '抗菌药物临床应用指导原则', updatedAt: '2023-08',
  },
  {
    id: 's5', type: '疾病',
    title: '2型糖尿病',
    summary: '代谢性疾病，以胰岛素分泌不足或胰岛素抵抗为主要机制，需长期血糖管理。',
    content: '### 诊断标准\n\n- 空腹血糖 ≥ 7.0 mmol/L\n- 餐后2h血糖 ≥ 11.1 mmol/L\n- HbA1c ≥ 6.5%\n\n### 治疗路径\n\n1. 生活方式干预（饮食 + 运动）\n2. 二甲双胍（一线）\n3. 加用 GLP-1RA 或 SGLT-2i（合并心血管病）\n\n### 监测频率\n\nHbA1c 每3个月1次；肾功能每6~12个月1次。',
    tags: ['糖尿病', '血糖', 'HbA1c', '二甲双胍'],
    source: '中国2型糖尿病防治指南', updatedAt: '2023-12',
  },
  {
    id: 's6', type: '检验',
    title: 'hs-cTnI（超敏肌钙蛋白I）',
    summary: '急性心肌损伤标志物，用于 ACS 早期诊断，症状出现后 1h 内可升高。',
    content: '### 临床意义\n\n心肌细胞损伤后释放，对 AMI 诊断敏感性 > 95%。\n\n### 参考范围\n\n男性 < 34 ng/L；女性 < 16 ng/L（99th 百分位）\n\n### 采样要求\n\n静脉血 2 mL，EDTA 抗凝；0-1h 方案：0h + 1h 双次采血提升阴性预测值。\n\n### 注意事项\n\n肾功能不全、心肌炎可导致假阳性，需结合临床综合判断。',
    tags: ['心肌损伤', 'ACS', '肌钙蛋白', '急诊'],
    source: 'ESC 急性冠脉综合征指南', updatedAt: '2024-02',
  },
]

export function runSearch(kw: string, category: SearchCategory): SearchResult[] {
  if (!kw.trim()) return []
  const lower = kw.toLowerCase()
  return MOCK_SEARCH_DB.filter(item => {
    const matchCat = category === '全部' || item.type === category
    const matchKw =
      item.title.includes(kw) ||
      item.summary.includes(kw) ||
      item.tags.some(t => t.includes(kw)) ||
      item.title.toLowerCase().includes(lower)
    return matchCat && matchKw
  })
}
