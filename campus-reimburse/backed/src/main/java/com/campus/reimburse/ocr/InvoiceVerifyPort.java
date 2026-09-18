package com.campus.reimburse.ocr;

public interface InvoiceVerifyPort {
    VerifyResult verify(String invoiceCode, String invoiceNo, String issueDate, String amount);
}
