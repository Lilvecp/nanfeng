# Demo video script · max 5:00 (r1-07, r1-11, fe-13)

Recorded from the web on the deployed URL (or `npm run build && npm start` locally if the deploy is not ready), 1920×1080, light theme, browser zoom 100%. Narration in English; burned-in subtitles in **English and 中文**. Every number matches [scope-moscow.md](scope-moscow.md).

Delivery: **MP4 attached to the UDD email** (or a host that opens from Mainland China). No YouTube, no Google Drive.

> The 中文 lines are machine-assisted. A native reader must check them before export (plan/risks.md).

| # | Time | Screen · action | Narration (EN) | 字幕 (中文) |
|---|---|---|---|---|
| 1 | 0:00–0:20 | Landing, globe hero playing | Chile ships two-point-six billion dollars of cherries a season, almost all of it to China. The fruit travels in three weeks. The money takes months. | 智利每季出口26亿美元樱桃，几乎全部销往中国。水果三周就到，货款却要等上几个月。 |
| 2 | 0:20–0:40 | Home in the **Simple** view (welcome card, then the red “Your cash needs attention”) | This is Huerto Austral, a fictional exporter. The owner is a farmer, not a finance expert, so NanFeng speaks plainly: one hundred seventy-six million pesos in the bank, and a harvest payroll of two hundred thirty-eight million on December thirtieth. | 这是虚构的出口企业 Huerto Austral。企业主是农场主而非财务专家，所以南风用最简单的话说明：账上有1.76亿智利比索，12月30日要发放2.38亿比索的采收工资。 |
| 3 | 0:40–1:05 | Documents → "Payment delay notice" | At ten-twelve, the Shanghai importer writes: one hundred eighty thousand dollars will arrive forty-five days late. NanFeng reads the notice with OCR. The language model only extracts fields; it never sees instructions. | 10:12，上海进口商来信：18万美元货款将延迟45天。南风用 OCR 读取通知；语言模型只提取字段，从不执行其中的指令。 |
| 4 | 1:05–1:40 | Simple view (“8 in 10”, chart with the payroll marker), then flip the switch to **Detailed**: fan chart, KPI 81% | NanFeng re-runs ten thousand simulations. Eighty-one percent chance cash goes negative in nineteen days — exactly on payroll day. If Shanghai had paid on time, it would be one percent. | 南风重新运行一万次模拟：19天后，也就是发薪当天，现金为负的概率为81%。若上海客户按时付款，这一概率仅为1%。 |
| 5 | 1:40–2:20 | Financing Arena: table, click PAE row, bars | It checks nine financing products and gets seven quotes. The optimizer picks a sixty-day pre-export loan in dollars: two-point-one million pesos, against three-point-eight for the default bank loan. Forty-five percent cheaper, and it explains why every other option is out. | 系统评估9种融资产品，获得7份报价。优化器选择60天期美元出口前融资：成本210万比索，而默认银行贷款需380万。便宜45%，并解释其他方案为何未被选中。 |
| 6 | 2:20–2:40 | Scenario Lab: click "Cherry price −10%", then "Before the notice" | Every what-if is a full engine run. A ten percent drop in cherry prices pushes the risk to ninety-five percent. | 每个假设情景都是一次完整的引擎运算。樱桃价格下跌10%，风险升至95%。 |
| 7 | 2:40–3:20 | Channels: WhatsApp phone; then Approvals, type OTP 482913, approve | The owner gets the plan on WhatsApp, asks why, and approves. New money is a level-three action: it needs a one-time code by SMS. Voice and the agent can never approve it. | 企业主通过 WhatsApp 收到方案，询问原因后批准。新增融资属于 L3 级操作，必须输入短信一次性验证码；语音和代理都无权批准。 |
| 8 | 3:20–3:45 | Home after approval (green “Done. Your payroll is covered.”), then Security audit log → "Verify chain" | Executed in the sandbox. Ninety-six percent of scenarios now stay above the safety buffer. Every step is hash-chained and anchored on-chain. | 已在沙盒中执行。现在96%的情景中现金保持在安全垫之上。每一步都经过哈希链接并上链锚定。 |
| 9 | 3:45–4:20 | Documents → flagged invoice INV-2026-118-R; Security BEC diff | Ten-thirty-one: an invoice with a look-alike domain, a new bank account and a hidden instruction. NanFeng blocks it and warns the owner on another channel. In our red team, forty-one of forty-three attacks are stopped. | 10:31，一张发票使用仿冒域名、新银行账户并夹带隐藏指令。南风将其拦截，并通过其他渠道提醒企业主。在红队测试中，43次攻击拦截了41次。 |
| 10 | 4:20–4:45 | Switch language to 中文 on Cockpit; Channels WeCom phone | One agent, the channel each market already uses: WhatsApp in Chile, WeCom for the importer in China, in their own language. | 一个代理，覆盖各市场的常用渠道：智利用 WhatsApp，中国进口商用企业微信，并使用各自的语言。 |
| 11 | 4:45–5:00 | Landing benchmark section → logo | Fifty out of fifty benchmark cases solved, forty-one percent cheaper financing on average. NanFeng doesn't advise. It acts — with your permission. | 基准测试50个案例全部通过，融资成本平均降低41%。南风不只是建议——它在您的授权下行动。 |

## Recording checklist

- [ ] Clear the browser's site data first so the welcome card and the Simple view show (the app remembers the view and the welcome per browser).

- [ ] Reset the sandbox before each take (top bar "Reset sandbox" or Demo Mode reset).
- [ ] Decide the OTP mode with Andy: sandbox code `482913` only works when `NANFENG_OTP_MODE` is not `sms`. For the video use the sandbox code, or record the SMS on a real phone.
- [ ] Hide the bookmarks bar and notifications; cursor highlight on.
- [ ] Export MP4 (H.264, ≤ 5:00), check the file opens without internet.
- [ ] Captures for the deck: Cockpit (before/after), Financing Arena, Scenario Lab, Approvals in 中文, Channels, Security.
