package com.campus.reimburse.ocr;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 仅用于联调 OCR 队列和页面状态；不会从文件内容伪造识别结果。
 */
@Component
@ConditionalOnProperty(name = "campus.ocr.provider", havingValue = "mock")
public class MockOcrAdapter implements OcrPort {
    @Override
    public OcrResult recognize(byte[] imageBytes, String mime) {
        return new OcrResult("FAILED", null, null, null, null, null,
                "当前为 mock OCR，未调用腾讯云", Map.of("mime", mime, "bytes", imageBytes.length));
    }
}
