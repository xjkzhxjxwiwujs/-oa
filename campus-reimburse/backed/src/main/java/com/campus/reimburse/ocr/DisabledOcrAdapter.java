package com.campus.reimburse.ocr;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "campus.ocr.enabled", havingValue = "false", matchIfMissing = true)
public class DisabledOcrAdapter implements OcrPort {
    @Override
    public OcrResult recognize(byte[] imageBytes, String mime) {
        return OcrResult.skipped();
    }
}
