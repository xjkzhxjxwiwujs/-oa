# 校园智能报销审批平台（智汇签）

按前端 / 后端 / 文档拆分：

| 目录 | 内容 |
|------|------|
| `fronted/` | Vue 3 + Vite + Ant Design Vue 前端 |
| `backed/` | Spring Boot 3 后端 |
| `doc/` | 方案与调研文档 |

根目录为部署脚本与运行配置（`start.sh` / `stop.sh` / `build.sh` / `nginx.conf` 等）。运行数据在 `runtime/`，不入库。

## 二期 OCR / 验真（腾讯云仅预留位置，未接通）

OCR 任务由 `job_task` 持久化，`start.sh` 会额外启动无 Web 端口的 worker 消费任务。当前默认 `campus.ocr.provider=mock`：报销页角落「OCR 快速填写」按钮、任务队列、`/admin/ocr-debug` 调试台全部可用，但 `MockOcrAdapter` 只返回明确的失败提示，**不调用腾讯云、不伪造识别结果**。

`OcrPort` / `InvoiceVerifyPort` 的腾讯云实现（`TencentVatInvoiceOcrAdapter` / `TencentVatInvoiceVerifyAdapter`）目前是**纯预留代码**：

- 没有 `@Component` 注解，不会被 Spring 装配；
- `recognize()` / `verify()` 方法体直接 `throw new UnsupportedOperationException(...)`；
- 没有引入 `tencentcloud-sdk-java-ocr` 依赖。

真正接入腾讯云时，需要按文件内注释补齐：引入 SDK 依赖 → 用 `campus.ocr.tencent.*` 构造 `Credential`/`ClientProfile` → 调用 `OcrClient.VatInvoiceOCR`（仅 `ImageBase64`，禁止 `ImageUrl`）→ 补上 `@Component` 与 `@ConditionalOnProperty(name = "campus.ocr.provider", havingValue = "tencent")`。**在此之前，不要把 `campus.ocr.provider` 设为 `tencent`**，否则请求识别时会直接抛出“尚未接通”的异常（这是故意的，避免误把未实现当作已识别/已验真）。

发票「确认」与「验真」是两个独立动作，不混在一起：

- `POST /api/finance/claims/{claimId}/invoices/{invoiceId}/confirm`：财务人工确认票号并写入 `invoice_occupation` 占用，一期即有，`verify_status` 恒为 `SKIPPED`。
- `POST /api/finance/claims/{claimId}/invoices/{invoiceId}/verify`：二期新增，`campus.invoice-verify.enabled=false`（默认）时也是恒 `SKIPPED`；置为 `true` 前必须先给 `TencentVatInvoiceVerifyAdapter` 补上真实实现，否则同样会在调用时报错，不会静默通过。

`GET /api/common/features` 返回 `ocrEnabled` / `invoiceVerifyEnabled`，前端据此决定是否渲染 OCR 按钮与后续的验真入口。
