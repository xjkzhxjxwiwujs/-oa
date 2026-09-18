package com.campus.reimburse.ocr;

import java.util.Map;

public record OcrResult(String status, String invoiceCode, String invoiceNo, String issueDate,
                        String amount, String buyerName, String message, Map<String, Object> raw) {
    public static OcrResult skipped() {
        return new OcrResult("SKIPPED", null, null, null, null, null, "ocr disabled", Map.of());
    }
}
