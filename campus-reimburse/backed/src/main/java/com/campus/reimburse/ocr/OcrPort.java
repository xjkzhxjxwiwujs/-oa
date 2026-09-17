package com.campus.reimburse.ocr;

public interface OcrPort {
    OcrResult recognize(byte[] imageBytes, String mime);
}
