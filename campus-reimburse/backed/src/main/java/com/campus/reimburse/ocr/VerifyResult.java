package com.campus.reimburse.ocr;

public record VerifyResult(String status, String message) {
    public static VerifyResult skipped() {
        return new VerifyResult("SKIPPED", "verify disabled");
    }
}
