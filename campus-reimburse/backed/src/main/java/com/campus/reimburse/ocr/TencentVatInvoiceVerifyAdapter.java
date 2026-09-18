package com.campus.reimburse.ocr;

/**
 * 二期预留槽位：真正接通腾讯云验真时使用 OcrClient.VatInvoiceVerifyNew。
 * 当前未引入腾讯云 SDK 与密钥，也未注册为 Spring Bean；campus.invoice-verify.provider=tencent
 * 时也不会发起任何外部请求，避免把"未实现"误当作已验真结果。
 */
public class TencentVatInvoiceVerifyAdapter implements InvoiceVerifyPort {
    @Override
    public VerifyResult verify(String invoiceCode, String invoiceNo, String issueDate, String amount) {
        throw new UnsupportedOperationException("腾讯云 VatInvoiceVerifyNew 尚未接通，当前仅预留槽位");
    }
}
