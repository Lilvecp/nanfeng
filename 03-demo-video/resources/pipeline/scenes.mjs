// The demo video script. Based on the FinTechathon kit (section 4, "Guion del video demo · 5:00"),
// reworked after a judge's review: one live take on www.nanfengcfo.com, the real agent instead of
// the replay, numbers that match the screen, the team at the end.
// One entry per scene. Each line is one subtitle cue:
//   say: what the narrator says (numbers spelled out so the voice reads them right; tts/edge.py
//        respells a few names for the voice, the subtitles keep the real spelling)
//   en:  the burned-in English subtitle (numerals, as a reader expects them)
//   zh:  the burned-in 中文 subtitle (to be checked by a native speaker before export)
//   at:  earliest start of the line on the scene clock, to wait for something on screen
// chapter: the step of the story, shown on the progress rail at the top of the frame.
// caption: what the viewer is looking at, shown for a few seconds when the scene starts.
// cut: the scene opens with a hard cut instead of a crossfade (the page continues from the scene
//      before, so a crossfade would show two offset copies of it).
// chips: rubric criteria the scene proves. TC task completion · SC security & compliance ·
//        II innovation & interaction · ON on-chain bonus.

export const CHAPTERS = [
  { id: "problem", en: "The problem", zh: "问题" },
  { id: "risk", en: "Risk spotted", zh: "发现风险" },
  { id: "deal", en: "Best deal", zh: "最优方案" },
  { id: "approve", en: "You approve", zh: "您来批准" },
  { id: "proof", en: "On-chain proof", zh: "链上证明" },
  { id: "fraud", en: "Fraud blocked", zh: "拦截欺诈" },
  { id: "china", en: "Built for China", zh: "为中国打造" },
  { id: "team", en: "Results & team", zh: "成果与团队" },
];

export const SCENES = [
  {
    id: "s01", title: "Landing · the problem", chapter: "problem", chips: [], minDur: 18.5,
    caption: null,
    lines: [
      { at: 1.2, say: "Chile ships two point eight billion dollars of cherries a season, almost all of it to China.",
        en: "Chile ships USD 2.8 billion of cherries a season, almost all of it to China.",
        zh: "智利每季出口28亿美元樱桃，几乎全部销往中国。" },
      { say: "The fruit arrives in three weeks. The money takes months.",
        en: "The fruit arrives in three weeks. The money takes months.",
        zh: "水果三周就到，货款却要等上几个月。" },
      { say: "For a family exporter, one late payment can mean missing payroll.",
        en: "For a family exporter, one late payment can mean missing payroll.",
        zh: "对家族出口商来说，一笔货款迟到，就可能发不出工资。" },
      { say: "And most of them have no finance team to see it coming.",
        en: "And most of them have no finance team to see it coming.",
        zh: "而大多数出口商没有财务团队来提前预警。" },
    ],
  },
  {
    id: "s02", title: "Home · the owner's morning", chapter: "problem", chips: ["TC", "II"],
    caption: { en: "Home · what the owner sees every morning", zh: "首页 · 企业主每天早上看到的内容" },
    lines: [
      { say: "Meet Huerto Austral, a fictional cherry exporter, and NanFeng, its autonomous CFO.",
        en: "Meet Huerto Austral, a fictional cherry exporter, and NanFeng, its autonomous CFO.",
        zh: "这是虚构的樱桃出口商 Huerto Austral，以及它的自主 CFO：南风。" },
      { say: "Every morning, NanFeng checks the cash and explains it in plain words:",
        en: "Every morning, NanFeng checks the cash and explains it in plain words:",
        zh: "每天早上，南风检查现金，并用最简单的话说明：" },
      { say: "one hundred seventy-six million pesos in the bank, and a two hundred thirty-eight million peso harvest payroll on December thirtieth.",
        en: "CLP 176 million in the bank, and a CLP 238 million harvest payroll on December 30.",
        zh: "账上有1.76亿智利比索，12月30日要发放2.38亿比索的采收工资。" },
      { say: "Then, bad news from Shanghai: the buyer will pay one hundred eighty thousand dollars forty-five days late.",
        en: "Then, bad news from Shanghai: the buyer will pay USD 180,000 45 days late.",
        zh: "随后传来上海的坏消息：买家的18万美元货款将延迟45天支付。" },
    ],
  },
  {
    id: "s03", title: "Live agent · the notice", chapter: "risk", chips: ["TC", "II"], minDur: 28, cut: true,
    caption: { en: "Live agent · a real run on www.nanfengcfo.com", zh: "实时代理 · 在 www.nanfengcfo.com 上真实运行" },
    lines: [
      { at: 1.0, say: "The owner simply forwards the importer's letter to NanFeng.",
        en: "The owner simply forwards the importer's letter to NanFeng.",
        zh: "企业主只需把进口商的来信转给南风。" },
      { say: "From here on, this is the live agent at work, not a replay.",
        en: "From here on, this is the live agent at work, not a replay.",
        zh: "接下来是真实运行的代理，而不是回放。" },
      { say: "It reads the letter, re-runs ten thousand cash simulations, and prices every financing option.",
        en: "It reads the letter, re-runs 10,000 cash simulations, and prices every financing option.",
        zh: "它读取来信，重新运行一万次现金模拟，并为每种融资方案报价。" },
      { at: 16.5, say: "Every step is on the record: which tool, which model, how long it took.",
        en: "Every step is on the record: which tool, which model, how long it took.",
        zh: "每一步都有记录：用了哪个工具、哪个模型、耗时多久。" },
      { say: "All of that took under a minute. No spreadsheets, no phone calls. The plan now waits for the owner's okay.",
        en: "All of that took under a minute. No spreadsheets, no phone calls. The plan now waits for the owner's OK.",
        zh: "整个过程不到一分钟。不用表格，不用打电话。方案现在只等企业主批准。" },
    ],
  },
  {
    id: "s04", title: "Home · the verdict", chapter: "risk", chips: ["TC"], minDur: 15, cut: true,
    caption: { en: "Forecast · 10,000 simulations", zh: "现金预测 · 一万次模拟" },
    lines: [
      { at: 1.4, say: "The verdict: an eighty-one percent chance that cash runs out on December thirtieth, exactly on payroll day.",
        en: "The verdict: an 81% chance that cash runs out on December 30, exactly on payroll day.",
        zh: "结论：12月30日，也就是发薪当天，现金耗尽的概率为81%。" },
      { say: "Before the notice, that risk was thirteen percent.",
        en: "Before the notice, that risk was 13%.",
        zh: "收到通知之前，这一风险只有13%。" },
      { say: "Ten thousand simulated seasons, day by day. NanFeng saw the gap nineteen days ahead.",
        en: "10,000 simulated seasons, day by day. NanFeng saw the gap 19 days ahead.",
        zh: "一万次季节模拟，逐日推演。南风提前19天发现了资金缺口。" },
    ],
  },
  {
    id: "s05", title: "Financing · options", chapter: "deal", chips: ["TC"], minDur: 22, cut: true,
    caption: { en: "Financing · every option compared", zh: "融资 · 比较所有方案" },
    lines: [
      { at: 1.4, say: "Then it shops the market for the owner: nine financing products, seven quotes.",
        en: "Then it shops the market for the owner: 9 financing products, 7 quotes.",
        zh: "接着，它替企业主货比三家：9种融资产品，7份报价。" },
      { say: "Its optimizer picks a sixty-day pre-export loan in dollars:",
        en: "Its optimizer picks a 60-day pre-export loan in dollars:",
        zh: "优化器选出60天期美元出口前贷款：" },
      { say: "two point one million pesos, against three point eight million for the usual bank loan.",
        en: "CLP 2.1 million, against CLP 3.8 million for the usual bank loan.",
        zh: "成本210万比索，而常规银行贷款需380万。" },
      { say: "Forty-five percent cheaper, and it explains why every other option lost.",
        en: "45% cheaper, and it explains why every other option lost.",
        zh: "便宜45%，并说明其他方案为何落选。" },
    ],
  },
  {
    id: "s06", title: "Financing · what if", chapter: "deal", chips: ["TC", "II"], minDur: 11, cut: true,
    caption: { en: "What if · stress-test the season", zh: "假设情景 · 压力测试" },
    lines: [
      { at: 1.0, say: "Worried about a bad season? Test it in one click.",
        en: "Worried about a bad season? Test it in one click.",
        zh: "担心行情不好？一键就能测试。" },
      { say: "If cherry prices drop ten percent, the risk climbs to ninety-five percent.",
        en: "If cherry prices drop 10%, the risk climbs to 95%.",
        zh: "如果樱桃价格下跌10%，风险将升至95%。" },
      { say: "And it re-prices the plan for that season: still forty-four percent cheaper than a bank loan.",
        en: "And it re-prices the plan for that season: still 44% cheaper than a bank loan.",
        zh: "它还会为这种情景重新定价方案：仍比银行贷款便宜44%。" },
    ],
  },
  {
    id: "s07", title: "Ask NanFeng · why", chapter: "deal", chips: ["II", "SC"], minDur: 15, cut: true,
    caption: { en: "Ask NanFeng · live answer from the agent", zh: "问问南风 · 代理实时回答" },
    lines: [
      { at: 1.2, say: "And the owner can always ask why.",
        en: "And the owner can always ask why.",
        zh: "企业主随时可以问“为什么”。" },
      { at: 6.0, say: "The answer comes from what the agent actually did. Every number comes from the optimizer, not from the language model.",
        en: "The answer comes from what the agent actually did. Every number comes from the optimizer, not from the language model.",
        zh: "回答基于代理实际执行的操作；每个数字都来自优化器，而不是语言模型。" },
    ],
  },
  {
    id: "s08", title: "Approvals · one-time code", chapter: "approve", chips: ["SC", "II"], minDur: 17.5, cut: true,
    caption: { en: "Approvals · owner + one-time code", zh: "审批 · 企业主 + 一次性验证码" },
    lines: [
      { at: 1.4, say: "Borrowing is a level-three action: only the owner can approve it, with a one-time code.",
        en: "Borrowing is a level-3 action: only the owner can approve it, with a one-time code.",
        zh: "借款属于 L3 级操作：只有企业主能批准，而且必须输入一次性验证码。" },
      { say: "In production, the code is texted to the owner's phone. This sandbox shows it on screen.",
        en: "In production, the code is texted to the owner's phone. This sandbox shows it on screen.",
        zh: "正式环境中，验证码以短信发送到企业主手机；本沙盒直接显示在屏幕上。" },
      { say: "The agent can propose. It can never approve.",
        en: "The agent can propose. It can never approve.",
        zh: "代理可以提议，但永远无权批准。" },
    ],
  },
  {
    id: "s09", title: "Executed", chapter: "approve", chips: ["TC"], minDur: 17, cut: true,
    caption: null,
    lines: [
      { at: 0.8, say: "Approved, and executed in the sandbox.",
        en: "Approved, and executed in the sandbox.",
        zh: "已批准，并在沙盒中执行。" },
      { say: "The payroll is covered, and the owner saved one point seven million pesos against a regular bank loan.",
        en: "The payroll is covered, and the owner saved CLP 1.7 million against a regular bank loan.",
        zh: "工资有了保障，与普通银行贷款相比，企业主节省了170万比索。" },
      { say: "Cash now stays above the safety buffer in ninety-six percent of scenarios.",
        en: "Cash now stays above the safety buffer in 96% of scenarios.",
        zh: "现在96%的情景中，现金都高于安全垫。" },
      { say: "From the importer's letter to a funded payroll: a few minutes, and one decision by the owner.",
        en: "From the importer's letter to a funded payroll: a few minutes, and one decision by the owner.",
        zh: "从进口商来信到工资有着落：只需几分钟，外加企业主的一个决定。" },
    ],
  },
  {
    id: "s10", title: "Audit · on-chain anchor", chapter: "proof", chips: ["ON", "SC"], minDur: 24, cut: true,
    caption: { en: "Audit log · anchored on a public blockchain", zh: "审计日志 · 锚定在公共区块链上" },
    lines: [
      { at: 1.2, say: "Every step, including this approval, is sealed in a tamper-proof audit log.",
        en: "Every step, including this approval, is sealed in a tamper-proof audit log.",
        zh: "每一步，包括这次批准，都记录在防篡改的审计日志中。" },
      { say: "Its fingerprint is written to a public blockchain.",
        en: "Its fingerprint is written to a public blockchain.",
        zh: "日志的指纹被写入公共区块链。" },
      { say: "Here is that transaction on Sepolia, the Ethereum test network.",
        en: "Here is that transaction on Sepolia, the Ethereum test network.",
        zh: "这是该交易在以太坊测试网 Sepolia 上的记录。" },
      { at: 16.0, say: "Anyone can check that no step was rewritten.",
        en: "Anyone can check that no step was rewritten.",
        zh: "任何人都能核实，没有任何步骤被改写。" },
      { say: "No one can quietly change it. Not the agent, and not even us.",
        en: "No one can quietly change it. Not the agent, and not even us.",
        zh: "没有人能悄悄修改它。代理不能，连我们自己也不能。" },
    ],
  },
  {
    id: "s11", title: "Security · fake invoice", chapter: "fraud", chips: ["SC"],
    caption: { en: "Documents · the invoice NanFeng blocked at 8:47", zh: "文件 · 南风在8:47拦截的发票" },
    lines: [
      { at: 1.0, say: "Fraud is the other threat. At eight forty-seven that morning, a supplier's invoice arrived with a new bank account,",
        en: "Fraud is the other threat. At 8:47 that morning, a supplier's invoice arrived with a new bank account,",
        zh: "欺诈是另一大威胁。当天早上8:47，一张供应商发票附上了新的银行账户，" },
      { say: "plus a hidden line, white on white, telling the AI to approve the payment.",
        en: "plus a hidden line, white on white, telling the AI to approve the payment.",
        zh: "还藏着一行白底白字的指令，要求 AI 批准付款。" },
      { say: "NanFeng quarantined it before any model could read it, and warned the owner.",
        en: "NanFeng quarantined it before any model could read it, and warned the owner.",
        zh: "南风在任何模型读取之前就将其隔离，并提醒了企业主。" },
      { say: "Our red team threw forty-six attacks at it. All forty-six were stopped.",
        en: "Our red team threw 46 attacks at it. All 46 were stopped.",
        zh: "我们的红队发起了46次攻击，全部被拦截。" },
    ],
  },
  {
    id: "s12", title: "中文 · WeCom", chapter: "china", chips: ["II", "SC"], minDur: 18.5, cut: true,
    caption: { en: "中文 · the same app in Chinese", zh: "中文 · 同一个应用的中文界面" },
    lines: [
      { at: 1.0, say: "NanFeng also speaks Chinese. Every screen switches in one click,",
        en: "NanFeng also speaks Chinese. Every screen switches in one click,",
        zh: "南风也说中文。所有界面一键切换，" },
      { at: 7.5, say: "and it writes to the importer on WeCom, China's business chat, labelling every message as AI-generated, as Chinese rules require.",
        en: "and it writes to the importer on WeCom, China's business chat, labelling every message as AI-generated, as Chinese rules require.",
        zh: "并通过企业微信用中文联系进口商，每条消息都按中国规定标注“由AI生成”。" },
    ],
  },
  {
    id: "s13", title: "Benchmark", chapter: "team", chips: ["TC", "II"], minDur: 16,
    caption: null,
    lines: [
      { at: 1.2, say: "Across fifty benchmark cases, NanFeng solved all fifty, and cut financing costs by forty-one percent on average.",
        en: "Across 50 benchmark cases, NanFeng solved all 50, and cut financing costs by 41% on average.",
        zh: "在50个基准案例中，南风全部解决，融资成本平均降低41%。" },
      { say: "NanFeng doesn't just advise. It acts, with your permission.",
        en: "NanFeng doesn't just advise. It acts, with your permission.",
        zh: "南风不只是建议——它在您的授权下行动。" },
    ],
  },
  {
    id: "s14", title: "The team", chapter: "team", chips: [], minDur: 22.5, cut: true,
    caption: null,
    lines: [
      { at: 0.8, say: "Behind NanFeng are five students from Universidad del Desarrollo, in Chile:",
        en: "Behind NanFeng are five students from Universidad del Desarrollo, in Chile:",
        zh: "南风由智利发展大学的五名学生打造：" },
      { say: "Valentín Castro, Renato Lenis, Camilo Bufadel, Andy Villarroel, and Vicente Rodríguez.",
        en: "Valentín Castro, Renato Lenis, Camilo Bufadel, Andy Villarroel and Vicente Rodríguez.",
        zh: "Valentín Castro、Renato Lenis、Camilo Bufadel、Andy Villarroel 和 Vicente Rodríguez。" },
      { say: "We built it for every family exporter that can't afford a CFO of its own.",
        en: "We built it for every family exporter that can't afford a CFO of its own.",
        zh: "我们为每一家请不起财务总监的家族出口企业打造了它。" },
      { say: "Try it yourself at nanfengcfo.com.",
        en: "Try it yourself at www.nanfengcfo.com",
        zh: "欢迎访问 www.nanfengcfo.com 亲自体验。" },
    ],
  },
];

export const CHIP_LABEL = {
  TC: "Task completion",
  SC: "Security & compliance",
  II: "Innovation & interaction",
  ON: "On-chain",
};

// Video layout and pacing, shared by the recorder and the compositor.
export const FPS = 30;
export const VIEWPORT = { width: 1600, height: 900 }; // CSS px of the recorded browser
export const DSF = 1.5;                                 // recorded at 2400×1350 for crisp zooms
export const HEAD_S = 0.4;  // silence before the narration of each scene
export const TAIL_S = 0.9;  // silence after it
export const GAP_S = 0.45;  // pause between two lines of the same scene
export const OPEN_S = 3.4;  // opening title card (tagline), before scene 1
export const END_S = 3;     // closing card: logo, URL, repo

/** Rough narration length when no voice track exists yet (about 15 characters per second). */
export const estimateSeconds = (text) => Math.max(1.2, text.length / 15);
