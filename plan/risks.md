# Risks and edges — what can knock us out and how we avoid it

🔴 = critical

| | Risk | Mitigation |
|-|------|------------|
| 🔴 | WhatsApp, OpenRouter and ElevenLabs don't work in mainland China | The online jury watches the video, no problem. For the final: **roaming with a Chilean SIM or international eSIM** (roaming doesn't go through the firewall), backend outside China and Demo Mode that replays the scenario without network. |
| 🔴 | The live demo fails in front of the jury | **Deterministic Demo Mode** with fixed seed and cached responses. Recorded video as backup, always. |
| 🔴 | An API key leaks in the public repo | No keys in code: **.env + secret scanning** on GitHub. Spending limit on every provider. Rotate keys before making the repo public. |
| | The LLM makes up a number | Design rule: **the LLM never calculates**. Every number comes from a deterministic tool and the UI shows where it comes from. |
| | Scope grows and we don't finish | Strict MoSCoW, freeze on Sunday the 11th, and Valentín, as lead, with veto power over new features. |
| | Someone falls behind and blocks the rest | API contracts on day 2 and **mocks for everything**: the front moves forward even if the agent isn't ready. |
| 🔴 | The jury is in China and many links don't open there | YouTube, Google Drive, Google Fonts and *.vercel.app are blocked. **Video as attached MP4**, own domain for the demo, self-hosted fonts and test everything with an access test from China. GitHub does open, though sometimes slowly. |
| | Looking like we don't understand China by using WhatsApp | WhatsApp is for the Chilean SME, not for China. The pitch makes it clear with the **channels-per-market slide**, the simulated WeCom adapter and WeChat on the roadmap. Tencent is WeBank's largest shareholder: showing we thought about WeChat adds points. |
| | Maps and geopolitical names | Avoid maps with borders in deck and UI. If territories must be named, use the same terms as the rules: Mainland China, Hong Kong SAR, Macao SAR, Chinese Taipei. |
| | Formats that give away a demo made only for the West | In the Chinese view: amounts in CNY/RMB with ¥, year-month-day dates, and texts reviewed by someone who reads Chinese or at least double-translated. |
| | "Does this only apply to Chile?" | The problem (SMEs that export, get paid late and finance themselves expensively) exists across APEC, China included. Chile → China is the first corridor; the channel architecture and financial catalog are swapped per country. |
| | Third-party data or code without a license | Only synthetic data, declared as such. All libraries and models with their license listed in the README. |
| | Regular student certificates in English arrive late | Request them today. They usually take several business days. |
| | Trip to Shenzhen if we are finalists | At least one must go or we lose the prizes. Check valid passports and China–Chile visa requirements for November in advance. |
| | Time confusion at the close | 23:59 Beijing is **12:59 in Chile** on Tuesday the 20th, not midnight. |
| | Unnatural English in docs and pitch | Valentín does the final edit of everything. Timed pitch rehearsals at 9:30 to leave margin. |
