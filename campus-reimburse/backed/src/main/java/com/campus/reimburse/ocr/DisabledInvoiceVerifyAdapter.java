package com.campus.reimburse.ocr;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "campus.invoice-verify.enabled", havingValue = "false", matchIfMissing = true)
public class DisabledInvoiceVerifyAdapter implements InvoiceVerifyPort {
    @Override
    public VerifyResult verify(String invoiceCode, String invoiceNo, String issueDate, String amount) {
        return VerifyResult.skipped();
    }
}
