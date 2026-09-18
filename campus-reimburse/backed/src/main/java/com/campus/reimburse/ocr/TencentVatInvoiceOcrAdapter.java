package com.campus.reimburse.ocr;

import java.util.Base64;

/**
 * 二期预留槽位：真正接通腾讯云时使用 OcrClient.VatInvoiceOCR，请求体仅 ImageBase64，禁止 ImageUrl。
 * 当前未引入腾讯云 SDK 与密钥，也未注册为 Spring Bean；即使 campus.ocr.provider=tencent，
 * 也不会发起任何外部请求，避免把"未实现"误当作已识别/已验真的结果。
 * 接入步骤（届时）：
 * 1) pom.xml 加入 com.tencentcloudapi:tencentcloud-sdk-java-ocr；
 * 2) 用 campus.ocr.tencent.* 构造 Credential/HttpProfile/ClientProfile；
 * 3) 调用 OcrClient.VatInvoiceOCR(VatInvoiceOCRRequest{ImageBase64})，解析 VatInvoiceInfos；
 * 4) 补上 @Component + @ConditionalOnProperty(name = "campus.ocr.provider", havingValue = "tencent")。
 */
public class TencentVatInvoiceOcrAdapter implements OcrPort {
    @Override
    public OcrResult recognize(byte[] imageBytes, String mime) {
        String imageBase64 = Base64.getEncoder().encodeToString(imageBytes);
        throw new UnsupportedOperationException(
                "腾讯云 VatInvoiceOCR 尚未接通，当前仅预留槽位；请使用 campus.ocr.provider=mock 联调队列与页面。base64Length=" + imageBase64.length());
    }
}
