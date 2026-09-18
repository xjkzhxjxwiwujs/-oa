package com.campus.reimburse.ocr;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "campus.ocr.provider", havingValue = "disabled")
public class DisabledOcrAdapter implements OcrPort {
    @Override
    public OcrResult recognize(byte[] imageBytes, String mime) {
        return OcrResult.skipped();
    }
}
