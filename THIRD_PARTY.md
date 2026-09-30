# 第三方与数据来源

原创实现采用 Apache-2.0。MoonBit 工具链和官方 core 是独立上游依赖；仓库不打包编译器。

`web/agent_tape.js` 包含 MoonBit 官方 core 的编译代码，随仓库保留其完整许可证及 NOTICE：`third_party/moonbit-core-LICENSE`、`third_party/moonbit-core-NOTICE`。core 主许可证为 Apache-2.0，NOTICE 记录上游来源与附加许可说明。

Node CLI 和浏览器使用随附编译产物，无需额外安装 npm 包。Python 可选报告解读脚本依赖 HTTPX；Python 和 HTTPX 保留各自许可证。

文档导出使用 python-docx、python-pptx 和 LibreOffice；中文排版使用 Noto Sans CJK SC。视频来自本地程序实际录屏，中文旁白使用 Microsoft Edge 语音合成服务生成，未使用特定个人的声音样本。这些制作工具没有作为运行时依赖打包进仓库。

VCR.py、LangSmith 和 Cedar 的资料用于说明已有方法及设计启发，未复制其实现。详细链接见 [参考资料](docs/参考资料.md)。示例为原创合成调用轨迹，不含真实用户数据。
