package com.campus.reimburse.ocr;

import java.util.Base64;

/**
 * 二期接通：OcrClient.VatInvoiceOCR，仅 ImageBase64，禁止 ImageUrl。
 */
public class TencentVatInvoiceOcrAdapter implements OcrPort {
    @Override
    public OcrResult recognize(byte[] imageBytes, String mime) {
        String imageBase64 = Base64.getEncoder().encodeToString(imageBytes);
        // VatInvoiceOCRRequest req = new VatInvoiceOCRRequest();
        // req.setImageBase64(imageBase64);
        // VatInvoiceOCRResponse resp = ocrClient.VatInvoiceOCR(req);
        throw new UnsupportedOperationException("tencent adapter reserved; set campus.ocr.enabled=true in phase 2, " + imageBase64.length());
    }
}
