# Transcript of the demo video

[nanfeng-demo.mp4](nanfeng-demo.mp4), 3:04. The narration as spoken, with the burned-in 中文 subtitle of each line.
The app shots are one live take on https://www.nanfengcfo.com; the problem, results and team sections are motion graphics.
Generated from the edit (`resources/pipeline/pitch.mjs`), so it always matches the video.

| Time | Chapter | Narration (EN) | 字幕 (中文) |
|---|---|---|---|
| 0:02 | **The problem** | Chile ships USD 2.8 billion of cherries a season, almost all of it to China. | 智利每季出口28亿美元樱桃，几乎全部销往中国。 |
| 0:07 |  | The fruit arrives in three weeks. The money takes months. | 水果三周就到，货款却要等上几个月。 |
| 0:10 |  | For a family exporter, one late payment can mean missing payroll. | 对家族出口商来说，一笔货款迟到，就可能发不出工资。 |
| 0:14 |  | And most of them have no finance team to see it coming. | 而大多数出口商没有财务团队来提前预警。 |
| 0:19 |  | Meet Huerto Austral, a fictional cherry exporter, and NanFeng, its autonomous CFO. | 这是虚构的樱桃出口商 Huerto Austral，以及它的自主 CFO：南风。 |
| 0:26 |  | Then, bad news from Shanghai: the buyer will pay USD 180,000 45 days late. | 随后传来上海的坏消息：买家的18万美元货款将延迟45天支付。 |
| 0:34 | **Risk spotted** | The owner simply forwards the importer's letter to NanFeng. | 企业主只需把进口商的来信转给南风。 |
| 0:37 |  | From here on, this is the live agent at work, not a replay. | 接下来是真实运行的代理，而不是回放。 |
| 0:41 |  | It reads the letter, re-runs 10,000 cash simulations, and prices every financing option. | 它读取来信，重新运行一万次现金模拟，并为每种融资方案报价。 |
| 0:48 |  | Every step is on the record: which tool, which model, how long it took. | 每一步都有记录：用了哪个工具、哪个模型、耗时多久。 |
| 0:52 |  | All of that took under a minute. | 整个过程不到一分钟。 |
| 0:54 |  | The verdict: an 81% chance that cash runs out on December 30, exactly on payroll day. | 结论：12月30日，也就是发薪当天，现金耗尽的概率为81%。 |
| 1:01 |  | Before the notice, that risk was 13%. | 收到通知之前，这一风险只有13%。 |
| 1:05 | **Best deal** | Then it shops the market for the owner. | 接着，它替企业主货比三家。 |
| 1:07 |  | Its optimizer picks a 60-day pre-export loan in dollars: | 优化器选出60天期美元出口前贷款： |
| 1:11 |  | CLP 2.1 million, against CLP 3.8 million for the usual bank loan. | 成本210万比索，而常规银行贷款需380万。 |
| 1:17 |  | 45% cheaper, and it explains why every other option lost. | 便宜45%，并说明其他方案为何落选。 |
| 1:22 |  | Every number comes from the optimizer, not from the language model. | 每个数字都来自优化器，而不是语言模型。 |
| 1:27 | **You approve** | Borrowing is a level-3 action: only the owner can approve it, with a one-time code. | 借款属于 L3 级操作：只有企业主能批准，而且必须输入一次性验证码。 |
| 1:32 |  | The agent can propose. It can never approve. | 代理可以提议，但永远无权批准。 |
| 1:36 |  | Approved, and executed in the sandbox. | 已批准，并在沙盒中执行。 |
| 1:39 |  | The payroll is covered, and the owner saved CLP 1.7 million against a regular bank loan. | 工资有了保障，与普通银行贷款相比，企业主节省了170万比索。 |
| 1:46 | **On-chain proof** | Every step, including this approval, is sealed in a tamper-proof audit log. | 每一步，包括这次批准，都记录在防篡改的审计日志中。 |
| 1:51 |  | Its fingerprint is written to a public blockchain. | 日志的指纹被写入公共区块链。 |
| 1:53 |  | Here’s that transaction on Sepolia, the Ethereum test network. | 这是该交易在以太坊测试网 Sepolia 上的记录。 |
| 1:58 |  | No one can quietly change it. Not the agent, and not even us. | 没有人能悄悄修改它。代理不能，连我们自己也不能。 |
| 2:02 | **Fraud blocked** | Fraud is the other threat. At 8:47 that morning, a supplier's invoice arrived with a new bank account, | 欺诈是另一大威胁。当天早上8:47，一张供应商发票附上了新的银行账户， |
| 2:11 |  | plus a hidden line, white on white, telling the AI to approve the payment. | 还藏着一行白底白字的指令，要求 AI 批准付款。 |
| 2:15 |  | NanFeng quarantined it before any model could read it, and warned the owner. | 南风在任何模型读取之前就将其隔离，并提醒了企业主。 |
| 2:21 |  | Our red team threw 46 attacks at it. All 46 were stopped. | 我们的红队发起了46次攻击，全部被拦截。 |
| 2:26 | **Built for China** | NanFeng also speaks Chinese. | 南风也说中文。 |
| 2:29 |  | And it writes to the importer on WeCom, China's business chat, labelling every message as AI-generated, as Chinese rules require. | 并通过企业微信用中文联系进口商，每条消息都按中国规定标注“由AI生成”。 |
| 2:38 | **Results & team** | Across 50 benchmark cases, NanFeng solved all 50, and cut financing costs by 41% on average. | 在50个基准案例中，南风全部解决，融资成本平均降低41%。 |
| 2:47 |  | NanFeng doesn't advise. | 南风不止于建议。 |
| 2:49 |  | It acts, with your permission. | 它在您的授权下行动。 |
| 2:52 |  | Behind NanFeng are five students from Universidad del Desarrollo, in Chile: | 南风由智利发展大学的五名学生打造： |
| 2:57 |  | Try it yourself at www.nanfengcfo.com | 欢迎访问 www.nanfengcfo.com 亲自体验。 |
